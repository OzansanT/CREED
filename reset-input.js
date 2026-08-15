import { clearStoredState } from "./storage.js";
import { returnToOrigin } from "./viewport.js";
import { createDefaultComponents } from "./component-registry.js";

function resetCanvasModel(state) {
  state.savedViews = [];
  state.activeSavedViewId = null;
  state.worldOrigin = { x: 0, y: 0 };
  state.components = createDefaultComponents();
  state.connections = [];
  state.selection = [];
}

export function bindResetControls({
  canvasButton,
  infiniteButton,
  state,
  canvas,
  update,
  persist,
  notify,
  onInfiniteReset,
  commandEngine,
  beforeCanvasReset,
  beforeInfiniteReset,
  confirmAction = (message) => window.confirm(message)
}) {
  async function resetCanvas() {
    const confirmed = confirmAction(
      "Canvas Reset will restore pan, zoom, component positions and remove the saved canvas location. Continue?"
    );
    if (!confirmed) return false;

    await beforeCanvasReset?.();
    resetCanvasModel(state);
    commandEngine?.clear();
    returnToOrigin({ state, canvas, update, persist });
    notify?.("Canvas reset");
    return true;
  }

  async function resetInfinite() {
    const confirmed = confirmAction(
      "Infinite Reset will restore the canvas, sidebar menu, panel visibility and panel sizes. Continue?"
    );
    if (!confirmed) return false;

    await beforeInfiniteReset?.();
    clearStoredState();
    resetCanvasModel(state);
    state.ui.sidebarView = "canvas";
    commandEngine?.clear();
    await onInfiniteReset?.();
    returnToOrigin({ state, canvas, update, persist });
    notify?.("Infinite canvas reset");
    return true;
  }

  canvasButton.addEventListener("click", resetCanvas);
  infiniteButton.addEventListener("click", resetInfinite);

  return Object.freeze({ resetCanvas, resetInfinite });
}
