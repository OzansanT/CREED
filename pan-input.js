export function bindPan({ canvas, state, update, persist }) {
  let activePointerId = null;
  const dragStart = { x: 0, y: 0 };
  const panStart = { x: 0, y: 0 };

  canvas.addEventListener("pointerdown", (event) => {
    if (
      event.button !== 0 ||
      activePointerId !== null ||
      event.shiftKey ||
      event.target.closest?.("[data-component-id], .selection-handle")
    ) return;
    activePointerId = event.pointerId;
    canvas.classList.add("dragging");
    canvas.setPointerCapture?.(event.pointerId);
    dragStart.x = event.clientX;
    dragStart.y = event.clientY;
    panStart.x = state.viewport.x;
    panStart.y = state.viewport.y;
  });

  canvas.addEventListener("pointermove", (event) => {
    if (event.pointerId !== activePointerId) return;
    state.viewport.x = panStart.x + (event.clientX - dragStart.x);
    state.viewport.y = panStart.y + (event.clientY - dragStart.y);
    update();
  });

  function stopDragging(event) {
    if (activePointerId === null || (event?.pointerId != null && event.pointerId !== activePointerId)) return;
    const pointerId = activePointerId;
    activePointerId = null;
    canvas.classList.remove("dragging");
    if (canvas.hasPointerCapture?.(pointerId)) canvas.releasePointerCapture(pointerId);
    persist?.();
  }

  canvas.addEventListener("pointerup", stopDragging);
  canvas.addEventListener("pointercancel", stopDragging);
  canvas.addEventListener("lostpointercapture", stopDragging);
}
