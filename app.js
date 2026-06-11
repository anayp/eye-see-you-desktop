import * as hfService from './hf-service.js';
import { maybeUpdateSceneGraph, forceUpdateSceneGraph, setGpsMode, setRoomId } from './spatial-engine.js';
import * as voiceService from './voice-service.js';

const d = {
  startup: document.getElementById("startup-overlay"),
  video: document.getElementById("camera-feed"),
  canvas: document.getElementById("overlay-canvas"),
  loader: document.getElementById("loading-overlay"),
  loaderTitle: document.getElementById("loader-title"),
  loaderFill: document.getElementById("loader-fill"),
  loaderMeta: document.getElementById("loader-meta"),
  logOverlay: document.getElementById("dev-log-overlay"),
  logBody: document.getElementById("dev-log-body"),
  logClear: document.getElementById("log-clear-btn"),
  menuBtn: document.getElementById("menu-toggle"),
  closeBtn: document.getElementById("menu-close"),
  panel: document.getElementById("menu-panel"),
  status: document.getElementById("status-line"),
  camera: document.getElementById("camera-select"),
  mirror: document.getElementById("setting-mirror-output"),
  auto: document.getElementById("mode-auto"),
  autoSet: document.getElementById("settings-auto"),
  autoInt: document.getElementById("auto-interval"),
  autoRnd: document.getElementById("auto-randomize"),
  autoQc: document.getElementById("auto-qc-status"),
  autoLabel: document.getElementById("auto-profile"),
  fpsCap: document.getElementById("fps-cap"),
  frameSkip: document.getElementById("frame-skip"),
  showDevLog: document.getElementById("show-dev-log"),
  logLevel: document.getElementById("log-level"),
  agentEnable: document.getElementById("agent-bridge-enable"),
  agentSet: document.getElementById("settings-agent"),
  agentConsent: document.getElementById("agent-consent"),
  agentEndpoint: document.getElementById("agent-endpoint"),
  agentLocalOnly: document.getElementById("agent-local-only"),
  agentMode: document.getElementById("agent-mode"),
  agentRedact: document.getElementById("agent-redact"),
  agentInterval: document.getElementById("agent-interval"),
  agentIntervalValue: document.getElementById("agent-interval-value"),
  agentSharedKey: document.getElementById("agent-shared-key"),
  agentSendNow: document.getElementById("agent-send-now"),
  agentStatus: document.getElementById("agent-status"),
  object: document.getElementById("mode-object"),
  pose: document.getElementById("mode-pose"),
  hands: document.getElementById("mode-hands"),
  face: document.getElementById("mode-face"),
  segment: document.getElementById("mode-segment"),
  opencv: document.getElementById("mode-opencv"),
  setObject: document.getElementById("settings-object"),
  setPose: document.getElementById("settings-pose"),
  setHands: document.getElementById("settings-hands"),
  setFace: document.getElementById("settings-face"),
  setSegment: document.getElementById("settings-segment"),
  setOpencv: document.getElementById("settings-opencv"),
  objThr: document.getElementById("object-threshold"),
  objMax: document.getElementById("object-max-boxes"),
  poseThr: document.getElementById("pose-threshold"),
  poseSkel: document.getElementById("pose-skeleton"),
  handsMax: document.getElementById("hands-max"),
  handsThr: document.getElementById("hands-threshold"),
  faceMax: document.getElementById("face-max"),
  faceRef: document.getElementById("face-refine"),
  segModel: document.getElementById("segment-model"),
  segAlpha: document.getElementById("segment-alpha"),
  cv1: document.getElementById("opencv-threshold1"),
  cv2: document.getElementById("opencv-threshold2"),
  cvContours: document.getElementById("opencv-contours"),
  objLabels: document.getElementById("object-custom-labels"),
  cap: {
    tf: document.getElementById("cap-tf"),
    object: document.getElementById("cap-object"),
    pose: document.getElementById("cap-pose"),
    hands: document.getElementById("cap-hands"),
    face: document.getElementById("cap-face"),
    segment: document.getElementById("cap-segment"),
    opencv: document.getElementById("cap-opencv")
  },
  metric: {
    fps: document.getElementById("metric-fps"),
    object: document.getElementById("metric-object"),
    pose: document.getElementById("metric-pose"),
    hands: document.getElementById("metric-hands"),
    face: document.getElementById("metric-face"),
    segment: document.getElementById("metric-segment"),
    opencv: document.getElementById("metric-opencv")
  },
  retry: {
    tf: document.getElementById("retry-tf"),
    object: document.getElementById("retry-object"),
    pose: document.getElementById("retry-pose"),
    hands: document.getElementById("retry-hands"),
    face: document.getElementById("retry-face"),
    segment: document.getElementById("retry-segment"),
    opencv: document.getElementById("retry-opencv")
  },
  det: {
    object: document.getElementById("det-object"),
    pose: document.getElementById("det-pose"),
    hands: document.getElementById("det-hands"),
    face: document.getElementById("det-face"),
    segment: document.getElementById("det-segment"),
    opencv: document.getElementById("det-opencv")
  },
  diagCopy: document.getElementById("diag-copy-btn"),
  cameraInfo: document.getElementById("camera-track-info"),
  hfKey: document.getElementById("hf-api-key"),
  aiDescribe: document.getElementById("ai-describe-btn"),
  aiOutput: document.getElementById("ai-description-output"),
  voiceEnable: document.getElementById("voice-enable"),
  voiceSpeak: document.getElementById("voice-speak"),
  voiceStatus: document.getElementById("voice-status"),
  // Bridge Dashboard
  bridgeToggle: document.getElementById("bridge-toggle"),
  bridgeToggleHub: document.getElementById("bridge-toggle-from-hub"),
  bridgeOverlay: document.getElementById("bridge-overlay"),
  bridgeClose: document.getElementById("bridge-close"),
  bridgeDot: document.getElementById("bridge-dot"),
  bridgeAgentCount: document.getElementById("bridge-agent-count"),
  bridgeAgentList: document.getElementById("bridge-agent-list"),
  bridgeNoAgents: document.getElementById("bridge-no-agents"),
  bridgeCopyBtn: document.getElementById("bridge-copy-btn"),
  // Token status (kept for layout)
  tokenPlanLabel: document.getElementById("token-plan-label"),
  tokenFill: document.getElementById("token-fill"),
  tokenUsage: document.getElementById("token-usage-percent"),
  rateLimit: document.getElementById("rate-limit-msg"),
  // Key vault
  vaultModal: document.getElementById("vault-modal"),
  vaultToggle: document.getElementById("vault-toggle-btn"),
  vaultClose: document.getElementById("vault-close"),
  vaultSave: document.getElementById("vault-save-btn"),
  helpPopover: document.getElementById("help-popover"),
  helpText: document.getElementById("help-text"),
  helpClose: document.getElementById("help-close"),
  keyGemini: document.getElementById("key-gemini"),
  keyClaude: document.getElementById("key-claude"),
  // Spatial
  spatialGpsMode: document.getElementById("spatial-gps-mode"),
  spatialRoomLabel: document.getElementById("spatial-room-label"),
  mirrorVideo: document.getElementById("settings-mirror-video"),
};

// ── Bridge Dashboard ──────────────────────────────────────────────────────────
let _bridgePollInterval = null;

async function refreshBridgeDashboard() {
  if (!window.electronAPI?.getBridgeStatus) return;
  try {
    const status = await window.electronAPI.getBridgeStatus();
    const agents = status.mcpAgents || [];
    const count = agents.length;

    if (d.bridgeAgentCount) d.bridgeAgentCount.textContent = count === 0 ? '0 connected' : `${count} connected`;
    if (d.bridgeDot) {
      d.bridgeDot.classList.toggle('active', count > 0);
      d.bridgeDot.classList.toggle('offline', count === 0);
    }

    if (d.bridgeAgentList) {
      if (count === 0) {
        d.bridgeAgentList.innerHTML = '<div id="bridge-no-agents">No agents connected yet.</div>';
      } else {
        d.bridgeAgentList.innerHTML = agents.map(a => `
          <div class="bridge-agent-card">
            <div class="agent-name">${a.agent_name || 'anonymous'}${a.model ? ' · ' + a.model : ''}</div>
            <div class="agent-meta">Connected ${a.connected_at ? new Date(a.connected_at).toLocaleTimeString() : 'unknown'}${a.session_id ? ' · ' + a.session_id.slice(0, 8) : ''}</div>
          </div>`).join('');
      }
    }
  } catch (err) {
    log('Bridge dashboard refresh failed: ' + err.message, 'error');
  }
}

const HELP_CONTENT = {
  gemini: "Go to <b>aistudio.google.com</b>, sign in, and click 'Get API Key'. Copy the key and paste it here.",
  claude: "Go to <b>console.anthropic.com</b>, create an account, and generate an API key under the 'Keys' section."
};

function updateTokenStatus(percent, plan = "Free Tier", msg = "Rate limits stable.") {
  d.tokenFill.style.width = percent + "%";
  d.tokenUsage.textContent = percent + "% used";
  d.tokenPlanLabel.textContent = "Plan: " + plan;
  d.rateLimit.textContent = "Status: " + msg;
  
  if (percent > 80) d.tokenFill.style.background = "var(--error)";
  else if (percent > 50) d.tokenFill.style.background = "var(--warn)";
  else d.tokenFill.style.background = "var(--accent)";
}

function bindBridgeDashboard() {
  // Toggle bridge overlay from top-bar button
  const toggleBridge = () => {
    const isVisible = d.bridgeOverlay.style.display === 'flex';
    d.bridgeOverlay.style.display = isVisible ? 'none' : 'flex';
    if (!isVisible) {
      refreshBridgeDashboard();
      // Poll while visible
      _bridgePollInterval = setInterval(refreshBridgeDashboard, 3000);
    } else {
      clearInterval(_bridgePollInterval);
    }
  };

  if (d.mirrorVideo) {
    d.mirrorVideo.addEventListener("change", (e) => {
      const isMirrored = e.target.checked;
      if (isMirrored) {
        d.video.classList.add('mirrored');
        d.overlay.classList.add('mirrored');
      } else {
        d.video.classList.remove('mirrored');
        d.overlay.classList.remove('mirrored');
      }
    });
  }

  if (d.bridgeToggle) d.bridgeToggle.addEventListener('click', toggleBridge);
  if (d.bridgeToggleHub) d.bridgeToggleHub.addEventListener('click', toggleBridge);
  if (d.bridgeClose) {
    d.bridgeClose.addEventListener('click', () => {
      d.bridgeOverlay.style.display = 'none';
      clearInterval(_bridgePollInterval);
    });
  }

  // Copy connect string
  if (d.bridgeCopyBtn) {
    d.bridgeCopyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText('ws://localhost:4141').then(() => {
        d.bridgeCopyBtn.textContent = 'Copied!';
        setTimeout(() => { d.bridgeCopyBtn.textContent = 'Copy'; }, 1500);
      });
    });
  }

  // Listen for bridge status changes pushed from main process
  if (window.electronAPI?.onMcpSpeak) {
    // Reuse the existing IPC channel pattern — bridge-status-changed fires a refresh
    // (We rely on polling above; a push event would be cleaner but requires another preload entry)
  }

  // Vault controls
  if (d.vaultToggle) d.vaultToggle.addEventListener('click', () => { d.vaultModal.style.display = 'flex'; });
  if (d.vaultClose) d.vaultClose.addEventListener('click', () => { d.vaultModal.style.display = 'none'; });
  if (d.vaultSave) d.vaultSave.addEventListener('click', () => {
    log('Keys saved locally.', 'info');
    d.vaultModal.style.display = 'none';
    status('Vault updated.');
  });

  document.querySelectorAll('.help-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const topic = btn.getAttribute('data-help');
      d.helpText.innerHTML = HELP_CONTENT[topic] || 'No help available.';
      d.helpPopover.style.display = 'block';
    });
  });
  if (d.helpClose) d.helpClose.addEventListener('click', () => { d.helpPopover.style.display = 'none'; });

  // Spatial engine controls
  if (d.spatialGpsMode) {
    d.spatialGpsMode.addEventListener('change', () => {
      setGpsMode(d.spatialGpsMode.checked);
      if (d.spatialStatus) d.spatialStatus.textContent = d.spatialGpsMode.checked ? 'GPS mode active.' : 'Indoor grid mode active.';
      log('Spatial mode: ' + (d.spatialGpsMode.checked ? 'GPS (outdoor)' : 'Grid (indoor)'), 'info');
    });
  }
  if (d.spatialRoomId) {
    d.spatialRoomId.addEventListener('change', () => {
      setRoomId(d.spatialRoomId.value.trim() || 'unknown_room');
      log('Room ID set to: ' + d.spatialRoomId.value, 'info');
    });
  }

  // Object snapshot capture handler (from mcp-server via main.js)
  if (window.electronAPI?.onRequestObjectSnapshot) {
    window.electronAPI.onRequestObjectSnapshot(({ label, bbox }) => {
      const dataUrl = _captureObjectSnapshot(bbox);
      window.electronAPI.sendObjectSnapshotResult({ label, dataUrl });
    });
  }
}

const ctx = d.canvas.getContext("2d");
const cvCanvas = document.createElement("canvas");
const cvCtx = cvCanvas.getContext("2d", { willReadFrequently: true });
const segCanvas = document.createElement("canvas");
const segCtx = segCanvas.getContext("2d");

const S = {
  started: false,
  running: false,
  stream: null,
  deviceId: "",
  model: { object: null, pose: null, hands: null, face: null, segment: null },
  result: { objects: [], poses: [], hands: [], handLabels: [], faces: [], segMask: null, cvRects: [] },
  inf: {
    object: { busy: false, last: 0, interval: 130, base: 130 },
    pose: { busy: false, last: 0, interval: 120, base: 120 },
    hands: { busy: false, last: 0, interval: 95, base: 95 },
    face: { busy: false, last: 0, interval: 95, base: 95 },
    segment: { busy: false, last: 0, interval: 90, base: 90 },
    opencv: { busy: false, last: 0, interval: 140, base: 140 }
  },
  metric: {
    fps: 0,
    frames: 0,
    fpsTs: performance.now(),
    latency: { object: 0, pose: 0, hands: 0, face: 0, segment: 0, opencv: 0 }
  },
  auto: { id: null, idx: 0, lastMode: "", cooldownUntil: {}, qcLabel: "" },
  unavailable: new Set(),
  lastWorkTs: 0,
  frameSeq: 0,
  perf: {
    lowFpsSince: 0
  },
  prefsLoaded: false,
  log: {
    level: "verbose",
    visible: true,
    lines: []
  },
  load: {
    active: false,
    label: "",
    total: 1,
    done: 0,
    detail: "",
    preloadSuppressed: false,
    runtimePromises: {}
  },
  _cvValidated: false,
  _tfValidated: false,
  visionWorker: null,
  agent: {
    inFlight: false,
    lastSentTs: 0,
    sent: 0,
    failed: 0,
    sessionId: ""
  }
};

const MODES = ["object", "pose", "hands", "face", "segment", "opencv"];
const AUTO = [
  { name: "Object Focus", mode: "object" },
  { name: "Pose Tracker", mode: "pose" },
  { name: "Hands Map", mode: "hands" },
  { name: "Face Geometry", mode: "face" },
  { name: "Body Segmentation", mode: "segment" },
  { name: "OpenCV Scene", mode: "opencv" }
];
const HEAVY = new Set(["face", "segment"]);
const HAND = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17]];
const PEDGE = [["left_shoulder","right_shoulder"],["left_shoulder","left_elbow"],["left_elbow","left_wrist"],["right_shoulder","right_elbow"],["right_elbow","right_wrist"],["left_shoulder","left_hip"],["right_shoulder","right_hip"],["left_hip","right_hip"],["left_hip","left_knee"],["left_knee","left_ankle"],["right_hip","right_knee"],["right_knee","right_ankle"]];
const PREF_KEY = "eye_see_ew_prefs_v1";
const MAX_RECOMMENDED_MANUAL_MODES = 2;
const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);
const RUNTIMES = {
  tf: {
    label: "TensorFlow.js",
    src: "local-models/tf.min.js",
    ready: () => !!window.tf,
    global: "tf",
    timeout: 18000
  },
  coco: {
    label: "COCO-SSD runtime",
    src: "local-models/coco-ssd.js",
    ready: () => !!window.cocoSsd,
    global: "cocoSsd",
    timeout: 18000
  },
  pose: {
    label: "Pose runtime",
    src: "https://cdn.jsdelivr.net/npm/@tensorflow-models/pose-detection",
    ready: () => !!window.poseDetection,
    global: "poseDetection",
    timeout: 18000
  },
  hands: {
    label: "MediaPipe Hands runtime",
    src: "local-models/hands.js",
    ready: () => !!window.Hands,
    global: "Hands",
    timeout: 18000
  },
  face: {
    label: "MediaPipe Face runtime",
    src: "local-models/face_mesh.js",
    ready: () => !!window.FaceMesh,
    global: "FaceMesh",
    timeout: 18000
  },
  segment: {
    label: "MediaPipe Segmentation runtime",
    src: "local-models/selfie_segmentation.js",
    ready: () => !!window.SelfieSegmentation,
    global: "SelfieSegmentation",
    timeout: 18000
  },
  opencv: {
    label: "OpenCV runtime",
    srcs: [
      "local-models/opencv.js"
    ],
    ready: () => !!window.cv && !!window.__eyeSeeEwCvReady,
    wait: () => waitCv(45000),
    timeout: 45000
  }
};

function nowTime() {
  const t = new Date();
  return t.toLocaleTimeString();
}

const LOG_MAP = { mama: 3, high: 2, error: 1, off: 0 };

function log(message, level = "info") {
  const uiLevel = d.logLevel.value;
  const numLevel = level === "error" ? 1 : level === "info" ? 2 : 3;
  
  // Send to Electron File Logger
  if (window.electronAPI) {
    window.electronAPI.logToFile({ 
      module: "RENDERER", 
      message, 
      level: numLevel 
    });
  }

  S.log.lines.push({ time: nowTime(), level, message });
  if (S.log.lines.length > 600) {
    S.log.lines = S.log.lines.slice(-600);
  }
  flushLogOverlay();
}

function flushLogOverlay() {
  if (!S.log.visible || d.logLevel.value === "off") {
    d.logOverlay.style.display = "none";
    return;
  }
  d.logOverlay.style.display = "flex";
  
  const currentThreshold = LOG_MAP[d.logLevel.value];
  const view = S.log.lines.filter((line) => {
    const lineNum = line.level === "error" ? 1 : line.level === "info" ? 2 : 3;
    return lineNum <= currentThreshold;
  }).slice(-240);

  d.logBody.innerHTML = view.map((line) => {
    const cls = line.level === "error" ? "log-line error" : "log-line";
    return `<div class="${cls}">[${line.time}] ${line.level.toUpperCase()} ${line.message}</div>`;
  }).join("");
  d.logBody.scrollTop = d.logBody.scrollHeight;
}

function setAutoQcLabel(text) {
  if (S.auto.qcLabel === text) return;
  S.auto.qcLabel = text;
  if (d.autoQc) d.autoQc.textContent = text;
}

function setAgentStatus(text, isError = false) {
  if (!d.agentStatus) return;
  d.agentStatus.textContent = text;
  d.agentStatus.classList.toggle("error", !!isError);
}

function syncAgentPanel() {
  d.agentSet.classList.toggle("open", d.agentEnable.checked);
}

function isLocalEndpoint(urlText) {
  try {
    const u = new URL(urlText);
    return LOCAL_HOSTS.has(u.hostname.toLowerCase());
  } catch (_) {
    return false;
  }
}

function parseAgentEndpoint() {
  const raw = (d.agentEndpoint.value || "").trim();
  if (!raw) return { ok: false, error: "Agent endpoint is empty." };
  let u;
  try {
    u = new URL(raw);
  } catch (_) {
    return { ok: false, error: "Agent endpoint is not a valid URL." };
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    return { ok: false, error: "Agent endpoint must use http or https." };
  }
  if (d.agentLocalOnly.checked && !isLocalEndpoint(u.toString())) {
    return { ok: false, error: "Local-only mode blocks non-local endpoint." };
  }
  return { ok: true, url: u.toString() };
}

function activeModes() {
  return MODES.filter((m) => modeEl(m).checked);
}

function maskSensitiveRegions(ctx2d, tw, th) {
  ctx2d.save();
  ctx2d.fillStyle = "rgba(0,0,0,0.98)";

  S.result.faces.forEach((faceLm) => {
    if (!faceLm || !faceLm.length) return;
    let minX = 1, minY = 1, maxX = 0, maxY = 0;
    faceLm.forEach((p) => {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    });
    const x = Math.max(0, Math.floor(minX * tw) - 8);
    const y = Math.max(0, Math.floor(minY * th) - 8);
    const w = Math.min(tw - x, Math.ceil((maxX - minX) * tw) + 16);
    const h = Math.min(th - y, Math.ceil((maxY - minY) * th) + 16);
    if (w > 0 && h > 0) ctx2d.fillRect(x, y, w, h);
  });

  S.result.hands.forEach((handLm) => {
    if (!handLm || !handLm.length) return;
    let minX = 1, minY = 1, maxX = 0, maxY = 0;
    handLm.forEach((p) => {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    });
    const x = Math.max(0, Math.floor(minX * tw) - 6);
    const y = Math.max(0, Math.floor(minY * th) - 6);
    const w = Math.min(tw - x, Math.ceil((maxX - minX) * tw) + 12);
    const h = Math.min(th - y, Math.ceil((maxY - minY) * th) + 12);
    if (w > 0 && h > 0) ctx2d.fillRect(x, y, w, h);
  });

  ctx2d.restore();
}

function captureAgentSnapshot() {
  if (!d.video.videoWidth || !d.video.videoHeight) return null;
  const sw = d.video.videoWidth;
  const sh = d.video.videoHeight;
  const maxW = 640;
  const scale = Math.min(1, maxW / sw);
  const tw = Math.max(160, Math.round(sw * scale));
  const th = Math.max(90, Math.round(sh * scale));
  const c = document.createElement("canvas");
  c.width = tw;
  c.height = th;
  const c2d = c.getContext("2d");
  c2d.drawImage(d.video, 0, 0, tw, th);
  if (d.agentRedact.checked) {
    maskSensitiveRegions(c2d, tw, th);
  }
  return c.toDataURL("image/jpeg", 0.72);
}

function buildAgentPayload(ts) {
  const objects = S.result.objects.slice(0, 8).map((o) => ({
    class: o.class,
    score: Number((o.score || 0).toFixed(3))
  }));
  const payload = {
    app: "eye-see-you",
    ts_iso: new Date().toISOString(),
    ts_ms: Math.round(ts),
    session_id: S.agent.sessionId,
    camera: {
      width: d.video.videoWidth || 0,
      height: d.video.videoHeight || 0,
      mirrored: d.mirror.checked
    },
    perf: {
      fps: Number(S.metric.fps.toFixed(2)),
      latency_ms: {
        object: Number((S.metric.latency.object || 0).toFixed(2)),
        pose: Number((S.metric.latency.pose || 0).toFixed(2)),
        hands: Number((S.metric.latency.hands || 0).toFixed(2)),
        face: Number((S.metric.latency.face || 0).toFixed(2)),
        segment: Number((S.metric.latency.segment || 0).toFixed(2)),
        opencv: Number((S.metric.latency.opencv || 0).toFixed(2))
      }
    },
    modes: {
      active: activeModes(),
      auto: d.auto.checked
    },
    detections: {
      object_count: S.result.objects.length,
      object_top: objects,
      pose_count: S.result.poses.length,
      hand_count: S.result.hands.length,
      face_count: S.result.faces.length,
      segmentation_active: !!S.result.segMask,
      opencv_contour_count: S.result.cvRects.length
    },
    privacy: {
      summary_only: d.agentMode.value === "summary",
      redaction_enabled: d.agentRedact.checked
    }
  };
  if (d.agentMode.value === "snapshot") {
    payload.snapshot_jpeg_data_url = captureAgentSnapshot();
  }
  return payload;
}

async function maybeSendAgentUpdate(ts, force = false) {
  if (!d.agentEnable.checked) return;
  if (!d.agentConsent.checked) {
    if (force) setAgentStatus("Enable consent checkbox to allow agent sharing.", true);
    return;
  }
  if (!S.running || !d.video.videoWidth) return;

  // FPS Safety: skip if system is struggling (< 10 FPS) unless forced
  if (!force && S.metric.fps > 0 && S.metric.fps < 10) {
    setAutoQcLabel("QC: Bridge throttled (low FPS).");
    return;
  }

  const intervalMs = Number(d.agentInterval.value) * 1000;
  if (!force && ts - S.agent.lastSentTs < intervalMs) return;

  const payload = buildAgentPayload(ts);
  S.agent.lastSentTs = ts;

  if (window.electronAPI && window.electronAPI.broadcastToAgents) {
    window.electronAPI.broadcastToAgents(payload);
    S.agent.sent += 1;
    setAgentStatus("Bridge broadcasting natively. Sent " + S.agent.sent + " packets.");
  } else {
    setAgentStatus("Native bridge unavailable.", true);
  }
}

function runtimeScriptId(key) {
  return "runtime-script-" + key;
}

async function injectScript(key, cfg) {
  const existing = document.getElementById(runtimeScriptId(key));
  if (existing) return;
  const sources = cfg.srcs && cfg.srcs.length ? cfg.srcs : [cfg.src];
  let lastError = null;
  for (let i = 0; i < sources.length; i += 1) {
    const src = sources[i];
    try {
      await new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.id = runtimeScriptId(key);
        script.src = src;
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(cfg.label + " script failed to load"));
        document.head.appendChild(script);
      });
      return;
    } catch (e) {
      lastError = e;
      const stale = document.getElementById(runtimeScriptId(key));
      if (stale) stale.remove();
      if (i < sources.length - 1) {
        log("Runtime source failed, trying fallback: " + cfg.label + " (" + src + ")", "error");
      }
    }
  }
  throw lastError || new Error(cfg.label + " script failed to load");
}

async function loadRuntime(key) {
  const cfg = RUNTIMES[key];
  if (!cfg) throw new Error("ERR_UNKNOWN_KEY: " + key);
  if (cfg.ready()) return;
  if (S.load.runtimePromises[key]) {
    await S.load.runtimePromises[key];
    return;
  }

  const promise = (async () => {
    log("Runtime load start: " + cfg.label);
    await injectScript(key, cfg);
    try {
      if (cfg.wait) {
        await cfg.wait();
      } else if (cfg.global) {
        await waitGlobal(cfg.global, cfg.timeout || 18000);
      }
    } catch (e) {
      if (e.message.includes("timeout")) throw new Error("ERR_TIMEOUT: " + cfg.label + " initialization timed out");
      throw e;
    }
    log("Runtime load ready: " + cfg.label);
  })().catch((e) => {
    const stale = document.getElementById(runtimeScriptId(key));
    if (stale) stale.remove();
    const msg = e.message.startsWith("ERR_") ? e.message : "ERR_LOAD_FAIL: " + e.message;
    log("Runtime failure: " + cfg.label + " (" + msg + ")", "error");
    throw new Error(msg);
  });

  S.load.runtimePromises[key] = promise;
  try {
    await promise;
  } finally {
    delete S.load.runtimePromises[key];
  }
}

function setLoader(label, done, total, detail = "") {
  S.load.active = true;
  S.load.label = label;
  S.load.done = done;
  S.load.total = Math.max(1, total);
  S.load.detail = detail;
  const pct = Math.max(0, Math.min(100, (S.load.done / S.load.total) * 100));
  d.loaderTitle.textContent = label;
  d.loaderMeta.textContent = detail
    ? `${S.load.done} / ${S.load.total} • ${detail}`
    : `${S.load.done} / ${S.load.total}`;
  d.loaderFill.style.width = `${pct}%`;
  d.loader.style.display = "flex";
}

function hideLoader() {
  S.load.active = false;
  d.loader.style.display = "none";
}

function savePrefs() {
  const prefs = {
    deviceId: S.deviceId || "",
    mirror: d.mirror.checked,
    objThr: d.objThr.value,
    objMax: d.objMax.value,
    poseThr: d.poseThr.value,
    poseSkel: d.poseSkel.checked,
    handsMax: d.handsMax.value,
    handsThr: d.handsThr.value,
    faceMax: d.faceMax.value,
    faceRef: d.faceRef.checked,
    segModel: d.segModel.value,
    segAlpha: d.segAlpha.value,
    cv1: d.cv1.value,
    cv2: d.cv2.value,
    cvContours: d.cvContours.checked,
    autoInt: d.autoInt.value,
    autoRnd: d.autoRnd.checked,
    fpsCap: d.fpsCap.value,
    frameSkip: d.frameSkip.value,
    agentEnable: d.agentEnable.checked,
    agentConsent: d.agentConsent.checked,
    agentEndpoint: d.agentEndpoint.value,
    agentLocalOnly: d.agentLocalOnly.checked,
    agentMode: d.agentMode.value,
    agentRedact: d.agentRedact.checked,
    agentInterval: d.agentInterval.value,
    agentSharedKey: d.agentSharedKey.value,
    logLevel: S.log.level,
    showLog: S.log.visible
  };
  try {
    localStorage.setItem(PREF_KEY, JSON.stringify(prefs));
  } catch (_) {
    // Ignore local storage failures in private browsing contexts.
  }
}

function loadPrefs() {
  try {
    const raw = localStorage.getItem(PREF_KEY);
    if (!raw) return;
    const p = JSON.parse(raw);
    if (p.deviceId) S.deviceId = p.deviceId;
    if (typeof p.mirror === "boolean") d.mirror.checked = p.mirror;
    if (p.objThr) d.objThr.value = p.objThr;
    if (p.objMax) d.objMax.value = p.objMax;
    if (p.poseThr) d.poseThr.value = p.poseThr;
    if (typeof p.poseSkel === "boolean") d.poseSkel.checked = p.poseSkel;
    if (p.handsMax) d.handsMax.value = p.handsMax;
    if (p.handsThr) d.handsThr.value = p.handsThr;
    if (p.faceMax) d.faceMax.value = p.faceMax;
    if (typeof p.faceRef === "boolean") d.faceRef.checked = p.faceRef;
    if (p.segModel) d.segModel.value = p.segModel;
    if (p.segAlpha) d.segAlpha.value = p.segAlpha;
    if (p.cv1) d.cv1.value = p.cv1;
    if (p.cv2) d.cv2.value = p.cv2;
    if (typeof p.cvContours === "boolean") d.cvContours.checked = p.cvContours;
    if (p.autoInt) d.autoInt.value = p.autoInt;
    if (typeof p.autoRnd === "boolean") d.autoRnd.checked = p.autoRnd;
    if (p.fpsCap) d.fpsCap.value = p.fpsCap;
    if (p.frameSkip) d.frameSkip.value = p.frameSkip;
    if (typeof p.agentEnable === "boolean") d.agentEnable.checked = p.agentEnable;
    if (typeof p.agentConsent === "boolean") d.agentConsent.checked = p.agentConsent;
    if (p.agentEndpoint) d.agentEndpoint.value = p.agentEndpoint;
    if (typeof p.agentLocalOnly === "boolean") d.agentLocalOnly.checked = p.agentLocalOnly;
    if (p.agentMode === "summary" || p.agentMode === "snapshot") d.agentMode.value = p.agentMode;
    if (typeof p.agentRedact === "boolean") d.agentRedact.checked = p.agentRedact;
    if (p.agentInterval) d.agentInterval.value = p.agentInterval;
    if (typeof p.agentSharedKey === "string") d.agentSharedKey.value = p.agentSharedKey;
    if (p.logLevel === "errors" || p.logLevel === "verbose") S.log.level = p.logLevel;
    if (typeof p.showLog === "boolean") S.log.visible = p.showLog;
  } catch (_) {
    // Ignore malformed preferences.
  }
  S.prefsLoaded = true;
}

function status(msg, err) {
  d.status.textContent = msg;
  d.status.classList.toggle("error", !!err);
  log(msg, err ? "error" : "info");
}
function cap(k, txt, state) {
  const el = d.cap[k]; if (!el) return;
  const prev = el.textContent;
  el.textContent = txt;
  el.classList.remove("cap-ready", "cap-error", "cap-pending");
  el.classList.add(state === "ready" ? "cap-ready" : state === "error" ? "cap-error" : "cap-pending");
  if (d.retry[k]) d.retry[k].disabled = state !== "error";
  if (prev !== txt && (state === "ready" || state === "error")) {
    log(`Capability ${k}: ${txt}`, state === "error" ? "error" : "info");
  }
}
function latency(k, ms) {
  const cur = S.metric.latency[k] || 0;
  S.metric.latency[k] = cur === 0 ? ms : cur * 0.7 + ms * 0.3;
  d.metric[k].textContent = S.metric.latency[k].toFixed(1);
}

function applyModeCooldown(mode, ms, reason) {
  S.auto.cooldownUntil[mode] = performance.now() + ms;
  log(`Cooldown ${mode}: ${Math.round(ms / 1000)}s (${reason})`);
}

function enforceLowFpsGuardrails() {
  if (!d.auto.checked) return;
  const heavyActive = ["segment", "face"].filter((mode) => modeEl(mode).checked);
  if (!heavyActive.length) return;
  heavyActive.forEach((mode) => {
    modeOn(mode, false);
    applyModeCooldown(mode, 30000, "low fps guardrail");
  });
  setAutoQcLabel("QC: low FPS detected, cooling heavy modes (30s).");
  status(`Low FPS guardrail: disabled ${heavyActive.join(" + ")} for 30s.`);
  savePrefs();
}

function fps(ts) {
  S.metric.frames += 1;
  const dt = ts - S.metric.fpsTs;
  if (dt >= 1000) {
    S.metric.fps = (S.metric.frames * 1000) / dt;
    d.metric.fps.textContent = S.metric.fps.toFixed(1);
    if (S.metric.fps < 10) {
      if (!S.perf.lowFpsSince) S.perf.lowFpsSince = ts;
      if (ts - S.perf.lowFpsSince > 5000) {
        enforceLowFpsGuardrails();
        S.perf.lowFpsSince = ts;
      }
    } else {
      S.perf.lowFpsSince = 0;
      if (d.auto.checked) {
        setAutoQcLabel("QC: stable (" + S.metric.fps.toFixed(1) + " FPS), auto balancing enabled.");
      }
    }
    tuneIntervals();
    S.metric.frames = 0;
    S.metric.fpsTs = ts;
  }
}

function tuneIntervals() {
  const f = S.metric.fps;
  Object.keys(S.inf).forEach((k) => {
    const p = S.inf[k];
    if (f < 14) {
      p.interval = Math.min(360, Math.round(p.interval * 1.1));
    } else if (f > 24) {
      p.interval = Math.max(p.base, Math.round(p.interval * 0.9));
    }
  });
}

function waitGlobal(name, timeout = 18000) {
  return new Promise((resolve, reject) => {
    const t0 = performance.now();
    const id = setInterval(() => {
      if (window[name]) { clearInterval(id); resolve(window[name]); return; }
      if (performance.now() - t0 > timeout) { clearInterval(id); reject(new Error(name + " load timeout")); }
    }, 80);
  });
}
function isCvReady() {
  return !!(window.cv && typeof window.cv.Mat === "function" && typeof window.cv.imread === "function");
}
function markCvReady() {
  if (isCvReady()) {
    window.__eyeSeeEwCvReady = true;
    return true;
  }
  return false;
}
function waitCv(timeout = 45000) {
  if (markCvReady()) return Promise.resolve(window.cv);
  return new Promise((resolve, reject) => {
    let done = false;
    let to, poll;
    const finish = () => {
      if (done) return;
      if (!markCvReady()) {
        if (window.cv) {
           window.__eyeSeeEwCvReady = true;
           done = true;
           clearTimeout(to);
           clearInterval(poll);
           resolve(window.cv);
           return;
        }
        return;
      }
      done = true;
      clearTimeout(to);
      clearInterval(poll);
      resolve(window.cv);
    };
    to = setTimeout(() => {
      if (!done) { done = true; clearInterval(poll); reject(new Error("OpenCV init timeout")); }
    }, timeout);
    poll = setInterval(finish, 100);

    if (window.cv && typeof window.cv.then === "function") {
      try {
        window.cv.then(() => finish());
      } catch (_) {
        // Continue polling path.
      }
    }
  });
}

function resizeCanvas() {
  const w = window.innerWidth, h = window.innerHeight;
  if (d.canvas.width !== w || d.canvas.height !== h) { d.canvas.width = w; d.canvas.height = h; }
}
function applyMirrorOutput() {
  const t = d.mirror.checked ? "scaleX(-1) translateZ(0)" : "translateZ(0)";
  d.video.style.transform = t;
  // Canvas is NOT mirrored via CSS anymore to keep text readable
  d.canvas.style.transform = "translateZ(0)";
}
function cover() {
  const vw = d.video.videoWidth || 1, vh = d.video.videoHeight || 1;
  const cw = d.canvas.width || 1, ch = d.canvas.height || 1;
  const s = Math.max(cw / vw, ch / vh), dw = vw * s, dh = vh * s;
  return { s, ox: (cw - dw) * 0.5, oy: (ch - dh) * 0.5, dw, dh };
}
function map(x, y) {
  const t = cover();
  let finalX = t.ox + x * t.s;
  
  // If mirrored, invert the X coordinate relative to the video width
  if (d.mirror.checked) {
    const canvasVideoWidth = d.video.videoWidth * t.s;
    const relativeX = x * t.s;
    finalX = t.ox + (canvasVideoWidth - relativeX);
  }
  
  return { x: finalX, y: t.oy + y * t.s };
}
function drawCover(src, alpha) { const t = cover(); ctx.save(); ctx.globalAlpha = alpha; ctx.drawImage(src, t.ox, t.oy, t.dw, t.dh); ctx.restore(); }

function setPanel(open) { d.panel.classList.toggle("open", open); }
function modeEl(m) { return d[m]; }
function setEl(m) { return d["set" + m[0].toUpperCase() + m.slice(1)]; }
function modeOn(m, on) {
  modeEl(m).checked = on;
  setEl(m).classList.toggle("open", on);
  updateDetectionStatus();
}
function syncPanels() {
  d.autoSet.classList.toggle("open", d.auto.checked);
  syncAgentPanel();
  MODES.forEach((m) => setEl(m).classList.toggle("open", modeEl(m).checked));
}
function clearModes() { MODES.forEach((m) => modeOn(m, false)); }
function enabledManualCount() {
  return MODES.filter((m) => modeEl(m).checked).length;
}
function confirmHighLoadIfNeeded(aboutToEnableMode) {
  if (d.auto.checked) return true;
  const count = enabledManualCount();
  if (count <= MAX_RECOMMENDED_MANUAL_MODES) return true;
  const message = "High load warning: running more than 2 manual pipelines can cause browser instability on some devices.\n\n" +
    "Recommended: use Auto Mode for browser-monitored quality control.\n\n" +
    "Continue enabling '" + aboutToEnableMode + "' anyway?";
  const ok = window.confirm(message);
  if (!ok) {
    status("Manual mode enable cancelled to keep load stable.");
    log("User cancelled high-load manual mode enable.");
  } else {
    status("High load warning acknowledged. Auto Mode is recommended for stability.");
    log("High-load manual mode enable confirmed by user.");
  }
  return ok;
}
function disableManual(on) {
  document.querySelectorAll(".manual-card").forEach((el) => el.classList.toggle("manual-disabled", on));
  document.querySelectorAll(".manual-toggle").forEach((el) => { el.disabled = on; });
  document.querySelectorAll("[data-manual-control]").forEach((el) => { el.disabled = on; });
}

function out() {
  document.getElementById("auto-interval-value").textContent = d.autoInt.value;
  d.agentIntervalValue.textContent = d.agentInterval.value;
  document.getElementById("fps-cap-value").textContent = d.fpsCap.value;
  document.getElementById("frame-skip-value").textContent = d.frameSkip.value;
  document.getElementById("object-threshold-value").textContent = Number(d.objThr.value).toFixed(2);
  document.getElementById("object-max-boxes-value").textContent = d.objMax.value;
  document.getElementById("pose-threshold-value").textContent = Number(d.poseThr.value).toFixed(2);
  document.getElementById("hands-max-value").textContent = d.handsMax.value;
  document.getElementById("hands-threshold-value").textContent = Number(d.handsThr.value).toFixed(2);
  document.getElementById("face-max-value").textContent = d.faceMax.value;
  document.getElementById("segment-model-value").textContent = d.segModel.value;
  document.getElementById("segment-alpha-value").textContent = Number(d.segAlpha.value).toFixed(2);
  document.getElementById("opencv-threshold1-value").textContent = d.cv1.value;
  document.getElementById("opencv-threshold2-value").textContent = d.cv2.value;
}

function detectionLabel(mode, count, readyHint) {
  const el = d.det[mode];
  if (!el) return;
  if (!modeEl(mode).checked) {
    el.textContent = "inactive";
    return;
  }
  if (S.unavailable.has(mode)) {
    el.textContent = "error";
    return;
  }
  if (mode !== "opencv" && !S.model[mode]) {
    el.textContent = "loading";
    return;
  }
  if (mode === "opencv" && !(window.cv && window.__eyeSeeEwCvReady)) {
    el.textContent = "loading";
    return;
  }
  if (count > 0) {
    el.textContent = `${count} detected`;
    return;
  }
  el.textContent = readyHint;
}

function updateDetectionStatus() {
  detectionLabel("object", S.result.objects.length, "ready, no objects");
  detectionLabel("pose", S.result.poses.length, "ready, no pose");
  detectionLabel("hands", S.result.hands.length, "ready, no hands");
  detectionLabel("face", S.result.faces.length, "ready, no face");
  detectionLabel("opencv", S.result.cvRects.length, "ready, no contours");
  const segEl = d.det.segment;
  if (!d.segment.checked) segEl.textContent = "inactive";
  else if (S.unavailable.has("segment")) segEl.textContent = "error";
  else if (!S.model.segment) segEl.textContent = "loading";
  else segEl.textContent = S.result.segMask ? "mask active" : "ready, no mask";
}
function randomPreset(mode) {
  if (!d.autoRnd.checked) return;
  if (mode === "object") { d.objThr.value = (0.35 + Math.random() * 0.45).toFixed(2); d.objMax.value = String(4 + Math.floor(Math.random() * 10)); }
  if (mode === "pose") { d.poseThr.value = (0.3 + Math.random() * 0.4).toFixed(2); d.poseSkel.checked = Math.random() > 0.15; }
  if (mode === "hands") { d.handsMax.value = Math.random() > 0.55 ? "2" : "1"; d.handsThr.value = (0.45 + Math.random() * 0.35).toFixed(2); }
  if (mode === "face") { d.faceMax.value = String(1 + Math.floor(Math.random() * 2)); d.faceRef.checked = Math.random() > 0.4; }
  if (mode === "segment") { d.segModel.value = Math.random() > 0.5 ? "1" : "0"; d.segAlpha.value = (0.2 + Math.random() * 0.45).toFixed(2); }
  if (mode === "opencv") { d.cv1.value = String(40 + Math.floor(Math.random() * 130)); d.cv2.value = String(110 + Math.floor(Math.random() * 170)); d.cvContours.checked = Math.random() > 0.3; }
  out();
}

async function ensureTF() {
  if (window.tf) {
    if (!S._tfValidated) {
      log(`TF.js Backend: ${window.tf.getBackend()}`);
      S._tfValidated = true;
    }
    cap("tf", "ready", "ready");
    return;
  }
  cap("tf", "loading", "pending");
  await loadRuntime("tf");
  log(`TF.js Backend: ${window.tf.getBackend()}`);
  S._tfValidated = true;
  cap("tf", "ready", "ready");
}
async function ensureObject() {
  if (S.visionWorker) return;
  cap("object", "loading", "pending");
  
  S.visionWorker = new Worker('vision-worker.js', { type: 'module' });
  
  S.visionWorker.onmessage = (e) => {
    const { type, predictions, message, backend } = e.data;
    if (type === 'ready') {
      cap("object", "ready", "ready");
      log(`Vision Worker Ready (Backend: ${backend})`, "info");
    } else if (type === 'results') {
      S.result.objects = predictions;
      S.inf.object.busy = false;
    } else if (type === 'error') {
      log("Vision Worker Error: " + message, "error");
      status("Worker Error: " + message, true);
      S.inf.object.busy = false;
    }
  };

  S.visionWorker.postMessage({ type: 'init' });
  return new Promise((resolve) => {
    const check = setInterval(() => {
      if (S.visionWorker) { clearInterval(check); resolve(); }
    }, 100);
  });
}
async function ensurePose() {
  if (S.model.pose) return S.model.pose;
  cap("pose", "loading", "pending");
  await ensureTF();
  await loadRuntime("pose");
  S.model.pose = await window.poseDetection.createDetector(window.poseDetection.SupportedModels.MoveNet, {
    modelType: window.poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
    enableSmoothing: true
  });
  cap("pose", "ready", "ready");
  return S.model.pose;
}
async function ensureHands() {
  if (S.model.hands) return S.model.hands;
  cap("hands", "loading", "pending");
  await loadRuntime("hands");
  const hands = new window.Hands({ locateFile: (f) => "https://cdn.jsdelivr.net/npm/@mediapipe/hands/" + f });
  hands.onResults((r) => { S.result.hands = r.multiHandLandmarks || []; S.result.handLabels = (r.multiHandedness || []).map((x) => x.label); });
  S.model.hands = hands;
  cap("hands", "ready", "ready");
  return hands;
}
async function ensureFace() {
  if (S.model.face) return S.model.face;
  cap("face", "loading", "pending");
  await loadRuntime("face");
  const face = new window.FaceMesh({ locateFile: (f) => "https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/" + f });
  face.onResults((r) => { S.result.faces = r.multiFaceLandmarks || []; });
  S.model.face = face;
  cap("face", "ready", "ready");
  return face;
}
async function ensureSegment() {
  if (S.model.segment) return S.model.segment;
  cap("segment", "loading", "pending");
  await loadRuntime("segment");
  const seg = new window.SelfieSegmentation({ locateFile: (f) => "https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/" + f });
  seg.onResults((r) => { S.result.segMask = r.segmentationMask || null; });
  S.model.segment = seg;
  cap("segment", "ready", "ready");
  return seg;
}
async function ensureOpenCv() {
  if (window.cv && window.__eyeSeeEwCvReady) {
    if (!S._cvValidated) {
      try {
        const test = new window.cv.Mat(1, 1, window.cv.CV_8UC1);
        test.delete();
        S._cvValidated = true;
        log("OpenCV warmup validation successful.");
      } catch (e) {
        log("OpenCV warmup validation failed: " + e.message, "error");
        throw new Error("OpenCV warmup validation failed: " + e.message);
      }
    }
    cap("opencv", "ready", "ready");
    return window.cv;
  }
  cap("opencv", "loading", "pending");
  await loadRuntime("opencv");
  try {
    const test = new window.cv.Mat(1, 1, window.cv.CV_8UC1);
    test.delete();
    S._cvValidated = true;
    log("OpenCV warmup validation successful.");
  } catch (e) {
    log("OpenCV warmup validation failed after load: " + e.message, "error");
    throw new Error("OpenCV warmup validation failed: " + e.message);
  }
  cap("opencv", "ready", "ready");
  return window.cv;
}
async function ensureMode(mode) {
  try {
    if (mode === "object") await ensureObject();
    if (mode === "pose") await ensurePose();
    if (mode === "hands") await ensureHands();
    if (mode === "face") await ensureFace();
    if (mode === "segment") await ensureSegment();
    if (mode === "opencv") await ensureOpenCv();
    S.unavailable.delete(mode);
  } catch (e) {
    S.unavailable.add(mode);
    modeOn(mode, false);
    cap(mode === "opencv" ? "opencv" : mode, "error", "error");
    throw e;
  }
}

function clearModeResults(mode) {
  if (mode === "object") S.result.objects = [];
  if (mode === "pose") S.result.poses = [];
  if (mode === "hands") { S.result.hands = []; S.result.handLabels = []; }
  if (mode === "face") S.result.faces = [];
  if (mode === "segment") S.result.segMask = null;
  if (mode === "opencv") S.result.cvRects = [];
}

function resetModeRuntime(mode) {
  try {
    if (mode === "pose" && S.model.pose?.dispose) S.model.pose.dispose();
    if (mode === "hands" && S.model.hands?.close) S.model.hands.close();
    if (mode === "face" && S.model.face?.close) S.model.face.close();
    if (mode === "segment" && S.model.segment?.close) S.model.segment.close();
  } catch (_) {
    // Best-effort release before retry.
  }
  if (mode !== "opencv") S.model[mode] = null;
  clearModeResults(mode);
}

async function retryCapability(key) {
  const retryBtn = d.retry[key];
  if (retryBtn) retryBtn.disabled = true;
  setLoader("Retrying " + key + "...", 0, 1, "Resetting runtime");
  status("Retrying " + key + " capability...");
  try {
    if (key === "tf") {
      cap("tf", "retrying", "pending");
      await ensureTF();
    } else {
      resetModeRuntime(key);
      S.unavailable.delete(key);
      cap(key, "retrying", "pending");
      await ensureMode(key);
    }
    setLoader("Retrying " + key + "...", 1, 1, "Ready");
    status("Retry success: " + key + " ready.");
  } catch (e) {
    cap(key, "error", "error");
    S.unavailable.add(key);
    status("Retry failed (" + key + "): " + e.message, true);
  } finally {
    hideLoader();
    updateDetectionStatus();
    savePrefs();
  }
}

async function measure(k, fn) {
  const t0 = performance.now();
  await fn();
  latency(k, performance.now() - t0);
}

async function runObject(ts) {
  const p = S.inf.object;
  if (!d.object.checked || p.busy || ts - p.last < p.interval || !d.video.videoWidth) return;
  
  if (!S.visionWorker) {
    await ensureObject();
    return;
  }

  p.busy = true;
  try {
    const bitmap = await createImageBitmap(d.video);
    const threshold = Number(d.objThr.value);
    const maxBoxes = Number(d.objMax.value);
    
    const t0 = performance.now();
    S.visionWorker.postMessage({ 
      type: 'predict', 
      data: { bitmap, threshold, maxBoxes } 
    }, [bitmap]);
    
    // Worker will set p.busy = false and update S.result.objects on message
    p.last = ts;
    // Note: Latency measurement for worker is handled via message round-trip in ensureObject listener
  } catch (e) { 
    log("Object worker post failed: " + e.message, "error");
    p.busy = false; 
  }
}
async function runPose(ts) {
  const p = S.inf.pose;
  if (!d.pose.checked || p.busy || ts - p.last < p.interval || !d.video.videoWidth) return;
  p.busy = true;
  try {
    await measure("pose", async () => {
      const m = await ensurePose();
      S.result.poses = await m.estimatePoses(d.video, { flipHorizontal: false });
    });
  } catch (e) { status("Pose fallback: " + e.message, true); modeOn("pose", false); cap("pose", "error", "error"); applyModeCooldown("pose", 15000, "runtime error"); }
  p.busy = false; p.last = ts;
}
async function runHands(ts) {
  const p = S.inf.hands;
  if (!d.hands.checked || p.busy || ts - p.last < p.interval || !d.video.videoWidth) return;
  p.busy = true;
  try {
    await measure("hands", async () => {
      const m = await ensureHands();
      m.setOptions({ maxNumHands: Number(d.handsMax.value), modelComplexity: 1, minDetectionConfidence: Number(d.handsThr.value), minTrackingConfidence: Math.max(0.3, Number(d.handsThr.value) - 0.1) });
      await m.send({ image: d.video });
    });
  } catch (e) { status("Hands fallback: " + e.message, true); modeOn("hands", false); cap("hands", "error", "error"); applyModeCooldown("hands", 15000, "runtime error"); }
  p.busy = false; p.last = ts;
}
async function runFace(ts) {
  const p = S.inf.face;
  if (!d.face.checked || p.busy || ts - p.last < p.interval || !d.video.videoWidth) return;
  p.busy = true;
  try {
    await measure("face", async () => {
      const m = await ensureFace();
      m.setOptions({ maxNumFaces: Number(d.faceMax.value), refineLandmarks: d.faceRef.checked, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
      await m.send({ image: d.video });
    });
  } catch (e) { status("Face fallback: " + e.message, true); modeOn("face", false); cap("face", "error", "error"); applyModeCooldown("face", 25000, "runtime error"); }
  p.busy = false; p.last = ts;
}
async function runSegment(ts) {
  const p = S.inf.segment;
  if (!d.segment.checked || p.busy || ts - p.last < p.interval || !d.video.videoWidth) return;
  p.busy = true;
  try {
    await measure("segment", async () => {
      const m = await ensureSegment();
      m.setOptions({ modelSelection: Number(d.segModel.value) });
      await m.send({ image: d.video });
    });
  } catch (e) { status("Segmentation fallback: " + e.message, true); modeOn("segment", false); cap("segment", "error", "error"); applyModeCooldown("segment", 25000, "runtime error"); }
  p.busy = false; p.last = ts;
}
async function runOpenCv(ts) {
  const p = S.inf.opencv;
  if (!d.opencv.checked || p.busy || ts - p.last < p.interval || !d.video.videoWidth) return;
  p.busy = true;
  try {
    await measure("opencv", async () => {
      const cv = await ensureOpenCv();
      const sw = d.video.videoWidth, sh = d.video.videoHeight;
      const scale = Math.min(1, 360 / Math.max(sw, sh));
      const pw = Math.max(160, Math.floor(sw * scale)), ph = Math.max(90, Math.floor(sh * scale));
      if (cvCanvas.width !== pw || cvCanvas.height !== ph) { cvCanvas.width = pw; cvCanvas.height = ph; }
      cvCtx.drawImage(d.video, 0, 0, pw, ph);
      const src = cv.imread(cvCanvas), gray = new cv.Mat(), edges = new cv.Mat();
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);
      cv.Canny(gray, edges, Number(d.cv1.value), Number(d.cv2.value), 3, false);
      cv.imshow(cvCanvas, edges);
      const rects = [];
      if (d.cvContours.checked) {
        const contours = new cv.MatVector(), hierarchy = new cv.Mat();
        cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
        for (let i = 0; i < contours.size(); i += 1) {
          const c = contours.get(i), area = cv.contourArea(c, false);
          if (area >= 140) { const r = cv.boundingRect(c); rects.push({ x: r.x / pw, y: r.y / ph, w: r.width / pw, h: r.height / ph }); }
          c.delete();
        }
        contours.delete(); hierarchy.delete();
      }
      S.result.cvRects = rects;
      src.delete(); gray.delete(); edges.delete();
    });
  } catch (e) { status("OpenCV fallback: " + e.message, true); modeOn("opencv", false); cap("opencv", "error", "error"); applyModeCooldown("opencv", 15000, "runtime error"); }
  p.busy = false; p.last = ts;
}

function drawSeg() {
  if (!d.segment.checked || !S.result.segMask) return;
  const m = S.result.segMask;
  const mw = m.width || m.videoWidth || d.video.videoWidth || 1;
  const mh = m.height || m.videoHeight || d.video.videoHeight || 1;
  if (segCanvas.width !== mw || segCanvas.height !== mh) { segCanvas.width = mw; segCanvas.height = mh; }
  segCtx.clearRect(0, 0, mw, mh);
  segCtx.drawImage(m, 0, 0, mw, mh);
  segCtx.globalCompositeOperation = "source-in";
  segCtx.fillStyle = "rgba(102,217,255,1)";
  segCtx.fillRect(0, 0, mw, mh);
  segCtx.globalCompositeOperation = "source-over";
  drawCover(segCanvas, Number(d.segAlpha.value));
}
function drawObject() {
  if (!d.object.checked || !S.result.objects.length) return;
  ctx.save(); ctx.lineWidth = 2; ctx.font = "12px Segoe UI";
  S.result.objects.forEach((o) => {
    if (!o.bbox) return;
    const a = map(o.bbox[0], o.bbox[1]), b = map(o.bbox[0] + o.bbox[2], o.bbox[1] + o.bbox[3]);
    const w = b.x - a.x, h = b.y - a.y;
    ctx.strokeStyle = "rgba(102,217,255,.95)"; ctx.fillStyle = "rgba(102,217,255,.17)";
    ctx.fillRect(a.x, a.y, w, h); ctx.strokeRect(a.x, a.y, w, h);
    const label = o.class + " " + Math.round((o.score || 0) * 100) + "%";
    ctx.fillStyle = "rgba(0,0,0,.66)"; ctx.fillRect(a.x, a.y - 18, Math.max(90, label.length * 7.1), 16);
    ctx.fillStyle = "#eaf8ff"; ctx.fillText(label, a.x + 5, a.y - 6);
  });
  ctx.restore();
}
function drawPose() {
  if (!d.pose.checked || !S.result.poses.length) return;
  const min = Number(d.poseThr.value), sk = d.poseSkel.checked;
  ctx.save();
  S.result.poses.forEach((pose) => {
    const kp = pose.keypoints || [], by = {};
    kp.forEach((k) => { if (typeof k.x === "number" && typeof k.y === "number") by[k.name] = k; });
    if (sk) {
      ctx.strokeStyle = "rgba(142,247,162,.78)"; ctx.lineWidth = 2;
      PEDGE.forEach((e) => {
        const a = by[e[0]], b = by[e[1]];
        if (!a || !b || (a.score || 0) < min || (b.score || 0) < min) return;
        const pa = map(a.x, a.y), pb = map(b.x, b.y);
        ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); ctx.stroke();
      });
    }
    ctx.fillStyle = "rgba(142,247,162,.95)";
    kp.forEach((k) => { if ((k.score || 0) < min) return; const p = map(k.x, k.y); ctx.beginPath(); ctx.arc(p.x, p.y, 3.1, 0, Math.PI * 2); ctx.fill(); });
  });
  ctx.restore();
}
function drawHands() {
  if (!d.hands.checked || !S.result.hands.length) return;
  ctx.save(); ctx.lineWidth = 2; ctx.strokeStyle = "rgba(255,202,122,.82)"; ctx.fillStyle = "rgba(255,202,122,.95)"; ctx.font = "12px Segoe UI";
  S.result.hands.forEach((lm, idx) => {
    HAND.forEach((e) => {
      const a = lm[e[0]], b = lm[e[1]]; if (!a || !b) return;
      const pa = map(a.x * d.video.videoWidth, a.y * d.video.videoHeight), pb = map(b.x * d.video.videoWidth, b.y * d.video.videoHeight);
      ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); ctx.stroke();
    });
    lm.forEach((pt) => { const p = map(pt.x * d.video.videoWidth, pt.y * d.video.videoHeight); ctx.beginPath(); ctx.arc(p.x, p.y, 2.3, 0, Math.PI * 2); ctx.fill(); });
    const root = lm[0], lab = S.result.handLabels[idx] || "Hand";
    if (root) {
      const p = map(root.x * d.video.videoWidth, root.y * d.video.videoHeight);
      ctx.fillStyle = "rgba(0,0,0,.66)"; ctx.fillRect(p.x + 8, p.y - 14, 56, 16);
      ctx.fillStyle = "#ffe7be"; ctx.fillText(lab, p.x + 12, p.y - 3);
      ctx.fillStyle = "rgba(255,202,122,.95)";
    }
  });
  ctx.restore();
}
function drawFace() {
  if (!d.face.checked || !S.result.faces.length) return;
  ctx.save(); ctx.fillStyle = "rgba(255,120,210,.78)";
  S.result.faces.forEach((lm) => {
    for (let i = 0; i < lm.length; i += 6) {
      const p = lm[i]; if (!p) continue;
      const m = map(p.x * d.video.videoWidth, p.y * d.video.videoHeight);
      ctx.beginPath(); ctx.arc(m.x, m.y, 1.6, 0, Math.PI * 2); ctx.fill();
    }
  });
  ctx.restore();
}
function drawOpenCv() {
  if (!d.opencv.checked) return;
  if (cvCanvas.width > 0 && cvCanvas.height > 0) drawCover(cvCanvas, 0.22);
  if (!d.cvContours.checked) return;
  ctx.save(); ctx.strokeStyle = "rgba(255,142,142,.9)"; ctx.lineWidth = 1.5;
  S.result.cvRects.forEach((r) => {
    const p1 = map(r.x * d.video.videoWidth, r.y * d.video.videoHeight);
    const p2 = map((r.x + r.w) * d.video.videoWidth, (r.y + r.h) * d.video.videoHeight);
    ctx.strokeRect(p1.x, p1.y, p2.x - p1.x, p2.y - p1.y);
  });
  ctx.restore();
}
function draw() {
  ctx.clearRect(0, 0, d.canvas.width, d.canvas.height);
  drawSeg(); drawOpenCv(); drawObject(); drawPose(); drawHands(); drawFace();
}

function stopStream(stream) { if (!stream) return; stream.getTracks().forEach((t) => t.stop()); }
async function startCam(deviceId) {
  const tries = [];
  if (deviceId) tries.push({ audio: false, video: { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 30 } } });
  tries.push({ audio: false, video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 30 } } });
  tries.push({ audio: false, video: { facingMode: { ideal: "user" }, width: { ideal: 960 }, height: { ideal: 540 } } });
  tries.push({ audio: false, video: true });
  let err = null;
  for (const c of tries) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(c);
      stopStream(S.stream); S.stream = stream; d.video.srcObject = stream;
      await d.video.play().catch(() => Promise.resolve());
      if (d.video.readyState < 1) await new Promise((r) => { d.video.onloadedmetadata = () => r(); });
      resizeCanvas();
      updateCameraTrackInfo();
      return;
    } catch (e) { err = e; }
  }
  throw err || new Error("Unable to start camera");
}
async function refreshDevices() {
  if (!navigator.mediaDevices?.enumerateDevices) return;
  const dev = await navigator.mediaDevices.enumerateDevices();
  const cams = dev.filter((x) => x.kind === "videoinput");
  const cur = d.camera.value; d.camera.innerHTML = "";
  cams.forEach((c, i) => { const o = document.createElement("option"); o.value = c.deviceId; o.textContent = c.label || "Camera " + (i + 1); d.camera.appendChild(o); });
  if (!cams.length) { const o = document.createElement("option"); o.value = ""; o.textContent = "No camera detected"; d.camera.appendChild(o); d.camera.disabled = true; return; }
  d.camera.disabled = false;
  const hasCur = cams.some((c) => c.deviceId === cur);
  if (S.deviceId && cams.some((c) => c.deviceId === S.deviceId)) d.camera.value = S.deviceId;
  else if (hasCur) d.camera.value = cur;
  else d.camera.value = cams[0].deviceId;
  S.deviceId = d.camera.value;
}
async function switchCam(id) {
  if (!S.started || !id) return;
  status("Switching camera...");
  try { S.deviceId = id; await startCam(id); savePrefs(); status("Camera switched."); }
  catch (e) { status("Camera switch failed: " + e.message, true); }
}

async function bootstrapCaps() {
  cap("tf", window.tf ? "ready" : "lazy", window.tf ? "ready" : "pending");
  cap("object", window.cocoSsd ? "runtime ready" : "lazy", "pending");
  cap("pose", window.poseDetection ? "runtime ready" : "lazy", "pending");
  cap("hands", window.Hands ? "runtime ready" : "lazy", "pending");
  cap("face", window.FaceMesh ? "runtime ready" : "lazy", "pending");
  cap("segment", window.SelfieSegmentation ? "runtime ready" : "lazy", "pending");
  cap("opencv", window.cv && window.__eyeSeeEwCvReady ? "ready" : "lazy", window.cv && window.__eyeSeeEwCvReady ? "ready" : "pending");
  log("Runtime preload disabled. Pipelines now load on demand.");
}

async function init() {
  if (S.started) return;
  S.started = true;
  d.startup.style.display = "none";
  S.load.preloadSuppressed = true;
  setLoader("Initializing camera...", 0, 1, "Requesting media permission");
  status("Initializing camera...");
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("getUserMedia unavailable");
    await startCam(S.deviceId || "");
    setLoader("Initializing camera...", 1, 1, "Camera active");
    hideLoader();
    await refreshDevices();
    status("Camera ready. Enable a mode from the panel.");
    S.running = true;
    requestAnimationFrame(loop);
  } catch (e) {
    hideLoader();
    status("Init failed: " + e.message, true);
    d.startup.style.display = "flex";
    S.started = false;
  }
}
function stop() { S.running = false; stopStream(S.stream); S.stream = null; stopAuto(); }

function applyProfile(p) {
  clearModes(); modeOn(p.mode, true); randomPreset(p.mode);
  S.auto.lastMode = p.mode;
  d.autoLabel.textContent = "Auto profile: " + p.name;
  setAutoQcLabel("QC: evaluating runtime stability...");
  ensureMode(p.mode).catch((e) => {
    status("Auto fallback: " + e.message, true);
    applyModeCooldown(p.mode, 20000, "load failure");
    if (d.auto.checked) {
      setTimeout(autoStep, 350);
    }
  });
}

function modeAutoWeight(mode, now) {
  if (S.unavailable.has(mode)) return 0;
  if ((S.auto.cooldownUntil[mode] || 0) > now) return 0;
  let weight = 1;
  const l = S.metric.latency[mode] || 0;
  if (l > 0) weight *= Math.max(0.2, 1.45 - l / 170);
  if (S.metric.fps > 0 && S.metric.fps < 12 && HEAVY.has(mode)) weight *= 0.2;
  if (mode === S.auto.lastMode) weight *= 0.45;
  return weight;
}

function nextAutoProfile() {
  const now = performance.now();
  const pool = AUTO.map((entry) => ({ entry, w: modeAutoWeight(entry.mode, now) })).filter((x) => x.w > 0);
  if (!pool.length) return null;

  const total = pool.reduce((sum, item) => sum + item.w, 0);
  let pick = Math.random() * total;
  for (let i = 0; i < pool.length; i += 1) {
    pick -= pool[i].w;
    if (pick <= 0) return pool[i].entry;
  }
  return pool[pool.length - 1].entry;
}
function autoStep() {
  const profile = nextAutoProfile();
  if (!profile) {
    status("Auto mode paused: all pipelines unavailable or cooling down.", true);
    stopAuto();
    return;
  }
  applyProfile(profile);
}
function startAuto() {
  stopAuto();
  S.auto.idx = 0;
  S.auto.lastMode = "";
  setAutoQcLabel("QC: active, monitoring FPS and adapting profiles.");
  autoStep();
  S.auto.id = setInterval(autoStep, Number(d.autoInt.value) * 1000);
}
function stopAuto() {
  if (S.auto.id) clearInterval(S.auto.id);
  S.auto.id = null;
  d.autoLabel.textContent = "Auto is off.";
  setAutoQcLabel("QC monitor is idle.");
}
function autoChanged() {
  if (d.auto.checked) { disableManual(true); startAuto(); }
  else { stopAuto(); clearModes(); disableManual(false); }
  syncPanels();
  savePrefs();
}

// ── Spatial Scene Graph Integration ───────────────────────────────────────────

function _maybeUpdateAndBroadcastSceneGraph() {
  if (!S.running || !d.video.videoWidth) return;
  const videoInfo = { width: d.video.videoWidth, height: d.video.videoHeight, mirrored: d.mirror.checked };
  const graph = maybeUpdateSceneGraph(S.result, videoInfo);
  if (graph && window.electronAPI?.updateSceneGraph) {
    window.electronAPI.updateSceneGraph(graph);
    if (d.spatialStatus) {
      const objCount = (graph.objects || []).length;
      const surfCount = (graph.surfaces || []).length;
      d.spatialStatus.textContent = `${surfCount} surface${surfCount !== 1 ? 's' : ''}, ${objCount} object${objCount !== 1 ? 's' : ''} mapped. Room: ${graph.room_id || 'unknown'}`;
    }
  }
}

/**
 * Capture a JPEG snapshot of a specific object region (or the full frame if no bbox).
 * @param {number[]|null} bbox  — normalized [x, y, w, h] in [0,1] range
 * @returns {string|null}       — data URL
 */
function _captureObjectSnapshot(bbox) {
  if (!d.video.videoWidth || !d.video.videoHeight) return null;
  const vw = d.video.videoWidth, vh = d.video.videoHeight;
  let sx = 0, sy = 0, sw = vw, sh = vh;

  if (bbox && bbox.length === 4) {
    // Expand slightly for context
    const pad = 0.05;
    sx = Math.max(0, (bbox[0] - pad) * vw);
    sy = Math.max(0, (bbox[1] - pad) * vh);
    sw = Math.min(vw - sx, (bbox[2] + pad * 2) * vw);
    sh = Math.min(vh - sy, (bbox[3] + pad * 2) * vh);
  }

  const c = document.createElement('canvas');
  c.width = Math.round(sw);
  c.height = Math.round(sh);
  const c2d = c.getContext('2d');
  c2d.drawImage(d.video, sx, sy, sw, sh, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.82);
}

function loop(ts) {
  if (!S.running) return;
  resizeCanvas();
  S.frameSeq += 1;

  const skip = Number(d.frameSkip.value);
  if (skip > 0 && S.frameSeq % (skip + 1) !== 0) {
    requestAnimationFrame(loop);
    return;
  }

  const capValue = Number(d.fpsCap.value);
  if (capValue > 0) {
    const minDelta = 1000 / capValue;
    if (ts - S.lastWorkTs < minDelta) {
      requestAnimationFrame(loop);
      return;
    }
  }
  S.lastWorkTs = ts;

  fps(ts);
  runObject(ts); runPose(ts); runHands(ts); runFace(ts); runSegment(ts); runOpenCv(ts);
  updateDetectionStatus();
  draw();
  // Spatial scene graph update (rate-limited internally to every 2s)
  _maybeUpdateAndBroadcastSceneGraph();
  maybeSendAgentUpdate(ts).catch((e) => log("Agent bridge loop error: " + e.message, "error"));
  requestAnimationFrame(loop);
}

function bindMenu() {
  d.menuBtn.addEventListener("click", (e) => { e.stopPropagation(); setPanel(true); });
  d.menuBtn.addEventListener("touchstart", (e) => { e.preventDefault(); e.stopPropagation(); setPanel(true); }, { passive: false });
  d.closeBtn.addEventListener("click", (e) => { e.stopPropagation(); setPanel(false); });
  d.closeBtn.addEventListener("touchstart", (e) => { e.preventDefault(); e.stopPropagation(); setPanel(false); }, { passive: false });
  document.addEventListener("click", (e) => {
    if (!d.panel.classList.contains("open")) return;
    if (d.panel.contains(e.target) || d.menuBtn.contains(e.target)) return;
    setPanel(false);
  });
  document.addEventListener("touchstart", (e) => {
    if (!d.panel.classList.contains("open")) return;
    if (d.panel.contains(e.target) || d.menuBtn.contains(e.target)) return;
    setPanel(false);
  }, { passive: true });
}
function bindStartup() {
  d.startup.addEventListener("click", init);
  d.startup.addEventListener("touchstart", (e) => { e.preventDefault(); init(); }, { passive: false });
  d.startup.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); init(); } });
}
async function performAiDescription() {
  const key = (d.hfKey.value || "").trim();
  if (!key) {
    status("Enter a Hugging Face API Key first.", true);
    return "Error: Hugging Face API Key not set in Eye-See-You UI.";
  }
  
  d.aiOutput.textContent = "AI is looking...";
  if (d.aiDescribe) d.aiDescribe.disabled = true;
  
  try {
    hfService.initHf(key);
    const canvas = document.createElement("canvas");
    canvas.width = d.video.videoWidth;
    canvas.height = d.video.videoHeight;
    canvas.getContext("2d").drawImage(d.video, 0, 0);
    
    const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.85));
    const description = await hfService.describeScene(blob);
    
    d.aiOutput.textContent = description;
    log("AI Description: " + description, "info");
    status("Scene described.");
    return description;
  } catch (err) {
    const errMsg = "Error: " + err.message;
    d.aiOutput.textContent = errMsg;
    status("AI Describe failed.", true);
    return errMsg;
  } finally {
    if (d.aiDescribe) d.aiDescribe.disabled = false;
  }
}

function bindControls() {
  ["auto-interval","agent-interval","object-threshold","object-max-boxes","pose-threshold","hands-max","hands-threshold","face-max","segment-model","segment-alpha","opencv-threshold1","opencv-threshold2","fps-cap","frame-skip"].forEach((id) => {
    const el = document.getElementById(id); el.addEventListener("input", () => { out(); savePrefs(); }); el.addEventListener("change", () => { out(); savePrefs(); });
  });
  MODES.forEach((m) => {
    modeEl(m).addEventListener("change", async () => {
      modeOn(m, modeEl(m).checked);
      if (modeEl(m).checked && !confirmHighLoadIfNeeded(m)) {
        modeOn(m, false);
        savePrefs();
        return;
      }
      savePrefs();
      if (modeEl(m).checked) {
        try {
          setLoader("Loading " + m + " pipeline...", 0, 1, "Preparing runtime and model");
          status("Loading " + m + " pipeline...");
          await ensureMode(m);
          setLoader("Loading " + m + " pipeline...", 1, 1, "Ready");
          hideLoader();
          status(m + " pipeline active.");
        }
        catch (e) { status(m + " unavailable: " + e.message, true); }
        finally { hideLoader(); }
      } else status(m + " pipeline disabled.");
    });
  });
  Object.keys(d.retry).forEach((key) => {
    const btn = d.retry[key];
    if (!btn) return;
    btn.addEventListener("click", () => {
      retryCapability(key).catch((e) => status("Retry error: " + e.message, true));
    });
  });
  if (d.diagCopy) d.diagCopy.addEventListener("click", copyDiagnosticSnapshot);
  
  if (d.aiDescribe) {
    d.aiDescribe.addEventListener("click", performAiDescription);
  }

  // Handle MCP Trigger
  if (window.electronAPI && window.electronAPI.onTriggerAiDescribe) {
    window.electronAPI.onTriggerAiDescribe(async () => {
      const result = await performAiDescription();
      window.electronAPI.sendAiDescriptionResult(result);
    });
  }

  // Voice Control Initialization
  d.voiceEnable.addEventListener("change", () => {
    if (d.voiceEnable.checked) {
      const ok = voiceService.initVoice((cmd) => {
        d.voiceStatus.textContent = "Last command: " + cmd;
        
        // Broadcast to MCP Server
        if (window.electronAPI && window.electronAPI.sendVoiceTranscript) {
          window.electronAPI.sendVoiceTranscript({ text: cmd });
        }

        if (cmd.includes("describe") || cmd.includes("what do you see")) {
          performAiDescription().then(res => {
            if (d.voiceSpeak.checked) voiceService.speak(res);
          });
        } else if (cmd.includes("remember") && (cmd.includes("my") || cmd.includes("this"))) {
          // "remember my keys" / "remember this wallet"
          const target = cmd.replace(/remember|my|this|please|the/g, "").trim();
          if (target) {
            log(`Voice: remember object triggered for: ${target}`, "info");
            status(`Snapshotting memory for "${target}"...`);
            // Signal to any connected agent via TTS — the agent should call remember_object
            if (d.voiceSpeak.checked) voiceService.speak(`Saving a memory for ${target}.`);
          }
        } else if (cmd.includes("where is") || cmd.includes("find my")) {
          const target = cmd.replace(/where is|find my|find|my|the/g, "").trim();
          if (target) {
            log(`Voice: locate object triggered for: ${target}`, "info");
            status(`Looking for "${target}" in memory...`);
            if (d.voiceSpeak.checked) voiceService.speak(`Checking my memory for ${target}.`);
          }
        } else if (cmd.includes("find") || cmd.includes("search for")) {
          const target = cmd.replace(/find|search for|a |the/g, "").trim();
          if (target) {
            d.objLabels.value = target;
            status(`Searching for ${target}...`);
            log(`Voice search triggered for: ${target}`, "info");
            if (!d.object.checked) d.object.click();
          }
        } else if (cmd.includes("start") || cmd.includes("camera")) {
          if (!S.started) init();
        }
      });
      if (ok) {
        voiceService.startListening();
        d.voiceStatus.textContent = "Status: Listening...";
        status("Voice commands enabled.");
      } else {
        d.voiceEnable.checked = false;
        status("Voice API not supported.", true);
      }
    } else {
      voiceService.stopListening();
      d.voiceStatus.textContent = "Status: Silent";
      status("Voice commands disabled.");
    }
    savePrefs();
  });

  // Handle MCP Speak requests
  if (window.electronAPI && window.electronAPI.onMcpSpeak) {
    window.electronAPI.onMcpSpeak((text) => {
      log("MCP requested TTS: " + text, "info");
      voiceService.speak(text);
    });
  }

  d.auto.addEventListener("change", autoChanged);
  d.autoInt.addEventListener("change", () => { if (d.auto.checked) startAuto(); savePrefs(); });
  d.autoRnd.addEventListener("change", () => { if (d.auto.checked) startAuto(); savePrefs(); });
  d.agentEnable.addEventListener("change", () => {
    syncAgentPanel();
    savePrefs();
    if (!d.agentEnable.checked) setAgentStatus("Bridge is off.");
    else setAgentStatus("Bridge enabled. Waiting for consent and local endpoint.");
  });
  d.agentConsent.addEventListener("change", () => {
    savePrefs();
    if (d.agentConsent.checked) setAgentStatus("Consent active. Bridge can send data.");
    else setAgentStatus("Consent required before sending.", true);
  });
  d.agentEndpoint.addEventListener("change", () => {
    const parsed = parseAgentEndpoint();
    if (!parsed.ok) setAgentStatus(parsed.error, true);
    else setAgentStatus("Endpoint ready: " + parsed.url);
    savePrefs();
  });
  d.agentLocalOnly.addEventListener("change", () => {
    const parsed = parseAgentEndpoint();
    if (!parsed.ok) setAgentStatus(parsed.error, true);
    else setAgentStatus("Endpoint ready: " + parsed.url);
    savePrefs();
  });
  d.agentMode.addEventListener("change", () => {
    if (d.agentMode.value === "snapshot") {
      setAgentStatus("Snapshot mode enabled. Prefer localhost endpoint + shared key.");
    } else {
      setAgentStatus("Summary-only mode enabled (safer).");
    }
    savePrefs();
  });
  d.agentRedact.addEventListener("change", () => {
    savePrefs();
    if (d.agentMode.value === "snapshot") {
      setAgentStatus(d.agentRedact.checked ? "Snapshot redaction enabled." : "Snapshot redaction disabled.", !d.agentRedact.checked);
    }
  });
  d.agentSharedKey.addEventListener("change", () => {
    savePrefs();
    if (!(d.agentSharedKey.value || "").trim()) {
      setAgentStatus("No shared key set. Local agent should use network and endpoint safeguards.", true);
    }
  });
  d.agentSendNow.addEventListener("click", () => {
    maybeSendAgentUpdate(performance.now(), true).catch((e) => {
      setAgentStatus("Bridge test failed: " + e.message, true);
    });
  });
  d.camera.addEventListener("change", () => { savePrefs(); switchCam(d.camera.value); });
  d.mirror.addEventListener("change", () => { applyMirrorOutput(); savePrefs(); });
  d.showDevLog.addEventListener("change", () => {
    S.log.visible = d.showDevLog.checked;
    savePrefs();
    flushLogOverlay();
  });
  d.logLevel.addEventListener("change", () => {
    S.log.level = d.logLevel.value;
    if (window.electronAPI) window.electronAPI.setLogLevel(d.logLevel.value);
    savePrefs();
    flushLogOverlay();
  });
  d.logClear.addEventListener("click", () => {
    S.log.lines = [];
    flushLogOverlay();
  });
  window.addEventListener("resize", resizeCanvas);
  window.addEventListener("beforeunload", stop);
  if (navigator.mediaDevices?.addEventListener) navigator.mediaDevices.addEventListener("devicechange", () => refreshDevices().catch(() => {}));
}

function updateCameraTrackInfo() {
  if (!S.stream) {
    if (d.cameraInfo) d.cameraInfo.textContent = "";
    return;
  }
  const tracks = S.stream.getVideoTracks();
  if (!tracks.length) {
    if (d.cameraInfo) d.cameraInfo.textContent = "no tracks";
    return;
  }
  const s = tracks[0].getSettings();
  const info = `${s.width || 0}x${s.height || 0}@${Math.round(s.frameRate || 0)}fps`;
  if (d.cameraInfo) {
    d.cameraInfo.textContent = info;
    d.cameraInfo.title = `deviceId: ${s.deviceId || "unknown"}\nfacing: ${s.facingMode || "unknown"}`;
  }
}

function copyDiagnosticSnapshot() {
  const tracks = S.stream ? S.stream.getVideoTracks() : [];
  const trackSettings = tracks.length > 0 ? tracks[0].getSettings() : {};
  const activeModesList = activeModes();
  
  const snapshot = {
    app: "eye-see-you",
    version: "0.8.1-sprint1",
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    screen: {
      w: window.innerWidth,
      h: window.innerHeight,
      dpr: window.devicePixelRatio
    },
    camera: {
      active: !!S.stream,
      deviceId: S.deviceId,
      settings: trackSettings
    },
    capabilities: {
      tf: d.cap.tf.textContent,
      object: d.cap.object.textContent,
      pose: d.cap.pose.textContent,
      hands: d.cap.hands.textContent,
      face: d.cap.face.textContent,
      segment: d.cap.segment.textContent,
      opencv: d.cap.opencv.textContent
    },
    performance: {
      fps: Number(S.metric.fps.toFixed(2)),
      latency: S.metric.latency
    },
    state: {
      running: S.running,
      auto: !!S.auto.id,
      modes: activeModesList,
      toggles: {
        object: d.object.checked,
        pose: d.pose.checked,
        hands: d.hands.checked,
        face: d.face.checked,
        segment: d.segment.checked,
        opencv: d.opencv.checked
      }
    },
    logs: S.log.lines.slice(-40).map(l => `[${l.time}] ${l.level.toUpperCase()} ${l.message}`)
  };

  const text = JSON.stringify(snapshot, null, 2);
  navigator.clipboard.writeText(text).then(() => {
    log("Diagnostic snapshot copied to clipboard", "info");
    const oldStatus = d.status.textContent;
    status("Diagnostic copied.");
    setTimeout(() => { if (d.status.textContent === "Diagnostic copied.") d.status.textContent = oldStatus; }, 2000);
  }).catch(err => {
    log("Failed to copy diagnostic snapshot: " + err, "error");
    status("Copy failed. See dev log.", true);
  });
}

function boot() {
  if (!S.agent.sessionId) {
    if (window.crypto?.randomUUID) S.agent.sessionId = window.crypto.randomUUID();
    else S.agent.sessionId = "session-" + Math.floor(Math.random() * 1e9).toString(16);
  }
  loadPrefs();
  bindMenu(); bindStartup(); bindControls(); bindBridgeDashboard();
  updateTokenStatus(15); // Initial simulation
  d.logLevel.value = S.log.level;
  d.showDevLog.checked = S.log.visible;
  out();
  syncPanels();
  disableManual(false);
  updateDetectionStatus();
  applyMirrorOutput();
  Object.keys(d.cap).forEach((k) => cap(k, "pending", "pending"));
  status("Idle. Tap start to initialize camera.");
  if (!d.agentEnable.checked) setAgentStatus("Bridge is off.");
  else if (!d.agentConsent.checked) setAgentStatus("Consent required before sending.", true);
  else {
    const parsed = parseAgentEndpoint();
    setAgentStatus(parsed.ok ? "Bridge ready. Waiting for next send window." : parsed.error, !parsed.ok);
  }
  flushLogOverlay();
  setAutoQcLabel("QC monitor is idle.");
  log("Boot complete. Verbose logging is active. Runtimes will lazy-load per mode.", "info");
  bootstrapCaps().catch(() => {});
  window.addEventListener("error", (e) => status("Runtime error: " + e.message, true));
}

boot();
