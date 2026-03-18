const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const { ipcMain } = require('electron');
const logger = require('./logger');

let wss = null;
let latestVisionData = null;
let latestAudioData = null;

// File paths for resources
const PROFILE_DIR = path.join(__dirname, 'profile');
const MEMORIES_PATH = path.join(PROFILE_DIR, 'memories.md');
const STATUS_PATH = path.join(PROFILE_DIR, 'status.md');
const SKILLS_DIR = path.join(PROFILE_DIR, 'skills');

function initMcpServer() {
  wss = new WebSocket.Server({ port: 4141 });
  logger.log('MCP', 'Embedded MCP Server listening on ws://localhost:4141', logger.LOG_LEVELS.HIGH);

  wss.on('connection', (ws) => {
    logger.log('MCP', 'Agent connected via WebSocket', logger.LOG_LEVELS.HIGH);

    ws.on('message', async (data) => {
      try {
        const request = JSON.parse(data);
        handleRequest(ws, request);
      } catch (err) {
        logger.log('MCP', 'Failed to parse JSON-RPC: ' + err.message, logger.LOG_LEVELS.ERROR);
      }
    });
  });

  // Listen for vision updates from renderer
  ipcMain.on('broadcast-to-agents', (event, payload) => {
    latestVisionData = payload;
    broadcastNotification('notifications/perception/vision_update', {
      timestamp: Date.now(),
      frame_base64: payload.snapshot_jpeg_data_url || null,
      objects_detected: payload.detections.object_top.map(o => o.class),
      motion_index: payload.detections.opencv_contour_count > 5 ? 0.8 : 0.1
    });
  });

  // Listen for audio/STT updates from renderer
  ipcMain.on('voice-transcript', (event, payload) => {
    latestAudioData = payload;
    broadcastNotification('notifications/perception/audio_heard', {
      transcription: payload.text,
      confidence: payload.confidence || 1.0
    });
  });
}

function broadcastNotification(method, params) {
  if (!wss) return;
  const msg = JSON.stringify({
    jsonrpc: "2.0",
    method,
    params
  });
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
}

async function handleRequest(ws, req) {
  const { method, params, id } = req;

  // 1. Handshake
  if (method === 'initialize') {
    return sendResponse(ws, id, {
      protocolVersion: "2024-11-05",
      capabilities: {
        tools: { speak_tts: {} },
        resources: { subscribe: true }
      },
      serverInfo: { name: "eye-see-you-perception-engine", version: "0.5.1" }
    });
  }

  // 2. Resource Discovery
  if (method === 'resources/list') {
    return sendResponse(ws, id, {
      resources: [
        { uri: "file:///shared_memory/memories.md", name: "Persistent Memories", mimeType: "text/markdown" },
        { uri: "file:///shared_memory/status.md", name: "Hardware Status", mimeType: "text/markdown" }
      ]
    });
  }

  // 3. Tool Discovery
  if (method === 'tools/list') {
    return sendResponse(ws, id, {
      tools: [
        {
          name: "get_current_vision",
          description: "Get the latest detected objects, poses, and faces.",
          inputSchema: { type: "object", properties: {} }
        },
        {
          name: "speak_tts",
          description: "Speak text through the app's local voice engine.",
          inputSchema: {
            type: "object",
            properties: {
              text: { type: "string" },
              priority: { type: "string", enum: ["low", "high"] }
            },
            required: ["text"]
          }
        }
      ]
    });
  }

  // 4. Tool Execution
  if (method === 'tools/call') {
    const { name, arguments: args } = params;
    
    if (name === 'get_current_vision') {
      return sendResponse(ws, id, {
        content: [{ type: "text", text: JSON.stringify(latestVisionData || { status: "IDLE" }, null, 2) }]
      });
    }

    if (name === 'speak_tts') {
      // Forward to renderer to speak
      const win = require('electron').BrowserWindow.getAllWindows()[0];
      if (win) win.webContents.send('mcp-speak', args.text);
      
      return sendResponse(ws, id, {
        content: [{ type: "text", text: "TTS played successfully." }]
      });
    }
  }

  // Fallback for unknown methods
  sendResponse(ws, id, { error: { code: -32601, message: "Method not found" } });
}

function sendResponse(ws, id, result) {
  ws.send(JSON.stringify({
    jsonrpc: "2.0",
    id,
    result: result.error ? undefined : result,
    error: result.error || undefined
  }));
}

module.exports = { initMcpServer };
