import { createCommand } from "./command-engine.js";
import { getComponentById } from "./component-registry.js";

export function bindAlignmentInput({ controls, state, commandEngine, notify }) {
  controls.addEventListener("click", (event) => {
    const action = event.target.closest?.("[data-align]")?.dataset.align;
    if (!action) return;
    const selected = state.components.filter((component) =>
      state.selection.includes(component.id) && !component.locked
    );
    if (selected.length < 2) {
      notify?.("Select at least two unlocked components");
      return;
    }
    if (action.startsWith("distribute") && selected.length < 3) {
      notify?.("Select at least three components to distribute");
      return;
    }
    const before = selected.map((component) => ({ id: component.id, x: component.x, y: component.y }));
    const left = Math.min(...selected.map((component) => component.x - component.width / 2));
    const right = Math.max(...selected.map((component) => component.x + component.width / 2));
    const top = Math.min(...selected.map((component) => component.y - component.height / 2));
    const bottom = Math.max(...selected.map((component) => component.y + component.height / 2));

    if (action === "left") selected.forEach((component) => component.x = left + component.width / 2);
    if (action === "center") selected.forEach((component) => component.x = (left + right) / 2);
    if (action === "right") selected.forEach((component) => component.x = right - component.width / 2);
    if (action === "top") selected.forEach((component) => component.y = top + component.height / 2);
    if (action === "middle") selected.forEach((component) => component.y = (top + bottom) / 2);
    if (action === "bottom") selected.forEach((component) => component.y = bottom - component.height / 2);
    if (action === "distribute-x") {
      const sorted = [...selected].sort((a, b) => a.x - b.x);
      const step = (sorted.at(-1).x - sorted[0].x) / (sorted.length - 1);
      sorted.forEach((component, index) => component.x = sorted[0].x + step * index);
    }
    if (action === "distribute-y") {
      const sorted = [...selected].sort((a, b) => a.y - b.y);
      const step = (sorted.at(-1).y - sorted[0].y) / (sorted.length - 1);
      sorted.forEach((component, index) => component.y = sorted[0].y + step * index);
    }

    const after = selected.map((component) => ({ id: component.id, x: component.x, y: component.y }));
    const apply = (positions) => positions.forEach((position) => {
      const component = getComponentById(state.components, position.id);
      if (component) Object.assign(component, { x: position.x, y: position.y });
    });
    commandEngine.record(createCommand({
      label: "Align selection",
      redo: () => apply(after),
      undo: () => apply(before)
    }));
  });
}
