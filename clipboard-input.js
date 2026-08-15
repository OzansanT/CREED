import { createCommand } from "./command-engine.js";
import {
  createComponentId,
  getComponentById,
  ORIGIN_COMPONENT_ID
} from "./component-registry.js";
import { selectedWithDescendants } from "./component-tree.js";

function clone(value) {
  return typeof structuredClone === "function"
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
}

function isEditingTarget(target) {
  return target instanceof Element && Boolean(
    target.closest("input,textarea,select,[contenteditable='true'],[role='textbox']")
  );
}

export function bindClipboardInput({ state, commandEngine, update, persist }) {
  let clipboard = [];

  function selectedComponents() {
    return selectedWithDescendants(state).filter((component) =>
      component.id !== ORIGIN_COMPONENT_ID
    );
  }

  function copySelection() {
    clipboard = clone(selectedComponents());
    return clipboard.length > 0;
  }

  function pasteSelection() {
    if (!clipboard.length) return false;
    const idMap = new Map();
    const highestZ = Math.max(0, ...state.components.map((component) => component.z));
    const copies = clipboard.map((component, index) => {
      const copy = clone(component);
      copy.id = createComponentId(component.type);
      copy.name = component.name + " Copy";
      copy.x += 24;
      copy.y += 24;
      copy.z = highestZ + index + 1;
      idMap.set(component.id, copy.id);
      return copy;
    });
    copies.forEach((copy) => {
      if (copy.parentId && idMap.has(copy.parentId)) copy.parentId = idMap.get(copy.parentId);
    });
    const ids = copies.map((component) => component.id);
    commandEngine.execute(createCommand({
      label: copies.length > 1 ? "Paste components" : "Paste component",
      redo: () => {
        state.components.push(...clone(copies));
        state.selection = [...ids];
      },
      undo: () => {
        state.components = state.components.filter((component) => !ids.includes(component.id));
        state.connections = state.connections.filter((connection) =>
          !ids.includes(connection.from) && !ids.includes(connection.to)
        );
        state.selection = [];
      }
    }));
    clipboard = clone(copies);
    return true;
  }

  function deleteSelection() {
    const removed = clone(selectedComponents());
    if (!removed.length) return false;
    const ids = removed.map((component) => component.id);
    const removedConnections = clone(state.connections.filter((connection) =>
      ids.includes(connection.from) || ids.includes(connection.to)
    ));
    commandEngine.execute(createCommand({
      label: removed.length > 1 ? "Delete components" : "Delete component",
      redo: () => {
        state.components = state.components.filter((component) => !ids.includes(component.id));
        state.connections = state.connections.filter((connection) =>
          !ids.includes(connection.from) && !ids.includes(connection.to)
        );
        state.selection = [];
      },
      undo: () => {
        state.components.push(...clone(removed));
        state.connections.push(...clone(removedConnections));
        state.selection = [...ids];
      }
    }));
    return true;
  }

  window.addEventListener("keydown", (event) => {
    if (isEditingTarget(event.target) || event.altKey) return;
    const modifier = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();
    if (modifier && key === "c") {
      if (copySelection()) event.preventDefault();
      return;
    }
    if (modifier && key === "v") {
      if (pasteSelection()) event.preventDefault();
      return;
    }
    if (modifier && key === "d") {
      if (copySelection() && pasteSelection()) event.preventDefault();
      return;
    }
    if (!modifier && (event.key === "Delete" || event.key === "Backspace")) {
      if (deleteSelection()) event.preventDefault();
    }
  });

  return Object.freeze({ copySelection, pasteSelection, deleteSelection });
}
