/**
 * vision-worker.js — Off-thread Perception Engine
 *
 * Runs in a Web Worker so detection never blocks the main thread.
 *
 * Model ladder:
 *  1. COCO-SSD (lite_mobilenet_v2) — ultra-fast, WASM-safe, always available
 *  2. YOLOv11-nano (via @huggingface/transformers, ONNX) — better recall, WebGPU preferred
 *  3. MobileViT-XXSmall — on-demand snapshot classifier (called explicitly, not every frame)
 *  4. Depth Anything V2 Small — on-demand depth map for spatial engine (called explicitly)
 *
 * Progressive Enhancement: each tier loads lazily on first use.
 * Models cache in IndexedDB after first download.
 */
import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.5.0';

// Allow models to be fetched from HF Hub on first run, then cached locally.
env.allowLocalModels = true;
env.allowRemoteModels = true;

// ── Model state ────────────────────────────────────────────────────────────────
let tf = null;
let cocoModel = null;          // Fast path: COCO-SSD
let yoloPipeline = null;       // Better path: YOLOv11-nano
let classifierPipeline = null; // On-demand: MobileViT-XXSmall
let depthPipeline = null;      // On-demand: Depth Anything V2 Small
let yoloReady = false;

// ── Init ───────────────────────────────────────────────────────────────────────
self.onmessage = async (e) => {
  const { type, data } = e.data;

  if (type === 'init') {
    try {
      // 1. Load COCO-SSD (always available, ~3MB, WASM-safe)
      importScripts('local-models/tf.min.js');
      importScripts('local-models/tf-backend-wasm.min.js');
      importScripts('local-models/coco-ssd.js');

      tf = self.tf;
      let backend = 'webgl';
      try {
        await tf.setBackend('webgpu');
        backend = 'webgpu';
      } catch {
        try {
          await tf.setBackend('wasm');
          backend = 'wasm';
        } catch {
          await tf.setBackend('webgl');
        }
      }
      await tf.ready();
      cocoModel = await self.cocoSsd.load({ base: 'lite_mobilenet_v2' });

      // 2. Load YOLOv11-nano in background (better detection, ~6MB)
      // Non-blocking — COCO-SSD will be used until YOLO is ready
      _loadYolo(backend).catch(err => {
        self.postMessage({ type: 'log', message: 'YOLOv11 load failed, using COCO-SSD: ' + err.message });
      });

      self.postMessage({ type: 'ready', backend, hasHighIQ: false, hasYolo: false });
    } catch (err) {
      self.postMessage({ type: 'error', message: err.message });
    }
  }

  // ── Main detection predict ────────────────────────────────────────────────
  if (type === 'predict') {
    if (!cocoModel) return;
    try {
      const { bitmap, threshold, maxBoxes, customLabels } = data;
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(bitmap, 0, 0);

      let predictions = [];

      // Prefer YOLO if ready (better recall), fall back to COCO-SSD
      if (yoloReady && yoloPipeline) {
        try {
          const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.85 });
          const url = URL.createObjectURL(blob);
          const results = await yoloPipeline(url, { threshold: threshold });
          URL.revokeObjectURL(url);
          predictions = results.map(r => ({
            class: r.label,
            score: r.score,
            bbox: [r.box.xmin, r.box.ymin, r.box.xmax - r.box.xmin, r.box.ymax - r.box.ymin],
            source: 'yolo11n'
          })).slice(0, maxBoxes);
        } catch (yoloErr) {
          // YOLO failed this frame, fall through to COCO-SSD
          yoloReady = false;
        }
      }

      // COCO-SSD fallback or primary if YOLO not ready
      if (!yoloReady || predictions.length === 0) {
        const tensor = tf.browser.fromPixels(bitmap);
        const cocoPredictions = await cocoModel.detect(tensor, maxBoxes, threshold);
        tensor.dispose();
        predictions = cocoPredictions.map(p => ({ ...p, source: 'coco-ssd' }));
      }

      // Zero-shot custom labels (OWL-ViT / transformers.js pipeline) — if labels provided
      // This still works with the new package as before
      let customPredictions = [];
      if (customLabels && customLabels.length > 0) {
        try {
          if (!self._owlPipeline) {
            self._owlPipeline = await pipeline('zero-shot-object-detection', 'Xenova/owlvit-base-patch32');
          }
          const blob = await canvas.convertToBlob({ type: 'image/jpeg' });
          const url = URL.createObjectURL(blob);
          const results = await self._owlPipeline(url, customLabels, { threshold });
          URL.revokeObjectURL(url);
          customPredictions = results.map(r => ({
            class: r.label,
            score: r.score,
            bbox: [r.box.xmin, r.box.ymin, r.box.xmax - r.box.xmin, r.box.ymax - r.box.ymin],
            source: 'owlvit-zero-shot'
          }));
        } catch (_) { /* custom labels optional */ }
      }

      self.postMessage({
        type: 'results',
        predictions: [...predictions, ...customPredictions]
      });
    } catch (err) {
      self.postMessage({ type: 'error', message: err.message });
    }
  }

  // ── On-demand: classify a single cropped image ─────────────────────────────
  if (type === 'classify_snapshot') {
    try {
      const { bitmap, requestId } = data;
      if (!classifierPipeline) {
        self.postMessage({ type: 'log', message: 'Loading MobileViT-XXSmall classifier...' });
        classifierPipeline = await pipeline('image-classification', 'Xenova/mobilevit-xx-small');
        self.postMessage({ type: 'log', message: 'MobileViT-XXSmall ready.' });
      }
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      canvas.getContext('2d').drawImage(bitmap, 0, 0);
      const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.88 });
      const url = URL.createObjectURL(blob);
      const results = await classifierPipeline(url, { topk: 5 });
      URL.revokeObjectURL(url);
      self.postMessage({ type: 'classify_result', requestId, results });
    } catch (err) {
      self.postMessage({ type: 'error', message: 'Classify failed: ' + err.message });
    }
  }

  // ── On-demand: depth estimation for spatial engine ──────────────────────────
  if (type === 'estimate_depth') {
    try {
      const { bitmap, requestId } = data;
      if (!depthPipeline) {
        self.postMessage({ type: 'log', message: 'Loading Depth Anything V2 Small (~99MB, first run only)...' });
        depthPipeline = await pipeline('depth-estimation', 'onnx-community/depth-anything-v2-small', {
          device: 'webgpu'  // Falls back to WASM automatically if WebGPU unavailable
        });
        self.postMessage({ type: 'log', message: 'Depth Anything V2 ready.' });
      }

      const w = bitmap.width, h = bitmap.height;
      const canvas = new OffscreenCanvas(w, h);
      canvas.getContext('2d').drawImage(bitmap, 0, 0);
      const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.85 });
      const url = URL.createObjectURL(blob);
      const { depth } = await depthPipeline(url);
      URL.revokeObjectURL(url);

      // Convert depth tensor to a normalized Float32Array
      const rawData = depth.data;
      const min = Math.min(...rawData);
      const max = Math.max(...rawData);
      const range = max - min || 1;
      const normalized = new Float32Array(rawData.length);
      for (let i = 0; i < rawData.length; i++) {
        normalized[i] = (rawData[i] - min) / range;
      }

      self.postMessage({
        type: 'depth_result',
        requestId,
        depthMap: { data: normalized, width: depth.width, height: depth.height }
      }, [normalized.buffer]);
    } catch (err) {
      self.postMessage({ type: 'error', message: 'Depth estimation failed: ' + err.message });
    }
  }
};

// ── Background YOLO loader ─────────────────────────────────────────────────────
async function _loadYolo(backend) {
  self.postMessage({ type: 'log', message: 'Loading YOLOv11-nano in background...' });
  // Use webgpu if available for best perf, wasm as safe fallback
  const device = backend === 'webgpu' ? 'webgpu' : 'wasm';
  yoloPipeline = await pipeline('object-detection', 'onnx-community/yolo11n', { device });
  yoloReady = true;
  self.postMessage({ type: 'yolo_ready', backend: device });
}
