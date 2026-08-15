import { createCommand } from "./command-engine.js";
import { getComponentById } from "./component-registry.js";
import { selectedWithDescendants } from "./component-tree.js";

function selectionComponents(state) {
  return selectedWithDescendants(state).filter((component) => component.visible);
}

export function getSelectionBounds(state) {
  const components = selectionComponents(state);
  if (!components.length) return null;
  const left = Math.min(...components.map((component) => component.x - component.width / 2));
  const right = Math.max(...components.map((component) => component.x + component.width / 2));
  const top = Math.min(...components.map((component) => component.y - component.height / 2));
  const bottom = Math.max(...components.map((component) => component.y + component.height / 2));
  return { left, right, top, bottom, width: right - left, height: bottom - top };
}

export function syncSelectionBounds(element, state) {
  const bounds = getSelectionBounds(state);
  element.hidden = !bounds;
  if (!bounds) return;
  element.style.left = bounds.left + "px";
  element.style.top = bounds.top + "px";
  element.style.width = bounds.width + "px";
  element.style.height = bounds.height + "px";
}

export function bindSelectionTransform({
  layer,
  boundsElement,
  state,
  commandEngine,
  update
}) {
  let pointerId = null;
  let mode = "";
  let handle = null;
  let startBounds = null;
  let snapshots = [];
  const startPointer = { x: 0, y: 0 };
  let startAngle = 0;

  function apply(items) {
    items.forEach((item) => {
      const component = getComponentById(state.components, item.id);
      if (component) Object.assign(component, item);
    });
  }

  boundsElement.addEventListener("pointerdown", (event) => {
    const control = event.target.closest?.("[data-transform]");
    if (!control || event.button !== 0 || pointerId !== null) return;
    const selected = selectionComponents(state).filter((component) => !component.locked);
    if (!selected.length) return;
    event.preventDefault();
    event.stopPropagation();
    pointerId = event.pointerId;
    mode = control.dataset.transform;
    handle = control;
    startBounds = getSelectionBounds(state);
    snapshots = selected.map((component) => ({
      id: component.id,
      x: component.x,
      y: component.y,
      width: component.width,
      height: component.height,
      rotation: component.rotation
    }));
    startPointer.x = event.clientX;
    startPointer.y = event.clientY;
    const centerScreen = {
      x: (startBounds.left + startBounds.width / 2) * state.viewport.zoom + state.viewport.x,
      y: (startBounds.top + startBounds.height / 2) * state.viewport.zoom + state.viewport.y
    };
    startAngle = Math.atan2(event.clientY - centerScreen.y, event.clientX - centerScreen.x);
    layer.setPointerCapture?.(pointerId);
  });

  layer.addEventListener("pointermove", (event) => {
    if (event.pointerId !== pointerId) return;
    if (mode === "rotate") {
      const center = {
        x: startBounds.left + startBounds.width / 2,
        y: startBounds.top + startBounds.height / 2
      };
      const centerScreen = {
        x: center.x * state.viewport.zoom + state.viewport.x,
        y: center.y * state.viewport.zoom + state.viewport.y
      };
      const angle = Math.atan2(event.clientY - centerScreen.y, event.clientX - centerScreen.x);
      const delta = angle - startAngle;
      const cosine = Math.cos(delta);
      const sine = Math.sin(delta);
      snapshots.forEach((snapshot) => {
        const component = getComponentById(state.components, snapshot.id);
        if (!component) return;
        const offsetX = snapshot.x - center.x;
        const offsetY = snapshot.y - center.y;
        component.x = center.x + offsetX * cosine - offsetY * sine;
        component.y = center.y + offsetX * sine + offsetY * cosine;
        component.rotation = snapshot.rotation + delta * 180 / Math.PI;
      });
      update();
      return;
    }

    const deltaX = (event.clientX - startPointer.x) / state.viewport.zoom;
    const deltaY = (event.clientY - startPointer.y) / state.viewport.zoom;
    const west = mode.endsWith("nw") || mode.endsWith("sw");
    const north = mode.endsWith("nw") || mode.endsWith("ne");
    let left = startBounds.left + (west ? deltaX : 0);
    let right = startBounds.right + (west ? 0 : deltaX);
    let top = startBounds.top + (north ? deltaY : 0);
    let bottom = startBounds.bottom + (north ? 0 : deltaY);
    if (right - left < 40) {
      if (west) left = right - 40;
      else right = left + 40;
    }
    if (bottom - top < 32) {
      if (north) top = bottom - 32;
      else bottom = top + 32;
    }
    const scaleX = (right - left) / Math.max(1, startBounds.width);
    const scaleY = (bottom - top) / Math.max(1, startBounds.height);
    snapshots.forEach((snapshot) => {
      const component = getComponentById(state.components, snapshot.id);
      if (!component) return;
      component.x = left + (snapshot.x - startBounds.left) * scaleX;
      component.y = top + (snapshot.y - startBounds.top) * scaleY;
      component.width = Math.max(40, snapshot.width * scaleX);
      component.height = Math.max(32, snapshot.height * scaleY);
    });
    update();
  });

  function stop(event) {
    if (pointerId === null || (event?.pointerId != null && event.pointerId !== pointerId)) return;
    const activeId = pointerId;
    pointerId = null;
    if (layer.hasPointerCapture?.(activeId)) layer.releasePointerCapture(activeId);
    const after = snapshots.map((snapshot) => {
      const component = getComponentById(state.components, snapshot.id);
      return component ? {
        id: component.id,
        x: component.x,
        y: component.y,
        width: component.width,
        height: component.height,
        rotation: component.rotation
      } : snapshot;
    });
    commandEngine.record(createCommand({
      label: mode === "rotate" ? "Rotate selection" : "Resize selection",
      redo: () => apply(after),
      undo: () => apply(snapshots),
      isNoop: () => JSON.stringify(after) === JSON.stringify(snapshots)
    }));
    mode = "";
    handle = null;
    startBounds = null;
    snapshots = [];
  }

  layer.addEventListener("pointerup", stop);
  layer.addEventListener("pointercancel", stop);
  layer.addEventListener("lostpointercapture", stop);
}
