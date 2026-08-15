import { MIN_ZOOM, MAX_ZOOM } from "./config.js";
import { clamp } from "./state.js";
import { getCanvasCenter, screenToWorld, worldToLocal } from "./coordinates.js";
export function setZoom({ state, nextZoom, pivotX, pivotY, update, persist }) {
  const viewport = state.viewport;
  const oldZoom = viewport.zoom; const clampedZoom = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
  if (Math.abs(clampedZoom - oldZoom) < 0.000001) return;
  const worldPoint = { x: (pivotX - viewport.x) / oldZoom, y: (pivotY - viewport.y) / oldZoom };
  viewport.zoom = clampedZoom;
  viewport.x = pivotX - worldPoint.x * viewport.zoom;
  viewport.y = pivotY - worldPoint.y * viewport.zoom;
  update(); persist?.();
}
export function setZoomFromCenter({ state, canvas, nextZoom, update, persist }) { const center = getCanvasCenter(canvas); setZoom({ state, nextZoom, pivotX: center.x, pivotY: center.y, update, persist }); }
export function returnToOrigin({ state, canvas, update, persist }) {
  const center = getCanvasCenter(canvas);
  const origin = worldToLocal({ x: 0, y: 0 }, state);
  state.viewport.zoom = 1;
  state.viewport.x = center.x - origin.x;
  state.viewport.y = center.y - origin.y;
  update();
  persist?.();
}
export function preserveCenterOnResize({ state, canvas, oldSize, update, persist }) {
  const oldCenter = { x: oldSize.w / 2, y: oldSize.h / 2 };
  const centerWorld = screenToWorld(oldCenter.x, oldCenter.y, state);
  const newCenter = getCanvasCenter(canvas);
  state.viewport.x = newCenter.x - centerWorld.x * state.viewport.zoom;
  state.viewport.y = newCenter.y - centerWorld.y * state.viewport.zoom;
  update(); persist?.(); return { w: canvas.clientWidth, h: canvas.clientHeight };
}
