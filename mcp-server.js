/**
 * eye-see-you MCP Server — Port 4141
 *
 * Full two-way Agent Bridge Protocol (ABP) over WebSocket + JSON-RPC 2.0.
 * No API keys bundled. Any agent connects, announces itself, and uses the tools.
 *
 * Exposed Tools:
 *   get_current_vision   – Latest detection data snapshot
 *   get_scene_graph      – Full spatial map (surfaces, objects, grid positions)
 *   remember_object      – Save a named object's spatial snapshot to profile/objects/
 *   locate_object        – Retrieve a stored memory and compare with current graph
 *   speak_tts            – Send text to the app's voice engine
 *   set_context          – Agent pushes its own identity/state metadata
 */

const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const { app, ipcMain } = require('electron');
const logger = require('./logger');

// ── State ──────────────────────────────────────────────────────────────────────
let wss = null;
let latestVisionData = null;
let latestAudioData = null;
let latestSceneGraph = null;

// Per-connection agent metadata map: ws → { agent_name, connected_at, session_id }
const agentMeta = new WeakMap();

// ── File Paths ─────────────────────────────────────────────────────────────────
let PROFILE_DIR, MEMORIES_PATH, STATUS_PATH, OBJECTS_DIR, SCENE_GRAPH_PATH;

function initPaths() {
  if (PROFILE_DIR) return;
  const userDataPath = app ? app.getPath('userData') : __dirname;
  PROFILE_DIR = path.join(userDataPath, 'profile');
  MEMORIES_PATH = path.join(PROFILE_DIR, 'memories.md');
  STATUS_PATH = path.join(PROFILE_DIR, 'status.md');
  OBJECTS_DIR = path.join(PROFILE_DIR, 'objects');
  SCENE_GRAPH_PATH = path.join(PROFILE_DIR, 'scene_graph.json');
}

function ensureDirs() {
  initPaths();
  [PROFILE_DIR, OBJECTS_DIR].forEach(d => {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  });
}

// ── Public API ─────────────────────────────────────────────────────────────────

function initMcpServer() {
  ensureDirs();
  wss = new WebSocket.Server({ port: 4141 });
  logger.log('MCP', 'Agent Bridge Protocol (ABP) listening on ws://localhost:4141', logger.LOG_LEVELS.HIGH);

  wss.on('connection', (ws, req) => {
    const connectedAt = new Date().toISOString();
    agentMeta.set(ws, { agent_name: 'anonymous', connected_at: connectedAt, session_id: null });
    logger.log('MCP', `Agent connected from ${req.socket.remoteAddress}`, logger.LOG_LEVELS.HIGH);

    // Notify renderer to update the bridge dashboard
    _notifyBridgeStatusChange();

    ws.on('message', async (data) => {
      try {
        const request = JSON.parse(data);
        await handleRequest(ws, request);
      } catch (err) {
        logger.log('MCP', 'Failed to parse JSON-RPC: ' + err.message, logger.LOG_LEVELS.ERROR);
        ws.send(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }));
      }
    });

    ws.on('close', () => {
      logger.log('MCP', `Agent disconnected: ${agentMeta.get(ws)?.agent_name || 'unknown'}`, logger.LOG_LEVELS.HIGH);
      agentMeta.delete(ws);
      _notifyBridgeStatusChange();
    });
  });

  // ── IPC Listeners from renderer ──────────────────────────────────────────────
  ipcMain.on('broadcast-to-agents', (event, payload) => {
    latestVisionData = payload;
    broadcastNotification('notifications/perception/vision_update', {
      timestamp: Date.now(),
      frame_base64: payload.snapshot_jpeg_data_url || null,
      objects_detected: (payload.detections?.object_top || []).map(o => o.class),
      motion_index: (payload.detections?.opencv_contour_count || 0) > 5 ? 0.8 : 0.1
    });
  });

  ipcMain.on('voice-transcript', (event, payload) => {
    latestAudioData = payload;
    broadcastNotification('notifications/perception/audio_heard', {
      transcription: payload.text,
      confidence: payload.confidence || 1.0
    });
  });

  ipcMain.on('scene-graph-update', (event, sceneGraph) => {
    updateSceneGraph(sceneGraph);
  });
}

/** Called from main.js to push scene graph updates received from renderer */
function updateSceneGraph(sceneGraph) {
  initPaths();
  latestSceneGraph = sceneGraph;
  // Persist to disk on meaningful updates (non-blocking)
  if (sceneGraph) {
    fs.writeFile(SCENE_GRAPH_PATH, JSON.stringify(sceneGraph, null, 2), () => {});
  }
}

/** Returns a serializable list of connected agents for the UI bridge dashboard */
function getConnectedAgents() {
  if (!wss) return [];
  const agents = [];
  wss.clients.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) {
      const meta = agentMeta.get(ws) || {};
      agents.push({
        agent_name: meta.agent_name || 'anonymous',
        connected_at: meta.connected_at,
        session_id: meta.session_id
      });
    }
  });
  return agents;
}

// ── Internal Helpers ──────────────────────────────────────────────────────────

function broadcastNotification(method, params) {
  if (!wss) return;
  const msg = JSON.stringify({ jsonrpc: '2.0', method, params });
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) client.send(msg);
  });
}

function _notifyBridgeStatusChange() {
  // Attempt to notify renderer via BrowserWindow if available
  try {
    const { BrowserWindow } = require('electron');
    const win = BrowserWindow.getAllWindows()[0];
    if (win) win.webContents.send('bridge-status-changed');
  } catch (_) {}
}

function sendResponse(ws, id, result) {
  if (result && result.error) {
    ws.send(JSON.stringify({ jsonrpc: '2.0', id, error: result.error }));
  } else {
    ws.send(JSON.stringify({ jsonrpc: '2.0', id, result }));
  }
}

// ── Request Router ─────────────────────────────────────────────────────────────

async function handleRequest(ws, req) {
  const { method, params, id } = req;

  // ── 1. Handshake ──────────────────────────────────────────────────────────
  if (method === 'initialize') {
    const meta = agentMeta.get(ws) || {};
    meta.agent_name = params?.agent || params?.clientInfo?.name || 'anonymous';
    meta.session_id = params?.session_id || null;
    agentMeta.set(ws, meta);
    logger.log('MCP', `Agent identified: ${meta.agent_name}`, logger.LOG_LEVELS.HIGH);
    _notifyBridgeStatusChange();

    return sendResponse(ws, id, {
      protocolVersion: '2024-11-05',
      capabilities: {
        tools: {},
        resources: { subscribe: true },
        notifications: { vision_update: true, audio_heard: true }
      },
      serverInfo: {
        name: 'eye-see-you-perception-engine',
        version: '0.9.0',
        connectString: 'ws://localhost:4141',
        hint: 'No API key required. Connect and use tools freely.'
      }
    });
  }

  // ── 2. Resource Discovery ─────────────────────────────────────────────────
  if (method === 'resources/list') {
    return sendResponse(ws, id, {
      resources: [
        { uri: 'file:///shared_memory/memories.md', name: 'Persistent Memories', mimeType: 'text/markdown' },
        { uri: 'file:///shared_memory/status.md', name: 'Hardware Status', mimeType: 'text/markdown' },
        { uri: 'file:///shared_memory/scene_graph.json', name: 'Spatial Scene Graph', mimeType: 'application/json' }
      ]
    });
  }

  if (method === 'resources/read') {
    initPaths();
    const uri = params?.uri || '';
    if (uri.includes('memories')) {
      const content = fs.existsSync(MEMORIES_PATH) ? fs.readFileSync(MEMORIES_PATH, 'utf8') : '';
      return sendResponse(ws, id, { contents: [{ uri, mimeType: 'text/markdown', text: content }] });
    }
    if (uri.includes('status')) {
      const content = fs.existsSync(STATUS_PATH) ? fs.readFileSync(STATUS_PATH, 'utf8') : '';
      return sendResponse(ws, id, { contents: [{ uri, mimeType: 'text/markdown', text: content }] });
    }
    if (uri.includes('scene_graph')) {
      const graph = latestSceneGraph || (fs.existsSync(SCENE_GRAPH_PATH) ? JSON.parse(fs.readFileSync(SCENE_GRAPH_PATH, 'utf8')) : null);
      return sendResponse(ws, id, { contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(graph, null, 2) }] });
    }
    return sendResponse(ws, id, { error: { code: -32602, message: 'Unknown resource URI' } });
  }

  // ── 3. Tool Discovery ─────────────────────────────────────────────────────
  if (method === 'tools/list') {
    return sendResponse(ws, id, {
      tools: [
        {
          name: 'get_current_vision',
          description: 'Get the latest detection snapshot: objects, poses, faces, and scene metrics.',
          inputSchema: { type: 'object', properties: {} }
        },
        {
          name: 'get_scene_graph',
          description: 'Get the full spatial scene graph: detected surfaces, their grid coordinates, and all objects anchored to them. Use this to understand where things are in 3D space.',
          inputSchema: { type: 'object', properties: {} }
        },
        {
          name: 'remember_object',
          description: 'Save a named object\'s current location with spatial context (surface, grid cell, nearby anchors, snapshot). Use when user says "remember where my X is".',
          inputSchema: {
            type: 'object',
            properties: {
              label: { type: 'string', description: 'Human name for the object, e.g. "keys", "wallet", "medicine"' },
              bbox_hint: {
                type: 'array',
                description: 'Optional [x, y, w, h] normalized bbox to crop the object for the snapshot',
                items: { type: 'number' }
              }
            },
            required: ['label']
          }
        },
        {
          name: 'locate_object',
          description: 'Look up a previously remembered object and compare its last known location against the current scene. Returns a natural-language location summary.',
          inputSchema: {
            type: 'object',
            properties: {
              label: { type: 'string', description: 'The label used when calling remember_object' }
            },
            required: ['label']
          }
        },
        {
          name: 'speak_tts',
          description: 'Speak text through the app\'s local TTS voice engine.',
          inputSchema: {
            type: 'object',
            properties: {
              text: { type: 'string' },
              priority: { type: 'string', enum: ['low', 'high'] }
            },
            required: ['text']
          }
        },
        {
          name: 'set_context',
          description: 'Let the agent push its own identity and session metadata to the app for display in the bridge dashboard.',
          inputSchema: {
            type: 'object',
            properties: {
              agent_name: { type: 'string' },
              model: { type: 'string' },
              session_id: { type: 'string' },
              notes: { type: 'string' }
            }
          }
        }
      ]
    });
  }

  // ── 4. Tool Execution ─────────────────────────────────────────────────────
  if (method === 'tools/call') {
    const { name, arguments: args } = params;

    // get_current_vision
    if (name === 'get_current_vision') {
      return sendResponse(ws, id, {
        content: [{ type: 'text', text: JSON.stringify(latestVisionData || { status: 'IDLE', hint: 'Enable a detection mode in the app.' }, null, 2) }]
      });
    }

    // get_scene_graph
    if (name === 'get_scene_graph') {
      initPaths();
      const graph = latestSceneGraph
        || (fs.existsSync(SCENE_GRAPH_PATH) ? JSON.parse(fs.readFileSync(SCENE_GRAPH_PATH, 'utf8')) : null)
        || { status: 'NO_GRAPH', hint: 'Scene graph is not yet initialized. The spatial engine activates after a few seconds of camera operation.' };
      return sendResponse(ws, id, {
        content: [{ type: 'text', text: JSON.stringify(graph, null, 2) }]
      });
    }

    // remember_object
    if (name === 'remember_object') {
      const label = (args?.label || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
      if (!label) {
        return sendResponse(ws, id, { error: { code: -32602, message: 'label is required' } });
      }

      try {
        const result = await _rememberObject(label, args?.bbox_hint || null);
        return sendResponse(ws, id, {
          content: [{ type: 'text', text: result.summary }],
          memory_record: result.record
        });
      } catch (err) {
        return sendResponse(ws, id, { error: { code: -32603, message: 'remember_object failed: ' + err.message } });
      }
    }

    // locate_object
    if (name === 'locate_object') {
      const label = (args?.label || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
      if (!label) {
        return sendResponse(ws, id, { error: { code: -32602, message: 'label is required' } });
      }

      try {
        const result = _locateObject(label);
        return sendResponse(ws, id, {
          content: [{ type: 'text', text: result.summary }],
          stored_record: result.record,
          current_scene: result.currentMatches
        });
      } catch (err) {
        return sendResponse(ws, id, { error: { code: -32603, message: 'locate_object failed: ' + err.message } });
      }
    }

    // speak_tts
    if (name === 'speak_tts') {
      const { BrowserWindow } = require('electron');
      const win = BrowserWindow.getAllWindows()[0];
      if (win) win.webContents.send('mcp-speak', args.text);
      return sendResponse(ws, id, { content: [{ type: 'text', text: 'TTS dispatched.' }] });
    }

    // set_context
    if (name === 'set_context') {
      const meta = agentMeta.get(ws) || {};
      if (args?.agent_name) meta.agent_name = args.agent_name;
      if (args?.session_id) meta.session_id = args.session_id;
      if (args?.model) meta.model = args.model;
      if (args?.notes) meta.notes = args.notes;
      agentMeta.set(ws, meta);
      _notifyBridgeStatusChange();
      logger.log('MCP', `Agent context updated: ${JSON.stringify(meta)}`, logger.LOG_LEVELS.HIGH);
      return sendResponse(ws, id, { content: [{ type: 'text', text: 'Context updated. Dashboard refreshed.' }] });
    }

    return sendResponse(ws, id, { error: { code: -32601, message: `Unknown tool: ${name}` } });
  }

  // Fallback
  sendResponse(ws, id, { error: { code: -32601, message: `Method not found: ${method}` } });
}

// ── Object Memory Implementation ───────────────────────────────────────────────

async function _rememberObject(label, bboxHint) {
  ensureDirs();

  // 1. Request snapshot from renderer
  let snapshotDataUrl = null;
  try {
    const { BrowserWindow, ipcMain: ipc } = require('electron');
    const win = BrowserWindow.getAllWindows()[0];
    if (win) {
      snapshotDataUrl = await new Promise((resolve) => {
        const timeout = setTimeout(() => resolve(null), 5000);
        ipc.once('object-snapshot-result', (evt, result) => {
          clearTimeout(timeout);
          resolve(result?.dataUrl || null);
        });
        win.webContents.send('request-object-snapshot', { label, bbox: bboxHint });
      });
    }
  } catch (err) {
    logger.log('MCP', 'Snapshot capture failed: ' + err.message, logger.LOG_LEVELS.ERROR);
  }

  // 2. Read current scene graph for spatial context
  const graph = latestSceneGraph || null;
  let sceneContext = { surface: null, grid_cell: null, nearby_objects: [], room_anchor: null, gps: null };
  let dominantColors = [];

  if (graph && graph.objects && bboxHint) {
    // Find the closest object in the scene graph to the provided bbox
    const [bx, by, bw, bh] = bboxHint;
    const bcx = bx + bw / 2, bcy = by + bh / 2;
    let closest = null, minDist = Infinity;
    for (const obj of (graph.objects || [])) {
      const [ox, oy, ow, oh] = obj.bbox_screen || [0, 0, 0, 0];
      const ocx = (ox + ow / 2) / (graph.camera?.width || 1);
      const ocy = (oy + oh / 2) / (graph.camera?.height || 1);
      const d = Math.hypot(bcx - ocx, bcy - ocy);
      if (d < minDist) { minDist = d; closest = obj; }
    }
    if (closest) {
      sceneContext.surface = closest.surface_id || null;
      sceneContext.grid_cell = closest.grid_cell || null;
    }

    // Nearby stable anchors
    sceneContext.nearby_objects = (graph.spatial_anchors || []).slice(0, 4).map(a => a.class || a.id);
    sceneContext.room_anchor = graph.room_id || null;
    sceneContext.gps = graph.gps || null;
  } else if (graph) {
    sceneContext.room_anchor = graph.room_id || null;
    sceneContext.nearby_objects = (graph.spatial_anchors || []).slice(0, 4).map(a => a.class || a.id);
    sceneContext.gps = graph.gps || null;
  }

  // 3. Build and write memory record
  const record = {
    label,
    saved_at: new Date().toISOString(),
    snapshot_jpeg: snapshotDataUrl,
    scene_context: sceneContext,
    visual_descriptors: {
      dominant_colors: dominantColors,
      bbox_normalized: bboxHint || null
    }
  };

  const filePath = path.join(OBJECTS_DIR, `${label}.json`);
  fs.writeFileSync(filePath, JSON.stringify(record, null, 2), 'utf8');
  logger.log('MCP', `Object memory saved: ${filePath}`, logger.LOG_LEVELS.HIGH);

  // 4. Build human-readable summary
  let summary = `✓ Saved memory for "${label}".`;
  if (sceneContext.surface) summary += ` Last seen on ${sceneContext.surface}`;
  if (sceneContext.grid_cell) summary += ` at grid cell [col ${sceneContext.grid_cell.col}, row ${sceneContext.grid_cell.row}]`;
  if (sceneContext.nearby_objects.length) summary += `, near: ${sceneContext.nearby_objects.join(', ')}`;
  if (sceneContext.gps) summary += ` (GPS: ${sceneContext.gps.lat?.toFixed(5)}, ${sceneContext.gps.lng?.toFixed(5)})`;
  summary += '.';

  return { record, summary };
}

function _locateObject(label) {
  initPaths();
  const filePath = path.join(OBJECTS_DIR, `${label}.json`);
  if (!fs.existsSync(filePath)) {
    return {
      record: null,
      currentMatches: [],
      summary: `I don't have any saved memory for "${label}". Ask me to remember it first.`
    };
  }

  const record = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const ctx = record.scene_context || {};

  // Compare with current scene graph
  const graph = latestSceneGraph;
  let currentMatches = [];
  let currentlyVisible = false;

  if (graph && graph.objects) {
    // Check if label appears in current detections
    currentMatches = graph.objects.filter(o =>
      (o.class || '').toLowerCase().includes(label.replace(/_/g, ' '))
    );
    currentlyVisible = currentMatches.length > 0;
  }

  // Build a human-readable location report
  const savedAt = record.saved_at ? new Date(record.saved_at).toLocaleString() : 'unknown time';
  let summary = `"${label}" was last remembered at ${savedAt}. `;

  if (ctx.surface) summary += `It was on ${ctx.surface}`;
  if (ctx.grid_cell) summary += ` at grid position [col ${ctx.grid_cell.col}, row ${ctx.grid_cell.row}]`;
  if (ctx.nearby_objects?.length) summary += `, near: ${ctx.nearby_objects.join(', ')}`;
  if (ctx.room_anchor) summary += ` (room: ${ctx.room_anchor})`;
  if (ctx.gps) summary += ` (GPS: ${ctx.gps.lat?.toFixed(5)}, ${ctx.gps.lng?.toFixed(5)})`;
  summary += '. ';

  if (currentlyVisible) {
    summary += `I can currently see something that matches "${label}" in the live view.`;
  } else if (graph) {
    // Check if the anchor objects are still visible
    const visibleAnchors = (ctx.nearby_objects || []).filter(anchor =>
      (graph.objects || []).some(o => (o.class || '').toLowerCase().includes(anchor.toLowerCase())) ||
      (graph.spatial_anchors || []).some(a => (a.class || '').toLowerCase().includes(anchor.toLowerCase()))
    );
    if (visibleAnchors.length) {
      summary += `I can see ${visibleAnchors.join(' and ')} right now, which are nearby anchors — so you're probably looking in the right area.`;
    } else {
      summary += `I cannot currently see "${label}" or its nearby anchors in the live view.`;
    }
  }

  return { record, currentMatches, summary };
}

module.exports = { initMcpServer, updateSceneGraph, getConnectedAgents };
