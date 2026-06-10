# eye-see-you Desktop — Perception Engine

> **v0.9.0** · An open, keyless perception bridge that gives any AI agent real eyes.

A cross-platform Electron desktop app (Windows, macOS, Linux) designed to give real-time computer vision to any CLI agent or robotic hardware — **without bundling any API key**.

---

## Core Mission

To provide an **Autonomous OS for Physical Assistance** — a high-performance, native perception bridge that translates real-time camera data into a "Shared Nervous System" for AI agents to assist people with disabilities.

---

## How It Works

```
Your Camera → eye-see-you → ws://localhost:4141 (MCP) → Your Agent (Claude / GPT / Gemini / etc.)
```

The app runs a local MCP server. Any agent connects with its **own** API key. The app has no key and requires none. It is purely the perception + memory layer.

---

## Technology Stack

| Layer | Technology |
|---|---|
| Shell | Electron 31 (Node.js + Chromium) |
| Computer Vision | TensorFlow.js · OpenCV.js · YOLOv11-nano · Depth Anything V2 |
| Agent Bridge | WebSocket JSON-RPC 2.0 · MCP Protocol (Port 4141) |
| Spatial Engine | JSON scene graph · Perspective grid · GPS outdoor mode |
| Object Memory | `profile/objects/*.json` · JPEG snapshots · Anchor matching |
| Models | COCO-SSD · YOLOv11n · MobileViT-XXSmall · Depth Anything V2 Small |

---

## Features

### 🔓 Open Agent Bridge (No Key Required)
Connect **any** agent to `ws://localhost:4141` using the MCP protocol. The app broadcasts live perception data and exposes tools the agent can call. Click the hexagon icon (⬡) in the top bar to open the Bridge Dashboard and copy the connect string.

### 🗺️ Spatial Scene Graph
A live JSON 3-D map of the room, updated every 2 seconds. Surfaces (floor, table) are inferred from object clustering and frame geometry. Each detected object is assigned to a surface with a `grid_cell: { col, row }` coordinate. Persisted to `profile/scene_graph.json`.

### 🧠 Object Memory
Ask your agent to **"remember my keys"** — it calls `remember_object`, which saves:
- A cropped JPEG snapshot
- The surface + grid cell coordinates
- Nearby stable objects as spatial anchors
- GPS coordinates (in outdoor mode)

Later, **"where are my keys?"** calls `locate_object` and gets a natural-language location report comparing stored memory against the current live scene.

### 👁️ Multi-Mode Detection
| Mode | Model | Notes |
|---|---|---|
| Object Detection | YOLOv11-nano (primary) · COCO-SSD (fallback) | WebGPU · WASM-safe |
| Pose Estimation | BlazePose | |
| Hand Tracking | MediaPipe Hands | |
| Face Landmarks | MediaPipe FaceMesh | |
| Segmentation | MediaPipe Selfie | |
| Edge Detection | OpenCV.js Canny | |
| Depth Map | Depth Anything V2 Small | On-demand |
| Classification | MobileViT-XXSmall | On-demand snapshots |

### 🎙️ Voice Control
Hands-free commands: *"describe"*, *"find [object]"*, *"remember my [item]"*, *"where is my [item]"*, *"start camera"*.

---

## MCP Tools (for connected agents)

| Tool | Description |
|---|---|
| `get_current_vision` | Latest detection snapshot (objects, poses, faces) |
| `get_scene_graph` | Full spatial map — surfaces, grid positions, anchors |
| `remember_object` | Save a named object's location + snapshot |
| `locate_object` | Find a remembered object, compare to live scene |
| `speak_tts` | Speak text through the app's voice engine |
| `set_context` | Push agent identity to the Bridge Dashboard |

---

## Quick Start

```bash
git clone https://github.com/anayp/eye-see-you-desktop.git
cd eye-see-you-desktop
npm install
npm start
```

Then connect any agent:
```
ws://localhost:4141
```

---

## Building

```bash
# Unpacked (fastest, for local use)
npx electron-builder --win dir

# Full installer
npm run build:win
```

---

## Profile Structure

```
profile/
  memories.md          ← Persistent agent notes
  status.md            ← Hardware/capability status
  scene_graph.json     ← Latest spatial map (auto-updated)
  objects/
    keys.json          ← Saved memory for "keys"
    wallet.json        ← Saved memory for "wallet"
    ...
```
