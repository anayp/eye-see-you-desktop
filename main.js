const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const WebSocket = require('ws');
const logger = require('./logger');
const mcp = require('./mcp-server');

let mainWindow;
let wss;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    backgroundColor: '#050607',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  mainWindow.loadFile('index.html');
}

// Initialize Local WebSocket Bridge
function startBridge() {
  wss = new WebSocket.Server({ port: 1337 });
  logger.log('BRIDGE', 'Perception Bridge active on ws://localhost:1337', logger.LOG_LEVELS.HIGH);

  wss.on('connection', (ws) => {
    logger.log('BRIDGE', 'CLI Agent connected to Perception Bridge.', logger.LOG_LEVELS.HIGH);
    
    ws.send(JSON.stringify({ 
      type: 'welcome', 
      message: 'Hello from Eye-See-You Desktop',
      timestamp: new Date().toISOString()
    }));

    ws.on('message', (data) => {
      logger.log('BRIDGE', `Received from Agent: ${data.toString()}`, logger.LOG_LEVELS.MAMA);
    });
  });
}

app.whenReady().then(() => {
  logger.initLogger();
  createWindow();
  startBridge();
  mcp.initMcpServer();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

const { spawn } = require('child_process');

// CLI Process Management
let cliProcess = null;

ipcMain.on('start-cli', (event, { command, args, cwd }) => {
  if (cliProcess) {
    cliProcess.kill();
  }

  // Use the portable sandbox paths
  const binDir = path.join(__dirname, 'bin');
  const nodeExe = process.platform === 'win32' ? path.join(binDir, 'node', 'node.exe') : path.join(binDir, 'node', 'node');
  const cliPath = path.join(binDir, 'gemini-cli', 'gemini');

  // For testing/simulation, if the mock files exist, we just run a basic shell command instead
  // In production, this would execute the actual portable Node binary
  let finalCommand = command;
  if (fs.existsSync(nodeExe) && fs.existsSync(cliPath) && command === 'gemini') {
      logger.log('CLI', `Using embedded sandbox: ${nodeExe} ${cliPath}`, logger.LOG_LEVELS.HIGH);
      // finalCommand = `"${nodeExe}" "${cliPath}"`; 
  }

  // Map to the Shared Profile Hub
  const profileDir = path.join(__dirname, 'profile');
  const skillsDir = path.join(profileDir, 'skills');
  const memoryDir = path.join(profileDir, 'memory');
  const promptPath = path.join(profileDir, 'system_prompt.txt');

  if (!fs.existsSync(memoryDir)) fs.mkdirSync(memoryDir, { recursive: true });

  const agentEnv = {
    ...process.env,
    FORCE_COLOR: '1',
    // Standardize paths for all agents to use the Hub
    GEMINI_SKILLS_PATH: skillsDir,
    XDG_CONFIG_HOME: memoryDir,
    USERPROFILE: memoryDir,
    HOME: memoryDir
  };

  // Build the initialization command with the system prompt
  let finalArgs = [...args];
  if (command === 'gemini') {
    // If running Gemini, we can try to pass the prompt file if supported,
    // or just ensure the agent is aware of the directory.
    // For now, we set the CWD to profileDir so the agent sees the .md files immediately.
  }

  logger.log('CLI', `Starting CLI in Profile Hub: ${finalCommand}`, logger.LOG_LEVELS.HIGH);
  
  cliProcess = spawn(finalCommand, finalArgs, {
    cwd: profileDir, // Start inside the profile directory
    env: agentEnv,
    shell: true
  });

  cliProcess.stdout.on('data', (data) => {
    event.sender.send('cli-output', data.toString());
  });

  cliProcess.stderr.on('data', (data) => {
    event.sender.send('cli-output', data.toString());
  });

  cliProcess.on('close', (code) => {
    logger.log('CLI', `CLI process exited with code ${code}`, logger.LOG_LEVELS.HIGH);
    event.sender.send('cli-exit', code);
    cliProcess = null;
  });
});

ipcMain.on('send-cli-input', (event, input) => {
  if (cliProcess && cliProcess.stdin.writable) {
    cliProcess.stdin.write(input);
  }
});

// Existing Handlers
ipcMain.handle('set-log-level', (event, level) => {
  logger.setLogLevel(level);
});

ipcMain.on('log-to-file', (event, { module, message, level }) => {
  logger.log(module, message, level);
});

ipcMain.on('broadcast-to-agents', (event, payload) => {
  if (!wss) return;
  const data = JSON.stringify(payload);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
  logger.log('BRIDGE', `Broadcasted detection packet to ${wss.clients.size} agents.`, logger.LOG_LEVELS.MAMA);
});

ipcMain.handle('get-app-version', () => app.getVersion());
