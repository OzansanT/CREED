import { createCommand } from "./command-engine.js";
import { getComponentById, ORIGIN_COMPONENT_ID } from "./component-registry.js";

function snapshot(component) {
  return {
    visible: component.visible,
    locked: component.locked,
    z: component.z
  };
}

export function bindLayersPanel({ list, state, commandEngine, update, persist }) {
  let signature = "";

  function sync() {
    const nextSignature = JSON.stringify({
      components: state.components.map((component) => ({
        id: component.id,
        name: component.name,
        visible: component.visible,
        locked: component.locked,
        z: component.z
      })),
      selection: state.selection
    });
    if (nextSignature === signature) return;
    signature = nextSignature;
    const fragment = document.createDocumentFragment();
    [...state.components].sort((a, b) => b.z - a.z).forEach((component) => {
      const row = document.createElement("div");
      row.className = "layer-row";
      row.dataset.componentId = component.id;
      row.classList.toggle("is-selected", state.selection.includes(component.id));

      const select = document.createElement("button");
      select.type = "button";
      select.className = "layer-row__name";
      select.dataset.action = "select";
      select.textContent = component.name;

      const visible = document.createElement("button");
      visible.type = "button";
      visible.dataset.action = "visibility";
      visible.title = component.visible ? "Hide" : "Show";
      visible.textContent = component.visible ? "◉" : "○";

      const lock = document.createElement("button");
      lock.type = "button";
      lock.dataset.action = "lock";
      lock.title = component.locked ? "Unlock" : "Lock";
      lock.textContent = component.locked ? "◆" : "◇";

      const up = document.createElement("button");
      up.type = "button";
      up.dataset.action = "up";
      up.title = "Bring forward";
      up.textContent = "↑";

      const down = document.createElement("button");
      down.type = "button";
      down.dataset.action = "down";
      down.title = "Send backward";
      down.textContent = "↓";

      if (component.id === ORIGIN_COMPONENT_ID) visible.disabled = true;
      row.append(select, visible, lock, up, down);
      fragment.append(row);
    });
    list.replaceChildren(fragment);
  }

  list.addEventListener("click", (event) => {
    const action = event.target.closest?.("button")?.dataset.action;
    const row = event.target.closest?.("[data-component-id]");
    const component = row && getComponentById(state.components, row.dataset.componentId);
    if (!action || !component) return;
    if (action === "select") {
      state.selection = [component.id];
      state.ui.sidebarView = "inspector";
      update();
      persist?.();
      return;
    }
    const before = snapshot(component);
    const after = { ...before };
    const componentId = component.id;
    if (action === "visibility") after.visible = !before.visible;
    if (action === "lock") after.locked = !before.locked;
    if (action === "up") after.z = Math.max(...state.components.map((item) => item.z)) + 1;
    if (action === "down") after.z = Math.min(...state.components.map((item) => item.z)) - 1;
    commandEngine.execute(createCommand({
      label: "Update layer",
      redo: () => {
        const current = getComponentById(state.components, componentId);
        if (current) Object.assign(current, after);
      },
      undo: () => {
        const current = getComponentById(state.components, componentId);
        if (current) Object.assign(current, before);
      }
    }));
  });

  return Object.freeze({ sync });
}
