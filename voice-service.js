// voice-service.js - Local STT and TTS Service
let recognition = null;
let synthesis = window.speechSynthesis;
let isListening = false;

export function initVoice(onCommand) {
  if (!('webkitSpeechRecognition' in window)) {
    console.error("Web Speech API not supported in this browser.");
    return false;
  }

  recognition = new webkitSpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = false;
  recognition.lang = 'en-US';

  recognition.onresult = (event) => {
    const transcript = event.results[event.results.length - 1][0].transcript.trim().toLowerCase();
    console.log("Voice Transcript:", transcript);
    onCommand(transcript);
  };

  recognition.onerror = (err) => {
    console.error("Speech Recognition Error:", err);
  };

  recognition.onend = () => {
    if (isListening) recognition.start(); // Keep listening if we should be
  };

  return true;
}

export function startListening() {
  if (!recognition) return;
  isListening = true;
  recognition.start();
}

export function stopListening() {
  if (!recognition) return;
  isListening = false;
  recognition.stop();
}

export function speak(text) {
  if (!synthesis) return;
  
  // Cancel any ongoing speech
  synthesis.cancel();
  
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1.0;
  utterance.pitch = 1.0;
  synthesis.speak(utterance);
}
