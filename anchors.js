import { MIN_ZOOM, MAX_ZOOM } from "./config.js";
import { clamp } from "./state.js";
import {
  getCanvasCenter,
  getViewportWorldCenter,
  worldToLocal
} from "./coordinates.js";

export function getActiveSavedView(state) {
  return state.savedViews.find((view) => view.id === state.activeSavedViewId) || null;
}

export function setAnchor({ state, canvas, update, persist, name }) {
  const worldPos = getViewportWorldCenter(canvas, state);
  const active = getActiveSavedView(state);
  const id = active?.id || "saved-default";
  const view = {
    id,
    name: name || active?.name || "Saved canvas view",
    worldX: worldPos.x,
    worldY: worldPos.y,
    zoom: state.viewport.zoom
  };
  const index = state.savedViews.findIndex((candidate) => candidate.id === id);
  if (index >= 0) state.savedViews.splice(index, 1, view);
  else state.savedViews.push(view);
  state.activeSavedViewId = id;
  update();
  persist?.();
  return view;
}

export function goToAnchor({ state, canvas, update, persist, viewId = state.activeSavedViewId }) {
  const view = state.savedViews.find((candidate) => candidate.id === viewId);
  if (!view) return false;
  const center = getCanvasCenter(canvas);
  const local = worldToLocal({ x: view.worldX, y: view.worldY }, state);
  state.activeSavedViewId = view.id;
  state.viewport.zoom = clamp(view.zoom || 1, MIN_ZOOM, MAX_ZOOM);
  state.viewport.x = center.x - local.x * state.viewport.zoom;
  state.viewport.y = center.y - local.y * state.viewport.zoom;
  update();
  persist?.();
  return true;
}

export function clearAnchor({ state, update, persist, viewId = state.activeSavedViewId }) {
  state.savedViews = state.savedViews.filter((view) => view.id !== viewId);
  state.activeSavedViewId = state.savedViews[0]?.id || null;
  update();
  persist?.();
}
