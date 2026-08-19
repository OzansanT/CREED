export function createMinimapController({ minimap, scroller }) {
  let activePointerId = null;
  let viewportFrame = 0;

  function renderViewport() {
    const viewport = minimap.querySelector(".source-editor__minimap-viewport");
    const maximum = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
    const viewportRatio = scroller.scrollHeight > 0
      ? Math.min(1, scroller.clientHeight / scroller.scrollHeight)
      : 1;
    const viewportHeight = Math.max(18, minimap.clientHeight * viewportRatio);
    const availableTravel = Math.max(0, minimap.clientHeight - viewportHeight);
    const scrollRatio = maximum > 0 ? scroller.scrollTop / maximum : 0;

    if (viewport) {
      viewport.style.height = viewportHeight + "px";
      viewport.style.transform = "translateY(" + (availableTravel * scrollRatio) + "px)";
    }
    minimap.setAttribute("aria-valuenow", String(Math.round(scrollRatio * 100)));
  }

  function scheduleViewportUpdate() {
    if (viewportFrame) return;
    viewportFrame = requestAnimationFrame(() => {
      viewportFrame = 0;
      renderViewport();
    });
  }

  function updateViewport() {
    if (viewportFrame) cancelAnimationFrame(viewportFrame);
    viewportFrame = 0;
    renderViewport();
  }

  function scrollFromPointer(event) {
    const bounds = minimap.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height));
    const maximum = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
    scroller.scrollTop = ratio * maximum;
  }

  function finishPointer(event) {
    if (event.pointerId !== activePointerId) return;
    const pointerId = activePointerId;
    activePointerId = null;
    if (minimap.hasPointerCapture?.(pointerId)) minimap.releasePointerCapture(pointerId);
  }

  minimap.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || activePointerId !== null) return;
    event.preventDefault();
    activePointerId = event.pointerId;
    minimap.setPointerCapture?.(event.pointerId);
    scrollFromPointer(event);
  });
  minimap.addEventListener("pointermove", (event) => {
    if (event.pointerId === activePointerId) scrollFromPointer(event);
  });
  minimap.addEventListener("pointerup", finishPointer);
  minimap.addEventListener("pointercancel", finishPointer);
  minimap.addEventListener("lostpointercapture", finishPointer);

  minimap.addEventListener("keydown", (event) => {
    const maximum = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
    const step = Math.max(40, scroller.clientHeight * 0.1);
    const next = {
      ArrowUp: scroller.scrollTop - step,
      ArrowDown: scroller.scrollTop + step,
      PageUp: scroller.scrollTop - scroller.clientHeight,
      PageDown: scroller.scrollTop + scroller.clientHeight,
      Home: 0,
      End: maximum
    }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    scroller.scrollTop = next;
  });

  scroller.addEventListener("scroll", scheduleViewportUpdate, { passive: true });
  const resizeObserver = typeof ResizeObserver === "function"
    ? new ResizeObserver(scheduleViewportUpdate)
    : null;
  resizeObserver?.observe(scroller);
  resizeObserver?.observe(minimap);
  if (!resizeObserver) window.addEventListener("resize", scheduleViewportUpdate, { passive: true });

  return Object.freeze({ updateViewport });
}
