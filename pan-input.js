const INTERACTIVE_SELECTOR = [
  "button",
  "a[href]",
  "input",
  "textarea",
  "select",
  "label",
  "[contenteditable]:not([contenteditable='false'])",
  "[role='slider']",
  "[role='scrollbar']"
].join(",");

function isInteractiveTarget(target) {
  return target instanceof Element && Boolean(target.closest(INTERACTIVE_SELECTOR));
}

export function bindPan({ canvas, state, update, persist }) {
  let activePointerId = null;
  const dragStart = { x: 0, y: 0 };
  const panStart = { x: 0, y: 0 };

  canvas.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || activePointerId !== null || isInteractiveTarget(event.target)) return;

    event.preventDefault();
    activePointerId = event.pointerId;
    dragStart.x = event.clientX;
    dragStart.y = event.clientY;
    panStart.x = state.x;
    panStart.y = state.y;
    canvas.classList.add("is-dragging");
    canvas.setPointerCapture?.(activePointerId);
  });

  canvas.addEventListener("pointermove", (event) => {
    if (event.pointerId !== activePointerId) return;
    state.x = panStart.x + (event.clientX - dragStart.x);
    state.y = panStart.y + (event.clientY - dragStart.y);
    update();
  });

  function stopDragging(event) {
    if (activePointerId === null || event.pointerId !== activePointerId) return;

    const pointerId = activePointerId;
    activePointerId = null;
    canvas.classList.remove("is-dragging");

    if (canvas.hasPointerCapture?.(pointerId)) {
      canvas.releasePointerCapture(pointerId);
    }

    persist?.();
  }

  canvas.addEventListener("pointerup", stopDragging);
  canvas.addEventListener("pointercancel", stopDragging);
  canvas.addEventListener("lostpointercapture", stopDragging);
}
