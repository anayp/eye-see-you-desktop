# eye-see-you Desktop (Perception Engine)

A cross-platform desktop application (Windows, macOS, Linux) designed to give "eyes" to CLI agents and robotic hardware.

## Core Mission
To provide an **Autonomous OS for Physical Assistance**—a high-performance, native perception bridge that translates real-time camera data into a "Shared Nervous System" for AI agents to assist people with disabilities.

## Technology Stack
- **Shell:** Electron (Node.js + Chromium)
- **Computer Vision:** TensorFlow.js (with Node-GPU acceleration) & OpenCV.js
- **Bridge:** Local WebSocket Server & Embedded MCP Server (Port 4141)
- **Intelligence Hub:** Multi-Agent Switcher (Gemini, OpenAI, Claude, Perplexity, etc.)
- **Shared Memory:** Unified Profile Hub (`memories.md`, `skills/`, `status.md`)
- **Primary Target:** People with disabilities needing quick environmental descriptions, and augmented CLI agents controlling hardware.

## Features
- **Plug-and-Play Brains:** Gemini comes pre-installed. Switch to OpenAI, Claude, or Perplexity at any time.
- **Shared Nervous System:** All agents share a persistent memory and skill library. No context is lost when switching "brains."
- **Token Status Bar:** Real-time tracking of usage, plans, and rate limits to ensure reliable assistance.
- **Portable Sandbox:** Bundled Node.js environment ensures "Zero-Hassle" setup with no system-wide installations.
- **Embedded Terminal:** High-performance sandboxed CLI interface.
- **Hands-Free:** Local Voice activation (STT) and audible scene descriptions (TTS).
- **Zero-Config MCP:** Automatically exposes "eyes" to any connected agent.

