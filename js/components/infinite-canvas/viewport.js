import { MIN_ZOOM, MAX_ZOOM } from "../../core/config.js";
import { clamp } from "../../core/state.js";
import { getCanvasCenter, screenToWorld } from "../../core/coordinates.js";
export function setZoom({ state, nextZoom, pivotX, pivotY, update, persist }) {
  const oldZoom = state.zoom; const clampedZoom = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
  if (Math.abs(clampedZoom - oldZoom) < 0.000001) return;
  const worldPoint = { x: (pivotX - state.x) / oldZoom, y: (pivotY - state.y) / oldZoom };
  state.zoom = clampedZoom; state.x = pivotX - worldPoint.x * state.zoom; state.y = pivotY - worldPoint.y * state.zoom;
  update(); persist?.();
}
export function setZoomFromCenter({ state, canvas, nextZoom, update, persist }) { const center = getCanvasCenter(canvas); setZoom({ state, nextZoom, pivotX: center.x, pivotY: center.y, update, persist }); }
export function returnToOrigin({ state, canvas, update, persist }) { const center = getCanvasCenter(canvas); state.zoom = 1; state.x = center.x; state.y = center.y; update(); persist?.(); }
export function preserveCenterOnResize({ state, canvas, oldSize, update, persist }) {
  const oldCenter = { x: oldSize.w / 2, y: oldSize.h / 2 };
  const centerWorld = screenToWorld(oldCenter.x, oldCenter.y, state);
  const newCenter = getCanvasCenter(canvas);
  state.x = newCenter.x - centerWorld.x * state.zoom; state.y = newCenter.y - centerWorld.y * state.zoom;
  update(); persist?.(); return { w: canvas.clientWidth, h: canvas.clientHeight };
}
