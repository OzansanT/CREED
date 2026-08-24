import { MAX_ZOOM, MIN_ZOOM } from "../../core/config.js";
import { clamp } from "../../core/state.js";

export function calculateFitView({ items, viewportWidth, viewportHeight, padding = 72 }) {
  if (!Array.isArray(items) || !items.length) return null;

  const left = Math.min(...items.map((item) => item.worldX - item.width / 2));
  const right = Math.max(...items.map((item) => item.worldX + item.width / 2));
  const top = Math.min(...items.map((item) => item.worldY - item.height / 2));
  const bottom = Math.max(...items.map((item) => item.worldY + item.height / 2));
  const width = Math.max(1, right - left);
  const height = Math.max(1, bottom - top);
  const availableWidth = Math.max(1, viewportWidth - padding * 2);
  const availableHeight = Math.max(1, viewportHeight - padding * 2);
  const zoom = clamp(Math.min(availableWidth / width, availableHeight / height), MIN_ZOOM, MAX_ZOOM);
  const centerX = left + (right - left) / 2;
  const centerY = top + (bottom - top) / 2;

  return {
    zoom,
    x: viewportWidth / 2 - centerX * zoom,
    y: viewportHeight / 2 - centerY * zoom
  };
}

function measureWorldItem(element, position, zoom) {
  const bounds = element.getBoundingClientRect();
  const scale = Math.max(0.01, zoom);
  return {
    worldX: position.worldX,
    worldY: position.worldY,
    width: bounds.width / scale,
    height: bounds.height / scale
  };
}

export function fitCurrentCanvasContent({ state, canvas, originCard, jsonCard, componentItems = [], update, persist }) {
  const items = [measureWorldItem(originCard, state.originCard, state.zoom)];
  if (state.jsonCard.visible && jsonCard && !jsonCard.hidden) {
    items.push(measureWorldItem(jsonCard, state.jsonCard, state.zoom));
  }
  for (const item of componentItems || []) {
    if (![item?.worldX, item?.worldY, item?.width, item?.height].every(Number.isFinite)) continue;
    items.push({ worldX: item.worldX, worldY: item.worldY, width: item.width, height: item.height });
  }

  const view = calculateFitView({
    items,
    viewportWidth: canvas.clientWidth,
    viewportHeight: canvas.clientHeight
  });
  if (!view) return false;

  state.zoom = view.zoom;
  state.x = view.x;
  state.y = view.y;
  update();
  persist?.();
  return true;
}
