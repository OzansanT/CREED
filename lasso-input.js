import { screenToWorld } from "./coordinates.js";

function rectangle(start, current) {
  return {
    left: Math.min(start.x, current.x),
    top: Math.min(start.y, current.y),
    right: Math.max(start.x, current.x),
    bottom: Math.max(start.y, current.y)
  };
}

function intersects(a, b) {
  return a.left <= b.right && a.right >= b.left && a.top <= b.bottom && a.bottom >= b.top;
}

export function bindLassoInput({ canvas, overlay, state, update, persist }) {
  let pointerId = null;
  const startScreen = { x: 0, y: 0 };
  const currentScreen = { x: 0, y: 0 };
  let additiveSelection = [];

  function localPoint(event) {
    const bounds = canvas.getBoundingClientRect();
    return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
  }

  canvas.addEventListener("pointerdown", (event) => {
    if (
      event.button !== 0 ||
      !event.shiftKey ||
      event.target.closest?.("[data-component-id], .selection-handle")
    ) return;
    event.preventDefault();
    pointerId = event.pointerId;
    Object.assign(startScreen, localPoint(event));
    Object.assign(currentScreen, startScreen);
    additiveSelection = event.ctrlKey || event.metaKey ? [...state.selection] : [];
    overlay.hidden = false;
    overlay.style.left = startScreen.x + "px";
    overlay.style.top = startScreen.y + "px";
    overlay.style.width = "0px";
    overlay.style.height = "0px";
    canvas.setPointerCapture?.(pointerId);
  });

  canvas.addEventListener("pointermove", (event) => {
    if (event.pointerId !== pointerId) return;
    Object.assign(currentScreen, localPoint(event));
    const screenRect = rectangle(startScreen, currentScreen);
    overlay.style.left = screenRect.left + "px";
    overlay.style.top = screenRect.top + "px";
    overlay.style.width = screenRect.right - screenRect.left + "px";
    overlay.style.height = screenRect.bottom - screenRect.top + "px";
  });

  function finish(event) {
    if (pointerId === null || (event?.pointerId != null && event.pointerId !== pointerId)) return;
    const activeId = pointerId;
    pointerId = null;
    if (canvas.hasPointerCapture?.(activeId)) canvas.releasePointerCapture(activeId);
    overlay.hidden = true;
    const startWorld = screenToWorld(startScreen.x, startScreen.y, state);
    const endWorld = screenToWorld(currentScreen.x, currentScreen.y, state);
    const worldRect = rectangle(startWorld, endWorld);
    const selected = state.components
      .filter((component) => component.visible && intersects(worldRect, {
        left: component.x - component.width / 2,
        right: component.x + component.width / 2,
        top: component.y - component.height / 2,
        bottom: component.y + component.height / 2
      }))
      .map((component) => component.id);
    state.selection = [...new Set([...additiveSelection, ...selected])];
    update();
    persist?.();
  }

  canvas.addEventListener("pointerup", finish);
  canvas.addEventListener("pointercancel", finish);
  canvas.addEventListener("lostpointercapture", finish);
}
