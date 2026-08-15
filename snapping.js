import { BASE_GRID } from "./config.js";

function closest(value, candidates, threshold) {
  let winner = null;
  let distance = threshold + 1;
  candidates.forEach((candidate) => {
    const nextDistance = Math.abs(candidate - value);
    if (nextDistance < distance) {
      winner = candidate;
      distance = nextDistance;
    }
  });
  return distance <= threshold ? winner : null;
}

export function snapComponentPosition({
  x,
  y,
  width,
  height,
  components,
  excludeIds = [],
  zoom = 1,
  gridSize = BASE_GRID
}) {
  const threshold = 7 / Math.max(.01, zoom);
  const excluded = new Set(excludeIds);
  const others = components.filter((component) => component.visible && !excluded.has(component.id));
  const xCandidates = [];
  const yCandidates = [];
  others.forEach((component) => {
    xCandidates.push(component.x, component.x - component.width / 2, component.x + component.width / 2);
    yCandidates.push(component.y, component.y - component.height / 2, component.y + component.height / 2);
  });

  const gridX = Math.round(x / gridSize) * gridSize;
  const gridY = Math.round(y / gridSize) * gridSize;
  let nextX = Math.abs(gridX - x) <= threshold ? gridX : x;
  let nextY = Math.abs(gridY - y) <= threshold ? gridY : y;
  const alignedX = closest(nextX, xCandidates, threshold);
  const alignedY = closest(nextY, yCandidates, threshold);
  if (alignedX != null) nextX = alignedX;
  if (alignedY != null) nextY = alignedY;

  return {
    x: nextX,
    y: nextY,
    guides: {
      x: alignedX,
      y: alignedY
    },
    bounds: {
      left: nextX - width / 2,
      top: nextY - height / 2,
      right: nextX + width / 2,
      bottom: nextY + height / 2
    }
  };
}

export function updateAlignmentGuides({ vertical, horizontal, guides, state }) {
  if (guides?.x != null) {
    vertical.hidden = false;
    vertical.style.left = guides.x * state.viewport.zoom + state.viewport.x + "px";
  } else {
    vertical.hidden = true;
  }
  if (guides?.y != null) {
    horizontal.hidden = false;
    horizontal.style.top = guides.y * state.viewport.zoom + state.viewport.y + "px";
  } else {
    horizontal.hidden = true;
  }
}
