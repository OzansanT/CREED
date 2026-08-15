import { createCommand } from "./command-engine.js";
import { getComponentById } from "./component-registry.js";
import { snapComponentPosition, updateAlignmentGuides } from "./snapping.js";
import { getDescendantIds, isEffectivelyLocked } from "./component-tree.js";

function isInteractiveTarget(target) {
  return target instanceof Element && Boolean(target.closest("button,a,input,textarea,select,label"));
}

export function bindCardDrag({
  layer,
  state,
  commandEngine,
  verticalGuide,
  horizontalGuide,
  update,
  persist
}) {
  let activePointerId = null;
  let draggedElement = null;
  let draggedId = "";
  let moved = false;
  const startPointer = { x: 0, y: 0 };
  let before = [];

  function positions(ids) {
    return ids.flatMap((id) => {
      const component = getComponentById(state.components, id);
      return component ? [{ id, x: component.x, y: component.y }] : [];
    });
  }

  function apply(items) {
    items.forEach((item) => {
      const component = getComponentById(state.components, item.id);
      if (component) Object.assign(component, { x: item.x, y: item.y });
    });
  }

  layer.addEventListener("pointerdown", (event) => {
    const element = event.target.closest?.("[data-component-id]");
    if (
      !element ||
      event.button !== 0 ||
      activePointerId !== null ||
      event.shiftKey ||
      event.ctrlKey ||
      event.metaKey ||
      isInteractiveTarget(event.target)
    ) return;
    const component = getComponentById(state.components, element.dataset.componentId);
    if (!component || isEffectivelyLocked(state.components, component)) return;
    event.preventDefault();
    event.stopPropagation();
    draggedId = component.id;
    if (!state.selection.includes(draggedId)) state.selection = [draggedId];
    const movableIds = getDescendantIds(state.components, state.selection)
      .filter((id) => {
        const candidate = getComponentById(state.components, id);
        return candidate && !isEffectivelyLocked(state.components, candidate);
      });
    before = positions(movableIds);
    activePointerId = event.pointerId;
    draggedElement = element;
    moved = false;
    startPointer.x = event.clientX;
    startPointer.y = event.clientY;
    element.classList.add("is-dragging");
    element.focus({ preventScroll: true });
    layer.setPointerCapture?.(event.pointerId);
    update();
  });

  layer.addEventListener("pointermove", (event) => {
    if (event.pointerId !== activePointerId) return;
    const deltaX = (event.clientX - startPointer.x) / state.viewport.zoom;
    const deltaY = (event.clientY - startPointer.y) / state.viewport.zoom;
    moved ||= Math.abs(deltaX) > 1 || Math.abs(deltaY) > 1;
    const primaryStart = before.find((item) => item.id === draggedId);
    const primary = getComponentById(state.components, draggedId);
    if (!primaryStart || !primary) return;
    const snapped = snapComponentPosition({
      x: primaryStart.x + deltaX,
      y: primaryStart.y + deltaY,
      width: primary.width,
      height: primary.height,
      components: state.components,
      excludeIds: before.map((item) => item.id),
      zoom: state.viewport.zoom
    });
    const adjustedX = snapped.x - primaryStart.x;
    const adjustedY = snapped.y - primaryStart.y;
    apply(before.map((item) => ({
      id: item.id,
      x: item.x + adjustedX,
      y: item.y + adjustedY
    })));
    updateAlignmentGuides({
      vertical: verticalGuide,
      horizontal: horizontalGuide,
      guides: snapped.guides,
      state
    });
    update();
  });

  function stop(event) {
    if (activePointerId === null || (event?.pointerId != null && event.pointerId !== activePointerId)) return;
    const pointerId = activePointerId;
    activePointerId = null;
    draggedElement?.classList.remove("is-dragging");
    if (layer.hasPointerCapture?.(pointerId)) layer.releasePointerCapture(pointerId);
    verticalGuide.hidden = true;
    horizontalGuide.hidden = true;
    const after = positions(before.map((item) => item.id));
    if (moved) {
      commandEngine.record(createCommand({
        label: state.selection.length > 1 ? "Move components" : "Move component",
        redo: () => apply(after),
        undo: () => apply(before),
        isNoop: () => before.every((item, index) =>
          item.x === after[index]?.x && item.y === after[index]?.y
        )
      }));
    } else {
      update();
      persist?.();
    }
    draggedElement = null;
    draggedId = "";
    before = [];
  }

  layer.addEventListener("pointerup", stop);
  layer.addEventListener("pointercancel", stop);
  layer.addEventListener("lostpointercapture", stop);
}
