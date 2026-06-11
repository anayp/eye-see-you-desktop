const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const WebSocket = require('ws');
const logger = require('./logger');
const mcp = require('./mcp-server');

let mainWindow;
let wss; // Port 1337 — raw broadcast bridge (legacy telemetry)

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    backgroundColor: '#050607',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  mainWindow.loadFile('index.html');
}

// ─── Raw Broadcast Bridge (Port 1337) ────────────────────────────────────────
// Lightweight one-way telemetry channel — forwards detection packets to any
// listener. Agents should prefer the full MCP bridge on Port 4141.
function startBridge() {
  wss = new WebSocket.Server({ port: 1337 });
  logger.log('BRIDGE', 'Raw Telemetry Bridge active on ws://localhost:1337', logger.LOG_LEVELS.HIGH);

  wss.on('connection', (ws) => {
    logger.log('BRIDGE', 'Client connected to raw telemetry bridge.', logger.LOG_LEVELS.HIGH);
    ws.send(JSON.stringify({
      type: 'welcome',
      message: 'eye-see-you Raw Telemetry Bridge',
      hint: 'For full two-way agent protocol, connect to ws://localhost:4141 (MCP bridge)',
      timestamp: new Date().toISOString()
    }));

    ws.on('message', (data) => {
      logger.log('BRIDGE', `Telemetry client msg: ${data.toString().slice(0, 120)}`, logger.LOG_LEVELS.MAMA);
    });
  });
}

// ─── App Lifecycle ────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  logger.initLogger();
  // Ensure profile directories exist
  const profileDir = path.join(app.getPath('userData'), 'profile');
  const objectsDir = path.join(profileDir, 'objects');
  [profileDir, objectsDir].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });

  createWindow();
  startBridge();
  mcp.initMcpServer();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ─── IPC: File Logging ────────────────────────────────────────────────────────
ipcMain.handle('set-log-level', (event, level) => {
  logger.setLogLevel(level);
});

ipcMain.on('log-to-file', (event, { module, message, level }) => {
  logger.log(module, message, level);
});

// ─── IPC: Raw Telemetry Broadcast (Port 1337) ─────────────────────────────────
ipcMain.on('broadcast-to-agents', (event, payload) => {
  if (!wss) return;
  const data = JSON.stringify(payload);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) client.send(data);
  });
  logger.log('BRIDGE', `Broadcasted telemetry to ${wss.clients.size} listeners.`, logger.LOG_LEVELS.MAMA);
});

// ─── IPC: Bridge Status (for the UI dashboard) ───────────────────────────────
ipcMain.handle('get-bridge-status', () => {
  const mcpAgents = mcp.getConnectedAgents();
  const rawListeners = wss ? wss.clients.size : 0;
  return {
    mcpPort: 4141,
    rawPort: 1337,
    mcpAgents,
    rawListeners,
    connectString: 'ws://localhost:4141'
  };
});

// ─── IPC: Object Memory (called by mcp-server to send capture request) ───────
ipcMain.handle('capture-object-snapshot', async (event, { label, bbox }) => {
  const win = BrowserWindow.getAllWindows()[0];
  if (!win) return null;
  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(null), 5000);
    ipcMain.once('object-snapshot-result', (evt, result) => {
      clearTimeout(timeout);
      resolve(result);
    });
    win.webContents.send('request-object-snapshot', { label, bbox });
  });
});

// ─── IPC: Scene Graph Update (renderer → main → MCP) ────────────────────────
ipcMain.on('scene-graph-update', (event, sceneGraph) => {
  mcp.updateSceneGraph(sceneGraph);
});

// ─── IPC: App Version ────────────────────────────────────────────────────────
ipcMain.handle('get-app-version', () => app.getVersion());
