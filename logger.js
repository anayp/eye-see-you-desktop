const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const LOG_LEVELS = {
  MAMA: 3,      // "mama-mama-mama-mama" - Everything
  HIGH: 2,      // High-level overview
  ERROR: 1,     // Errors only
  OFF: 0        // Silent
};

let currentLevel = LOG_LEVELS.HIGH;
let logStream = null;

function initLogger() {
  const userDataPath = app.getPath('userData');
  const logPath = path.join(userDataPath, 'eye-see-you-debug.log');
  
  // Create a write stream for the log file
  logStream = fs.createWriteStream(logPath, { flags: 'a' });
  
  log('LOGGER_INIT', `Log file initialized at: ${logPath}`, LOG_LEVELS.HIGH);
}

function setLogLevel(levelName) {
  const level = LOG_LEVELS[levelName.toUpperCase()];
  if (level !== undefined) {
    currentLevel = level;
    log('SYSTEM', `Log level set to: ${levelName}`, LOG_LEVELS.ERROR); // Always log level changes
  }
}

function log(module, message, level = LOG_LEVELS.MAMA) {
  if (level > currentLevel) return;

  const timestamp = new Date().toISOString();
  const formattedMsg = `[${timestamp}] [${module}] [${Object.keys(LOG_LEVELS).find(k => LOG_LEVELS[k] === level)}] ${message}`;
  
  // Write to console for Electron dev info
  console.log(formattedMsg);

  // Write to file if stream exists
  if (logStream) {
    logStream.write(formattedMsg + '\n');
  }

  // Return for UI updates
  return { timestamp, module, message, level };
}

module.exports = {
  LOG_LEVELS,
  initLogger,
  setLogLevel,
  log
};
