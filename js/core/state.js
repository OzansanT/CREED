export const state = {
  x: 0,
  y: 0,
  zoom: 1,
  anchor: null,
  sidebarView: "canvas",
  originCard: { worldX: 0, worldY: 0 },
  jsonCard: { visible: false, worldX: 0, worldY: 0 }
};
export function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
