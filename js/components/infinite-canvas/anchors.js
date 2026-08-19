import { MIN_ZOOM, MAX_ZOOM } from "../../core/config.js";
import { clamp } from "../../core/state.js";
import { getCanvasCenter, screenToWorld } from "../../core/coordinates.js";
export function setAnchor({ state, canvas, update, persist }) { const center = getCanvasCenter(canvas); const worldPos = screenToWorld(center.x, center.y, state); state.anchor = { worldX: worldPos.x, worldY: worldPos.y, zoom: state.zoom }; update(); persist?.(); }
export function goToAnchor({ state, canvas, update, persist }) { if (!state.anchor) return false; const center = getCanvasCenter(canvas); state.zoom = clamp(state.anchor.zoom || 1, MIN_ZOOM, MAX_ZOOM); state.x = center.x - state.anchor.worldX * state.zoom; state.y = center.y - state.anchor.worldY * state.zoom; update(); persist?.(); return true; }
export function clearAnchor({ state, update, persist }) { state.anchor = null; update(); persist?.(); }
