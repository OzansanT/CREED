import { createCommand } from "./command-engine.js";
import { getComponentById } from "./component-registry.js";

function isEditingTarget(target) {
  return target instanceof Element && Boolean(
    target.closest("input,textarea,select,[contenteditable='true'],[role='textbox']")
  );
}

function setSelection(state, ids) {
  state.selection = [...new Set(ids)].filter((id) => getComponentById(state.components, id));
}

export function bindSelectionInput({
  canvas,
  state,
  commandEngine,
  update,
  persist
}) {
  canvas.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    const componentElement = event.target.closest?.("[data-component-id]");
    if (!componentElement) {
      if (!event.shiftKey && !event.ctrlKey && !event.metaKey) {
        setSelection(state, []);
        update();
        persist?.();
      }
      return;
    }
    const id = componentElement.dataset.componentId;
    const toggle = event.shiftKey || event.ctrlKey || event.metaKey;
    if (toggle) {
      setSelection(
        state,
        state.selection.includes(id)
          ? state.selection.filter((selectedId) => selectedId !== id)
          : [...state.selection, id]
      );
    } else if (!state.selection.includes(id)) {
      setSelection(state, [id]);
    }
    update();
    persist?.();
  }, true);

  canvas.addEventListener("keydown", (event) => {
    const componentElement = event.target.closest?.("[data-component-id]");
    if (!componentElement) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const id = componentElement.dataset.componentId;
      const toggle = event.shiftKey || event.ctrlKey || event.metaKey;
      setSelection(state, toggle && state.selection.includes(id)
        ? state.selection.filter((selectedId) => selectedId !== id)
        : toggle ? [...state.selection, id] : [id]);
      update();
      persist?.();
    } else if (event.key === "Escape") {
      setSelection(state, []);
      update();
      persist?.();
    }
  });

  window.addEventListener("keydown", (event) => {
    if (isEditingTarget(event.target) || event.altKey || event.ctrlKey || event.metaKey) return;
    const direction = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1]
    }[event.key];
    if (!direction || !state.selection.length) return;
    event.preventDefault();
    const step = event.shiftKey ? 10 : 1;
    const selected = state.components.filter((component) => state.selection.includes(component.id) && !component.locked);
    const before = selected.map((component) => ({ id: component.id, x: component.x, y: component.y }));
    const after = before.map((position) => ({
      ...position,
      x: position.x + direction[0] * step,
      y: position.y + direction[1] * step
    }));
    const apply = (positions) => positions.forEach((position) => {
      const component = getComponentById(state.components, position.id);
      if (component) Object.assign(component, { x: position.x, y: position.y });
    });
    commandEngine.execute(createCommand({
      label: "Nudge selection",
      redo: () => apply(after),
      undo: () => apply(before)
    }));
  });

  return Object.freeze({
    select: (ids) => {
      setSelection(state, ids);
      update();
      persist?.();
    }
  });
}
