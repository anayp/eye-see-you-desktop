/**
 * spatial-engine.js — Lightweight Spatial Scene Graph
 *
 * Converts real-time detection data (bounding boxes, OpenCV contours, optional
 * depth maps) into a JSON "scene graph" that agents can reason over.
 *
 * Strategy (no depth sensor required):
 *  1. Surface detection via simple heuristics on object clusters + frame geometry
 *  2. Perspective-corrected grid projected onto each detected surface
 *  3. Objects anchored to the nearest surface with grid cell coordinates
 *  4. Stable objects promoted to "spatial anchors" for future reference
 *  5. GPS mode swap — when outdoors, lat/lng replaces grid cells
 *
 * The scene graph is a plain JSON object that any LLM can read directly.
 */

// ── State ──────────────────────────────────────────────────────────────────────
let sceneGraph = null;
let _stableObjects = new Map();   // class → { count, lastSeen, bbox }
let _lastUpdateTs = 0;
let _roomId = 'room_' + Math.floor(Math.random() * 9999).toString(16);
let _gpsMode = false;
let _lastGps = null;
let _anchorAgeThresholdMs = 10000; // an object seen for 10s becomes a spatial anchor
let _gridCols = 10;
let _gridRows = 8;
const UPDATE_INTERVAL_MS = 2000;  // how often to push a new graph (not every frame)

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Call after every detection cycle. Internally rate-limited to UPDATE_INTERVAL_MS.
 * @param {object} detections  — S.result from app.js (objects, cvRects, etc.)
 * @param {object} videoInfo   — { width, height, mirrored }
 * @param {object} [depthMap]  — optional { data: Float32Array, width, height }
 * @returns {object|null}      — updated scene graph, or null if not yet time
 */
function maybeUpdateSceneGraph(detections, videoInfo, depthMap) {
  const now = performance.now();
  if (now - _lastUpdateTs < UPDATE_INTERVAL_MS) return null;
  _lastUpdateTs = now;

  return _buildSceneGraph(detections, videoInfo, depthMap);
}

/** Force an immediate scene graph update regardless of rate limit. */
function forceUpdateSceneGraph(detections, videoInfo, depthMap) {
  _lastUpdateTs = performance.now();
  return _buildSceneGraph(detections, videoInfo, depthMap);
}

/** Toggle between indoor (grid) and outdoor (GPS) mode */
function setGpsMode(enabled) {
  _gpsMode = enabled;
  if (enabled) {
    _startGpsWatch();
  } else {
    _stopGpsWatch();
    _lastGps = null;
  }
}

/** Get the most recent scene graph without triggering a rebuild */
function getLatestSceneGraph() {
  return sceneGraph;
}

/** Set room identifier (e.g. from agent context) */
function setRoomId(id) {
  _roomId = id;
}

// ── Core Builder ───────────────────────────────────────────────────────────────

function _buildSceneGraph(detections, videoInfo, depthMap) {
  const { width: vw, height: vh, mirrored } = videoInfo;
  if (!vw || !vh) return null;

  const objects = detections.objects || [];
  const cvRects = detections.cvRects || [];
  const now = Date.now();

  // 1. Update stable object tracker
  _updateStableTracker(objects, now);

  // 2. Detect surfaces from frame geometry + object distribution
  const surfaces = _detectSurfaces(objects, cvRects, vw, vh, depthMap);

  // 3. Assign each object to a surface and compute grid cell
  const mappedObjects = _assignObjectsToSurfaces(objects, surfaces, vw, vh);

  // 4. Promote long-lived objects to spatial anchors
  const anchors = _buildAnchors(now, vw, vh);

  // 5. Build final graph
  sceneGraph = {
    schema_version: 1,
    mode: _gpsMode ? 'outdoor_gps' : 'indoor',
    room_id: _roomId,
    timestamp: new Date().toISOString(),
    camera: { width: vw, height: vh, mirrored: !!mirrored },
    surfaces,
    objects: mappedObjects,
    spatial_anchors: anchors,
    gps: _gpsMode ? _lastGps : null,
    stats: {
      total_objects: objects.length,
      surfaces_detected: surfaces.length,
      stable_anchors: anchors.length
    }
  };

  return sceneGraph;
}

// ── Surface Detection ──────────────────────────────────────────────────────────

function _detectSurfaces(objects, cvRects, vw, vh, depthMap) {
  const surfaces = [];

  // Strategy 1: Infer a "floor" surface — large area in the bottom 40% of frame
  // with relatively low object density (just open space).
  const floorY = Math.round(vh * 0.6);  // floor starts at 60% height
  const floorSurface = {
    id: 'floor',
    type: 'floor',
    confidence: 0.65,
    bbox_screen: [0, floorY, vw, vh - floorY],
    grid: { cols: _gridCols, rows: Math.round(_gridRows * 0.4) },
    homography: _buildSimpleHomography(0, floorY, vw, vh - floorY, vw, vh)
  };
  surfaces.push(floorSurface);

  // Strategy 2: Infer horizontal surfaces (tables/desks) — clusters of objects
  // in the middle vertical band (25%–65% height)
  const tableBand = objects.filter(o => {
    if (!o.bbox) return false;
    const cy = (o.bbox[1] + o.bbox[3] / 2) / vh;
    return cy > 0.25 && cy < 0.65;
  });

  if (tableBand.length >= 2) {
    // Find the bounding box of the cluster
    let minX = Infinity, minY = Infinity, maxX = 0, maxY = 0;
    tableBand.forEach(o => {
      minX = Math.min(minX, o.bbox[0]);
      minY = Math.min(minY, o.bbox[1]);
      maxX = Math.max(maxX, o.bbox[0] + o.bbox[2]);
      maxY = Math.max(maxY, o.bbox[1] + o.bbox[3]);
    });

    // Expand slightly to give the surface some breathing room
    const padX = (maxX - minX) * 0.15;
    const padY = (maxY - minY) * 0.2;
    const sx = Math.max(0, minX - padX);
    const sy = Math.max(0, minY - padY);
    const sw = Math.min(vw - sx, (maxX - minX) + padX * 2);
    const sh = Math.min(vh - sy, (maxY - minY) + padY * 2);

    const tableSurface = {
      id: 'table_A',
      type: 'table',
      confidence: Math.min(0.95, 0.55 + tableBand.length * 0.08),
      bbox_screen: [Math.round(sx), Math.round(sy), Math.round(sw), Math.round(sh)],
      grid: { cols: _gridCols, rows: _gridRows },
      homography: _buildSimpleHomography(sx, sy, sw, sh, vw, vh)
    };
    surfaces.push(tableSurface);
  }

  // Strategy 3: If depth map available, find flat regions by variance
  if (depthMap && depthMap.data && depthMap.data.length > 0) {
    const flatSurfaces = _depthMapToSurfaces(depthMap, vw, vh);
    flatSurfaces.forEach((s, i) => {
      s.id = `depth_surface_${i}`;
      surfaces.push(s);
    });
  }

  return surfaces;
}

/**
 * Build a simple pseudo-homography for mapping screen coords to grid cells.
 * In real computer vision this would be a proper 3×3 matrix.
 * Here we store the bounding rect so we can inverse-project any point.
 */
function _buildSimpleHomography(x, y, w, h, vw, vh) {
  return {
    type: 'simple_rect',
    rect: { x, y, w, h },
    perspective_factor: 1 + (y / vh) * 0.5  // objects higher up appear smaller
  };
}

/**
 * Extract flat surfaces from a depth map by finding low-variance regions.
 * depthMap.data is a Float32Array of relative depth values [0, 1].
 */
function _depthMapToSurfaces(depthMap, vw, vh) {
  const { data, width: dw, height: dh } = depthMap;
  const surfaces = [];
  // Sample a grid of 10×8 patches and find low-variance (flat) ones
  const patchCols = 10, patchRows = 8;
  const patchW = Math.floor(dw / patchCols), patchH = Math.floor(dh / patchRows);
  const flatPatches = [];

  for (let row = 0; row < patchRows; row++) {
    for (let col = 0; col < patchCols; col++) {
      const px = col * patchW, py = row * patchH;
      let sum = 0, sumSq = 0, count = 0;
      for (let dy = 0; dy < patchH; dy++) {
        for (let dx = 0; dx < patchW; dx++) {
          const idx = (py + dy) * dw + (px + dx);
          if (idx < data.length) { const v = data[idx]; sum += v; sumSq += v * v; count++; }
        }
      }
      if (count === 0) continue;
      const mean = sum / count;
      const variance = sumSq / count - mean * mean;
      if (variance < 0.003) {  // flat patch
        flatPatches.push({ col, row, mean, variance });
      }
    }
  }

  // Cluster contiguous flat patches into surfaces
  if (flatPatches.length > 4) {
    surfaces.push({
      type: 'depth_plane',
      confidence: 0.78,
      bbox_screen: [0, Math.round(vh * 0.2), vw, Math.round(vh * 0.6)],
      grid: { cols: _gridCols, rows: _gridRows },
      depth_mean: flatPatches.reduce((s, p) => s + p.mean, 0) / flatPatches.length,
      homography: _buildSimpleHomography(0, Math.round(vh * 0.2), vw, Math.round(vh * 0.6), vw, vh)
    });
  }

  return surfaces;
}

// ── Object-to-Surface Assignment ───────────────────────────────────────────────

function _assignObjectsToSurfaces(objects, surfaces, vw, vh) {
  return objects.map((obj, idx) => {
    if (!obj.bbox) return _bareObject(obj, idx, vw, vh);

    const [bx, by, bw, bh] = obj.bbox;
    const cx = bx + bw / 2;  // object centroid x (screen px)
    const cy = by + bh / 2;  // object centroid y (screen px)

    // Find which surface this object's centroid falls into
    let bestSurface = null;
    let bestArea = Infinity;
    for (const surf of surfaces) {
      const [sx, sy, sw, sh] = surf.bbox_screen;
      if (cx >= sx && cx <= sx + sw && cy >= sy && cy <= sy + sh) {
        const area = sw * sh;
        if (area < bestArea) { bestSurface = surf; bestArea = area; }
      }
    }

    // Compute grid cell within the surface
    let gridCell = null;
    if (bestSurface) {
      const [sx, sy, sw, sh] = bestSurface.bbox_screen;
      const { cols, rows } = bestSurface.grid;
      const relX = Math.max(0, Math.min(1, (cx - sx) / sw));
      const relY = Math.max(0, Math.min(1, (cy - sy) / sh));
      gridCell = {
        col: Math.min(cols - 1, Math.floor(relX * cols)),
        row: Math.min(rows - 1, Math.floor(relY * rows)),
        rel_x: parseFloat(relX.toFixed(3)),
        rel_y: parseFloat(relY.toFixed(3))
      };
    }

    // GPS position if in outdoor mode
    const gpsPos = (_gpsMode && _lastGps)
      ? { lat: _lastGps.lat, lng: _lastGps.lng, accuracy_m: _lastGps.accuracy }
      : null;

    return {
      id: `obj_${idx}_${(obj.class || 'unknown').replace(/\s/g, '_')}`,
      class: obj.class,
      score: parseFloat((obj.score || 0).toFixed(3)),
      bbox_screen: [Math.round(bx), Math.round(by), Math.round(bw), Math.round(bh)],
      centroid_normalized: {
        x: parseFloat((cx / vw).toFixed(4)),
        y: parseFloat((cy / vh).toFixed(4))
      },
      surface_id: bestSurface?.id || null,
      grid_cell: gridCell,
      gps: gpsPos,
      last_seen: new Date().toISOString(),
      source: obj.source || 'coco-ssd'
    };
  });
}

function _bareObject(obj, idx, vw, vh) {
  return {
    id: `obj_${idx}_${(obj.class || 'unknown').replace(/\s/g, '_')}`,
    class: obj.class,
    score: parseFloat((obj.score || 0).toFixed(3)),
    bbox_screen: null,
    centroid_normalized: null,
    surface_id: null,
    grid_cell: null,
    gps: _gpsMode && _lastGps ? { lat: _lastGps.lat, lng: _lastGps.lng, accuracy_m: _lastGps.accuracy } : null,
    last_seen: new Date().toISOString(),
    source: obj.source || 'coco-ssd'
  };
}

// ── Stable Object Tracker & Spatial Anchors ────────────────────────────────────

function _updateStableTracker(objects, nowMs) {
  const seenClasses = new Set(objects.map(o => o.class).filter(Boolean));

  // Update last-seen for objects we can currently see
  objects.forEach(o => {
    if (!o.class) return;
    const existing = _stableObjects.get(o.class) || { count: 0, firstSeen: nowMs, lastSeen: nowMs, bbox: o.bbox };
    existing.count += 1;
    existing.lastSeen = nowMs;
    existing.bbox = o.bbox;
    _stableObjects.set(o.class, existing);
  });

  // Decay objects not seen recently (more than 30s → remove from tracker)
  for (const [cls, info] of _stableObjects.entries()) {
    if (nowMs - info.lastSeen > 30000) _stableObjects.delete(cls);
  }
}

function _buildAnchors(nowMs, vw, vh) {
  const anchors = [];
  for (const [cls, info] of _stableObjects.entries()) {
    const age = info.lastSeen - info.firstSeen;
    if (age >= _anchorAgeThresholdMs) {
      const bbox = info.bbox || [0, 0, 0, 0];
      const cx = bbox[0] + bbox[2] / 2;
      const cy = bbox[1] + bbox[3] / 2;
      anchors.push({
        id: `anchor_${cls.replace(/\s/g, '_')}`,
        class: cls,
        stable_since: new Date(info.firstSeen).toISOString(),
        age_ms: Math.round(age),
        position_screen: [Math.round(cx), Math.round(cy)],
        position_normalized: { x: parseFloat((cx / vw).toFixed(4)), y: parseFloat((cy / vh).toFixed(4)) },
        gps: _gpsMode && _lastGps ? { lat: _lastGps.lat, lng: _lastGps.lng } : null
      });
    }
  }
  // Sort by age descending (most stable anchors first)
  return anchors.sort((a, b) => b.age_ms - a.age_ms).slice(0, 10);
}

// ── GPS Mode ───────────────────────────────────────────────────────────────────

let _gpsWatchId = null;

function _startGpsWatch() {
  if (!navigator.geolocation || _gpsWatchId !== null) return;
  _gpsWatchId = navigator.geolocation.watchPosition(
    (pos) => {
      _lastGps = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        altitude: pos.coords.altitude,
        timestamp: pos.timestamp
      };
    },
    (err) => {
      console.warn('[SpatialEngine] GPS error:', err.message);
    },
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
  );
}

function _stopGpsWatch() {
  if (_gpsWatchId !== null && navigator.geolocation) {
    navigator.geolocation.clearWatch(_gpsWatchId);
    _gpsWatchId = null;
  }
}

// ── Exports ────────────────────────────────────────────────────────────────────
export {
  maybeUpdateSceneGraph,
  forceUpdateSceneGraph,
  getLatestSceneGraph,
  setGpsMode,
  setRoomId
};
