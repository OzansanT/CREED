import {
  STORAGE_KEY,
  PANEL_LAYOUT_STORAGE_KEY,
  LEGACY_PANEL_LAYOUT_STORAGE_KEY,
  MIN_ZOOM,
  MAX_ZOOM
} from "./config.js";
import { state, clamp } from "./state.js";
import { getViewportWorldCenter } from "./coordinates.js";

function normalizeWorldPoint(value) {
  if (!value || !Number.isFinite(value.worldX) || !Number.isFinite(value.worldY)) return null;
  return { worldX: value.worldX, worldY: value.worldY };
}

function normalizeAnchor(value) {
  const point = normalizeWorldPoint(value);
  if (!point) return null;
  return {
    ...point,
    zoom: Number.isFinite(value.zoom) ? clamp(value.zoom, MIN_ZOOM, MAX_ZOOM) : 1
  };
}

export function saveState(canvas) {
  try {
    const camera = canvas
      ? (() => {
          const center = getViewportWorldCenter(canvas, state);
          return { worldX: center.x, worldY: center.y };
        })()
      : null;

    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      ...state,
      camera
    }));
    return true;
  } catch {
    return false;
  }
}

export function loadState(canvas) {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved || typeof saved !== "object") return false;

    state.zoom = Number.isFinite(saved.zoom) ? clamp(saved.zoom, MIN_ZOOM, MAX_ZOOM) : 1;

    const camera = normalizeWorldPoint(saved.camera);
    if (camera && canvas && canvas.clientWidth > 0 && canvas.clientHeight > 0) {
      state.x = canvas.clientWidth / 2 - camera.worldX * state.zoom;
      state.y = canvas.clientHeight / 2 - camera.worldY * state.zoom;
    } else {
      state.x = Number.isFinite(saved.x) ? saved.x : 0;
      state.y = Number.isFinite(saved.y) ? saved.y : 0;
    }

    state.anchor = normalizeAnchor(saved.anchor);
    state.sidebarView = ["canvas", "infiniteCanvas", "components"].includes(saved.sidebarView)
      ? saved.sidebarView
      : "canvas";

    const originCard = normalizeWorldPoint(saved.originCard);
    state.originCard = originCard || { worldX: 0, worldY: 0 };

    const jsonCard = normalizeWorldPoint(saved.jsonCard);
    state.jsonCard = jsonCard
      ? {
          visible: saved.jsonCard.visible === true,
          worldX: jsonCard.worldX,
          worldY: jsonCard.worldY
        }
      : { visible: false, worldX: 0, worldY: 0 };

    return true;
  } catch {
    return false;
  }
}

export function clearStoredState() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

function normalizePanelDimensions(saved) {
  if (!saved) return null;
  const layout = {
    primaryWidth: Math.round(Number(saved.primaryWidth)),
    secondaryWidth: Math.round(Number(saved.secondaryWidth)),
    bottomPanelHeight: Math.round(Number(saved.bottomPanelHeight ?? saved.terminalHeight))
  };
  return Object.values(layout).every((value) => Number.isFinite(value) && value > 0)
    ? layout
    : null;
}

function readStoredJson(key) {
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch {
    return null;
  }
}

export function savePanelLayout(layoutState) {
  const dimensions = normalizePanelDimensions(layoutState);
  const visibility = {
    primaryVisible: layoutState?.primaryVisible,
    secondaryVisible: layoutState?.secondaryVisible,
    bottomPanelVisible: layoutState?.bottomPanelVisible
  };
  if (!dimensions || !Object.values(visibility).every((value) => typeof value === "boolean")) {
    return false;
  }
  try {
    localStorage.setItem(PANEL_LAYOUT_STORAGE_KEY, JSON.stringify({
      ...dimensions,
      ...visibility
    }));
    localStorage.removeItem(LEGACY_PANEL_LAYOUT_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

export function loadPanelLayout() {
  const saved = readStoredJson(PANEL_LAYOUT_STORAGE_KEY);
  const dimensions = normalizePanelDimensions(saved);
  const visibility = {
    primaryVisible: saved?.primaryVisible,
    secondaryVisible: saved?.secondaryVisible,
    bottomPanelVisible: saved?.bottomPanelVisible ?? saved?.terminalVisible
  };
  if (dimensions && Object.values(visibility).every((value) => typeof value === "boolean")) {
    return { ...dimensions, ...visibility };
  }

  const legacyDimensions = normalizePanelDimensions(
    readStoredJson(LEGACY_PANEL_LAYOUT_STORAGE_KEY)
  );
  if (!legacyDimensions) return null;
  const migrated = {
    ...legacyDimensions,
    primaryVisible: true,
    secondaryVisible: true,
    bottomPanelVisible: true
  };
  savePanelLayout(migrated);
  return migrated;
}

export function clearPanelLayout() {
  try {
    localStorage.removeItem(PANEL_LAYOUT_STORAGE_KEY);
    localStorage.removeItem(LEGACY_PANEL_LAYOUT_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}
