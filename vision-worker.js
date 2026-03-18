// vision-worker.js - Off-thread Perception Engine
import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2';

// Configure environment for local models in future, for now use CDN for weights
env.allowLocalModels = false; 

let tf = null;
let cocoModel = null;
let detectorPipeline = null;

self.onmessage = async (e) => {
  const { type, data } = e.data;

  if (type === 'init') {
    try {
      // 1. Initialize TF.js (Legacy/Fast path)
      importScripts('local-models/tf.min.js');
      importScripts('local-models/tf-backend-wasm.min.js');
      importScripts('local-models/coco-ssd.js');
      
      tf = self.tf;
      let backend = 'webgl';
      try {
        await tf.setBackend('webgpu');
        backend = 'webgpu';
      } catch (e) {
        try {
          await tf.setBackend('wasm');
          backend = 'wasm';
        } catch (e2) {
          await tf.setBackend('webgl');
          backend = 'webgl';
        }
      }
      await tf.ready();
      cocoModel = await self.cocoSsd.load({ base: 'lite_mobilenet_v2' });

      // 2. Initialize Transformers.js (High-IQ path)
      // We load the OWL-ViT model for zero-shot detection
      detectorPipeline = await pipeline('zero-shot-object-detection', 'Xenova/owlvit-base-patch32');
      
      self.postMessage({ type: 'ready', backend, hasHighIQ: true });
    } catch (err) {
      self.postMessage({ type: 'error', message: err.message });
    }
  }

  if (type === 'predict') {
    if (!cocoModel) return;
    
    try {
      const { bitmap, threshold, maxBoxes, customLabels } = data;
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(bitmap, 0, 0);
      
      // Fast path: COCO-SSD
      const tensor = tf.browser.fromPixels(bitmap);
      const cocoPredictions = await cocoModel.detect(tensor, maxBoxes, threshold);
      tensor.dispose();

      // High-IQ path: Transformers.js (if labels provided)
      let customPredictions = [];
      if (customLabels && customLabels.length > 0 && detectorPipeline) {
        const blob = await canvas.convertToBlob({ type: 'image/jpeg' });
        const url = URL.createObjectURL(blob);
        const results = await detectorPipeline(url, customLabels, { threshold });
        URL.revokeObjectURL(url);
        
        customPredictions = results.map(r => ({
          class: r.label,
          score: r.score,
          bbox: [r.box.xmin, r.box.ymin, r.box.xmax - r.box.xmin, r.box.ymax - r.box.ymin],
          source: 'high-iq'
        }));
      }
      
      self.postMessage({ 
        type: 'results', 
        predictions: [...cocoPredictions, ...customPredictions] 
      });
    } catch (err) {
      self.postMessage({ type: 'error', message: err.message });
    }
  }
};
