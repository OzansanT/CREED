import { getCanvasCenter, screenToWorld } from "./coordinates.js";
import { clamp } from "./state.js";
import { isEffectivelyVisible } from "./component-tree.js";

function worldBounds(state, canvas) {
  const visible = state.components.filter((component) =>
    isEffectivelyVisible(state.components, component)
  );
  const topLeft = screenToWorld(0, 0, state);
  const bottomRight = screenToWorld(canvas.clientWidth, canvas.clientHeight, state);
  const left = Math.min(topLeft.x, ...visible.map((component) => component.x - component.width / 2));
  const top = Math.min(topLeft.y, ...visible.map((component) => component.y - component.height / 2));
  const right = Math.max(bottomRight.x, ...visible.map((component) => component.x + component.width / 2));
  const bottom = Math.max(bottomRight.y, ...visible.map((component) => component.y + component.height / 2));
  const padding = Math.max(80, Math.max(right - left, bottom - top) * .08);
  return {
    left: left - padding,
    top: top - padding,
    right: right + padding,
    bottom: bottom + padding
  };
}

export function bindCanvasMinimap({
  minimap,
  content,
  viewport,
  canvas,
  state,
  update,
  persist
}) {
  let mapping = null;

  function sync() {
    if (!minimap.clientWidth || !minimap.clientHeight || !canvas.clientWidth || !canvas.clientHeight) {
      return;
    }
    const bounds = worldBounds(state, canvas);
    const width = Math.max(1, bounds.right - bounds.left);
    const height = Math.max(1, bounds.bottom - bounds.top);
    const scale = Math.min(minimap.clientWidth / width, minimap.clientHeight / height);
    const offsetX = (minimap.clientWidth - width * scale) / 2;
    const offsetY = (minimap.clientHeight - height * scale) / 2;
    mapping = { bounds, scale, offsetX, offsetY };
    const fragment = document.createDocumentFragment();
    state.components.filter((component) =>
      isEffectivelyVisible(state.components, component)
    ).forEach((component) => {
      const item = document.createElement("div");
      item.className = "canvas-minimap__item";
      item.classList.toggle("is-selected", state.selection.includes(component.id));
      item.style.left = offsetX + (component.x - component.width / 2 - bounds.left) * scale + "px";
      item.style.top = offsetY + (component.y - component.height / 2 - bounds.top) * scale + "px";
      item.style.width = Math.max(2, component.width * scale) + "px";
      item.style.height = Math.max(2, component.height * scale) + "px";
      fragment.append(item);
    });
    content.replaceChildren(fragment);
    const topLeft = screenToWorld(0, 0, state);
    const bottomRight = screenToWorld(canvas.clientWidth, canvas.clientHeight, state);
    viewport.style.left = offsetX + (topLeft.x - bounds.left) * scale + "px";
    viewport.style.top = offsetY + (topLeft.y - bounds.top) * scale + "px";
    viewport.style.width = Math.max(4, (bottomRight.x - topLeft.x) * scale) + "px";
    viewport.style.height = Math.max(4, (bottomRight.y - topLeft.y) * scale) + "px";
  }

  function navigate(event) {
    if (!mapping) return;
    const rect = minimap.getBoundingClientRect();
    const worldWidth = (mapping.bounds.right - mapping.bounds.left) * mapping.scale;
    const worldHeight = (mapping.bounds.bottom - mapping.bounds.top) * mapping.scale;
    const localX = clamp(event.clientX - rect.left - mapping.offsetX, 0, worldWidth);
    const localY = clamp(event.clientY - rect.top - mapping.offsetY, 0, worldHeight);
    const worldX = mapping.bounds.left + localX / mapping.scale;
    const worldY = mapping.bounds.top + localY / mapping.scale;
    const center = getCanvasCenter(canvas);
    state.viewport.x = center.x - worldX * state.viewport.zoom;
    state.viewport.y = center.y - worldY * state.viewport.zoom;
    update();
    persist?.();
  }

  minimap.addEventListener("pointerdown", navigate);
  minimap.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    const rect = minimap.getBoundingClientRect();
    navigate({ clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 });
  });

  return Object.freeze({ sync });
}
