import { BASE_GRID } from "./config.js";

export const WORLD_REBASE_THRESHOLD = 250000;

function rebaseAmount(screenOffset, zoom) {
  const worldOffset = screenOffset / Math.max(.0001, zoom);
  return Math.trunc(worldOffset / BASE_GRID) * BASE_GRID;
}

export function rebaseWorldIfNeeded(state, threshold = WORLD_REBASE_THRESHOLD) {
  const viewport = state.viewport;
  if (Math.abs(viewport.x) < threshold && Math.abs(viewport.y) < threshold) return false;
  const shiftX = Math.abs(viewport.x) >= threshold ? rebaseAmount(viewport.x, viewport.zoom) : 0;
  const shiftY = Math.abs(viewport.y) >= threshold ? rebaseAmount(viewport.y, viewport.zoom) : 0;
  if (!shiftX && !shiftY) return false;
  state.components.forEach((component) => {
    component.x += shiftX;
    component.y += shiftY;
  });
  state.worldOrigin.x -= shiftX;
  state.worldOrigin.y -= shiftY;
  viewport.x -= shiftX * viewport.zoom;
  viewport.y -= shiftY * viewport.zoom;
  return true;
}
