export function bindPan({ canvas, state, update, persist }) {
  let dragging = false; const dragStart = {x:0,y:0}; const panStart = {x:0,y:0};
  canvas.addEventListener("pointerdown", event => { if (event.button !== 0) return; dragging = true; canvas.classList.add("is-dragging"); canvas.setPointerCapture(event.pointerId); dragStart.x = event.clientX; dragStart.y = event.clientY; panStart.x = state.x; panStart.y = state.y; });
  canvas.addEventListener("pointermove", event => { if (!dragging) return; state.x = panStart.x + (event.clientX - dragStart.x); state.y = panStart.y + (event.clientY - dragStart.y); update(); });
  function stopDragging(event) { if (!dragging) return; dragging = false; canvas.classList.remove("is-dragging"); if (event && canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId); persist?.(); }
  canvas.addEventListener("pointerup", stopDragging); canvas.addEventListener("pointercancel", stopDragging);
}
