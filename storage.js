import { STORAGE_KEY, PANEL_LAYOUT_STORAGE_KEY, MIN_ZOOM, MAX_ZOOM } from "./config.js";
import { state, clamp } from "./state.js";
export function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
export function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved) return false;
    state.x = Number.isFinite(saved.x) ? saved.x : 0;
    state.y = Number.isFinite(saved.y) ? saved.y : 0;
    state.zoom = Number.isFinite(saved.zoom) ? clamp(saved.zoom, MIN_ZOOM, MAX_ZOOM) : 1;
    if (saved.anchor && Number.isFinite(saved.anchor.worldX) && Number.isFinite(saved.anchor.worldY)) state.anchor = saved.anchor; else state.anchor = null;
    state.sidebarView = ["canvas", "infiniteCanvas", "components"].includes(saved.sidebarView) ? saved.sidebarView : "canvas";
    if (saved.originCard && Number.isFinite(saved.originCard.worldX) && Number.isFinite(saved.originCard.worldY)) state.originCard = saved.originCard; else state.originCard = { worldX: 0, worldY: 0 };
    if (saved.jsonCard && Number.isFinite(saved.jsonCard.worldX) && Number.isFinite(saved.jsonCard.worldY)) state.jsonCard = { visible: saved.jsonCard.visible === true, worldX: saved.jsonCard.worldX, worldY: saved.jsonCard.worldY }; else state.jsonCard = { visible: false, worldX: 0, worldY: 0 };
    return true;
  } catch { return false; }
}
export function clearStoredState() { localStorage.removeItem(STORAGE_KEY); }

export function savePanelLayout({ primaryWidth, secondaryWidth, terminalHeight }) {
  const layout = {
    primaryWidth: Math.round(primaryWidth),
    secondaryWidth: Math.round(secondaryWidth),
    terminalHeight: Math.round(terminalHeight)
  };
  if (!Object.values(layout).every((value) => Number.isFinite(value) && value > 0)) {
    return false;
  }
  localStorage.setItem(PANEL_LAYOUT_STORAGE_KEY, JSON.stringify(layout));
  return true;
}

export function loadPanelLayout() {
  try {
    const saved = JSON.parse(localStorage.getItem(PANEL_LAYOUT_STORAGE_KEY));
    if (!saved) return null;
    const layout = {
      primaryWidth: Number(saved.primaryWidth),
      secondaryWidth: Number(saved.secondaryWidth),
      terminalHeight: Number(saved.terminalHeight)
    };
    return Object.values(layout).every((value) => Number.isFinite(value) && value > 0)
      ? layout
      : null;
  } catch {
    return null;
  }
}

export function clearPanelLayout() {
  localStorage.removeItem(PANEL_LAYOUT_STORAGE_KEY);
}
