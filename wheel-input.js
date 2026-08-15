import { setZoom } from "./viewport.js";
export function bindWheel({ canvas, state, update, persist }) {
  canvas.addEventListener("wheel", event => {
    event.preventDefault();
    const unit = event.deltaMode === WheelEvent.DOM_DELTA_LINE
      ? 16
      : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
        ? canvas.clientHeight
        : 1;
    if (event.ctrlKey || event.metaKey) {
      const rect = canvas.getBoundingClientRect();
      const pivotX = event.clientX - rect.left;
      const pivotY = event.clientY - rect.top;
      const factor = Math.exp(-event.deltaY * unit * 0.002);
      setZoom({
        state,
        nextZoom: state.viewport.zoom * factor,
        pivotX,
        pivotY,
        update,
        persist: null
      });
    } else {
      state.viewport.x -= event.deltaX * unit;
      state.viewport.y -= event.deltaY * unit;
      update();
    }
    persist?.();
  }, { passive:false });
}
