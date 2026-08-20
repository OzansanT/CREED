import { clearStoredState } from "../../core/storage.js";
import { returnToOrigin } from "./viewport.js";

function resetCanvasModel(state) {
  state.anchor = null;
  state.originCard = { worldX: 0, worldY: 0 };
  state.jsonCard = { visible: false, worldX: 0, worldY: 0 };
}

export function bindResetControls({
  canvasButton,
  infiniteButton,
  state,
  canvas,
  update,
  persist,
  notify,
  onCanvasReset,
  onInfiniteReset,
  confirmAction = (message) => window.confirm(message)
}) {
  function resetCanvas() {
    const confirmed = confirmAction(
      "Canvas Reset will restore pan, zoom, component positions and remove the saved canvas location. Continue?"
    );
    if (!confirmed) return false;

    resetCanvasModel(state);
    onCanvasReset?.();
    returnToOrigin({ state, canvas, update, persist });
    notify?.("Canvas reset");
    return true;
  }

  function resetInfinite() {
    const confirmed = confirmAction(
      "Infinite Reset will restore the canvas, sidebar menu, panel visibility, panel sizes and editor tabs/sessions. Continue?"
    );
    if (!confirmed) return false;

    clearStoredState();
    resetCanvasModel(state);
    state.sidebarView = "canvas";
    onInfiniteReset?.();
    returnToOrigin({ state, canvas, update, persist });
    notify?.("Infinite workspace reset");
    return true;
  }

  canvasButton.addEventListener("click", resetCanvas);
  infiniteButton.addEventListener("click", resetInfinite);

  return Object.freeze({ resetCanvas, resetInfinite });
}
