import { BASE_GRID } from "../../core/config.js";

function snapAxis(value, candidates, threshold, gridSize) {
  const gridValue = Math.round(value / gridSize) * gridSize;
  let nextValue = Math.abs(gridValue - value) <= threshold ? gridValue : value;
  let closestDistance = threshold + 1;

  for (const candidate of candidates) {
    const distance = Math.abs(candidate - value);
    if (distance < closestDistance) {
      closestDistance = distance;
      nextValue = candidate;
    }
  }

  return closestDistance <= threshold ? nextValue :
    Math.abs(gridValue - value) <= threshold ? gridValue : value;
}

export function snapWorldPoint({
  x,
  y,
  zoom = 1,
  gridSize = BASE_GRID,
  candidates = []
}) {
  const threshold = 7 / Math.max(0.01, zoom);
  const xCandidates = candidates
    .map((candidate) => Number(candidate?.worldX))
    .filter(Number.isFinite);
  const yCandidates = candidates
    .map((candidate) => Number(candidate?.worldY))
    .filter(Number.isFinite);

  return {
    worldX: snapAxis(x, xCandidates, threshold, gridSize),
    worldY: snapAxis(y, yCandidates, threshold, gridSize)
  };
}
