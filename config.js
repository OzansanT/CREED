export const MIN_ZOOM = 0.20;
export const MAX_ZOOM = 3.00;
export const BASE_GRID = 24;
export const GRID_BREAKPOINTS = Object.freeze({ ORDER_1_MIN: 0.75, ORDER_2_MIN: 0.45, ORDER_4_MIN: 0.28 });
export const GRID_ORDERS = Object.freeze([1, 2, 4, 8]);
export const STORAGE_KEY = "creedWorkspaceDocument.v2";
export const LEGACY_STATE_STORAGE_KEYS = Object.freeze([
  "creedWorkspaceDocument.v1",
  "infiniteCanvasLODState.v3"
]);
export const PANEL_LAYOUT_STORAGE_KEY = "creedPanelLayout.v2";
export const LEGACY_PANEL_LAYOUT_STORAGE_KEY = "creedPanelLayout.v1";
export const STATE_SAVE_DELAY = 120;
export const DEFAULT_PRIMARY_WIDTH = 293;
export const DEFAULT_SECONDARY_WIDTH = 290;
export const DEFAULT_TERMINAL_HEIGHT = 320;
