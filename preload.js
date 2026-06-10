const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // ── Core ──────────────────────────────────────────────────────────────────
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  setLogLevel: (level) => ipcRenderer.invoke('set-log-level', level),
  logToFile: (data) => ipcRenderer.send('log-to-file', data),

  // ── Raw Telemetry Broadcast (Port 1337) ───────────────────────────────────
  broadcastToAgents: (payload) => ipcRenderer.send('broadcast-to-agents', payload),

  // ── MCP Bridge Status ──────────────────────────────────────────────────────
  getBridgeStatus: () => ipcRenderer.invoke('get-bridge-status'),

  // ── Scene Graph ────────────────────────────────────────────────────────────
  updateSceneGraph: (sceneGraph) => ipcRenderer.send('scene-graph-update', sceneGraph),

  // ── Object Memory (snapshot capture) ──────────────────────────────────────
  onRequestObjectSnapshot: (callback) => ipcRenderer.on('request-object-snapshot', (event, data) => callback(data)),
  sendObjectSnapshotResult: (result) => ipcRenderer.send('object-snapshot-result', result),

  // ── Voice & TTS IPC ────────────────────────────────────────────────────────
  sendVoiceTranscript: (payload) => ipcRenderer.send('voice-transcript', payload),
  onMcpSpeak: (callback) => ipcRenderer.on('mcp-speak', (event, text) => callback(text)),

  // ── AI Describe ────────────────────────────────────────────────────────────
  onTriggerAiDescribe: (callback) => ipcRenderer.on('trigger-ai-describe', callback),
  sendAiDescriptionResult: (result) => ipcRenderer.send('ai-description-result', result),
});
