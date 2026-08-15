import { MAX_ZOOM, MIN_ZOOM } from "./config.js";
import { clamp } from "./state.js";

function getBounds(components) {
  if (!components.length) return null;
  const left = Math.min(...components.map((component) => component.x - component.width / 2));
  const right = Math.max(...components.map((component) => component.x + component.width / 2));
  const top = Math.min(...components.map((component) => component.y - component.height / 2));
  const bottom = Math.max(...components.map((component) => component.y + component.height / 2));
  return { left, right, top, bottom, width: right - left, height: bottom - top };
}

export function fitComponents({ components, state, canvas, update, persist, padding = 72 }) {
  const bounds = getBounds(components.filter((component) => component.visible));
  if (!bounds) return false;
  const availableWidth = Math.max(1, canvas.clientWidth - padding * 2);
  const availableHeight = Math.max(1, canvas.clientHeight - padding * 2);
  const zoom = clamp(
    Math.min(availableWidth / Math.max(1, bounds.width), availableHeight / Math.max(1, bounds.height)),
    MIN_ZOOM,
    MAX_ZOOM
  );
  const centerX = bounds.left + bounds.width / 2;
  const centerY = bounds.top + bounds.height / 2;
  state.viewport.zoom = zoom;
  state.viewport.x = canvas.clientWidth / 2 - centerX * zoom;
  state.viewport.y = canvas.clientHeight / 2 - centerY * zoom;
  update();
  persist?.();
  return true;
}

export function bindCanvasNavigation({
  fitContentButton,
  fitSelectionButton,
  state,
  canvas,
  update,
  persist,
  notify
}) {
  fitContentButton.addEventListener("click", () => {
    if (!fitComponents({ components: state.components, state, canvas, update, persist })) {
      notify?.("Nothing to fit");
    }
  });
  fitSelectionButton.addEventListener("click", () => {
    const components = state.components.filter((component) => state.selection.includes(component.id));
    if (!fitComponents({ components, state, canvas, update, persist })) {
      notify?.("Select one or more components first");
    }
  });
}
