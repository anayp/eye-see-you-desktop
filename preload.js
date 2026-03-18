const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  setLogLevel: (level) => ipcRenderer.invoke('set-log-level', level),
  logToFile: (data) => ipcRenderer.send('log-to-file', data),
  broadcastToAgents: (payload) => ipcRenderer.send('broadcast-to-agents', payload),
  onTriggerAiDescribe: (callback) => ipcRenderer.on('trigger-ai-describe', callback),
  sendAiDescriptionResult: (result) => ipcRenderer.send('ai-description-result', result),
  
  // Voice & TTS IPC
  sendVoiceTranscript: (payload) => ipcRenderer.send('voice-transcript', payload),
  onMcpSpeak: (callback) => ipcRenderer.on('mcp-speak', (event, text) => callback(text)),

  // Terminal / CLI IPC
  startCli: (config) => ipcRenderer.send('start-cli', config),
  sendCliInput: (input) => ipcRenderer.send('send-cli-input', input),
  onCliOutput: (callback) => ipcRenderer.on('cli-output', (event, data) => callback(data)),
  onCliExit: (callback) => ipcRenderer.on('cli-exit', (event, code) => callback(code))
});
