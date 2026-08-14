import { setZoom } from "./viewport.js";
export function bindWheel({ canvas, state, update, persist }) {
  let saveTimer = null;
  canvas.addEventListener("wheel", event => {
    event.preventDefault();
    if (event.ctrlKey || event.metaKey) { const rect = canvas.getBoundingClientRect(); const pivotX = event.clientX - rect.left; const pivotY = event.clientY - rect.top; const factor = Math.exp(-event.deltaY * 0.002); setZoom({ state, nextZoom: state.zoom * factor, pivotX, pivotY, update, persist: null }); }
    else { state.x -= event.deltaX; state.y -= event.deltaY; update(); }
    clearTimeout(saveTimer); saveTimer = setTimeout(() => persist?.(), 120);
  }, { passive:false });
}
