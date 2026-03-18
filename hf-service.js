// hf-service.js - Hugging Face Inference Service
import { HfInference } from 'https://cdn.jsdelivr.net/npm/@huggingface/inference@2.7.0/+esm';

let hf = null;

export function initHf(apiKey) {
  if (!apiKey) return null;
  hf = new HfInference(apiKey);
  return hf;
}

export async function describeScene(imageBlob) {
  if (!hf) throw new Error("Hugging Face API key not set.");

  try {
    // Using vit-gpt2-image-captioning for a general description
    const description = await hf.imageToText({
      data: imageBlob,
      model: 'nlpconnect/vit-gpt2-image-captioning',
    });
    
    return description.generated_text;
  } catch (err) {
    console.error("HF Describe Error:", err);
    throw err;
  }
}

export async function detectCustomObjects(imageBlob, candidateLabels) {
  if (!hf) throw new Error("Hugging Face API key not set.");

  try {
    // Zero-shot object detection
    const results = await hf.zeroShotObjectDetection({
      data: imageBlob,
      model: 'google/owlvit-base-patch32',
      inputs: {
        candidate_labels: candidateLabels
      }
    });
    
    return results;
  } catch (err) {
    console.error("HF Detection Error:", err);
    throw err;
  }
}
