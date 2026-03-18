import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSETS_DIR = path.join(__dirname, '..', 'local-models');

const ASSETS = [
  // Runtimes
  { name: 'tf.min.js', url: 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.20.0/dist/tf.min.js' },
  { name: 'tf-backend-wasm.min.js', url: 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-wasm@4.20.0/dist/tf-backend-wasm.min.js' },
  { name: 'coco-ssd.js', url: 'https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd' },
  { name: 'opencv.js', url: 'https://cdn.jsdelivr.net/npm/@techstark/opencv-js@4.12.0-release.1/dist/opencv.js' },
  { name: 'xterm.js', url: 'https://cdn.jsdelivr.net/npm/xterm@5.3.0/lib/xterm.js' },
  { name: 'xterm.css', url: 'https://cdn.jsdelivr.net/npm/xterm@5.3.0/css/xterm.css' },
  
  // MediaPipe Runtimes (Basic)
  { name: 'hands.js', url: 'https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js' },
  { name: 'face_mesh.js', url: 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js' },
  { name: 'selfie_segmentation.js', url: 'https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/selfie_segmentation.js' }
];

async function downloadFile(url, dest) {
  if (fs.existsSync(dest)) {
    console.log(`skipping ${path.basename(dest)} (exists)`);
    return;
  }
  return new Promise((resolve, reject) => {
    console.log(`downloading ${url} ...`);
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download ${url}: ${response.statusCode}`));
        return;
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

async function run() {
  if (!fs.existsSync(ASSETS_DIR)) fs.mkdirSync(ASSETS_DIR, { recursive: true });

  console.log('--- Sprint 7: Downloading Models & Runtimes ---');
  for (const asset of ASSETS) {
    try {
      await downloadFile(asset.url, path.join(ASSETS_DIR, asset.name));
    } catch (e) {
      console.error(`Error downloading ${asset.name}: ${e.message}`);
    }
  }
  console.log('--- All primary assets downloaded to local-models/ ---');
}

run();
