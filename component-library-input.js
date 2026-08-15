import { createCommand } from "./command-engine.js";
import { createComponent } from "./component-registry.js";
import { getViewportLocalCenter } from "./coordinates.js";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function addComponentAtViewport({
  type,
  state,
  canvas,
  commandEngine,
  overrides = {}
}) {
  const center = getViewportLocalCenter(canvas, state);
  const z = Math.max(0, ...state.components.map((component) => component.z)) + 1;
  const component = createComponent(type, {
    x: center.x,
    y: center.y,
    z,
    ...overrides
  });
  commandEngine.execute(createCommand({
    label: "Add " + component.name,
    redo: () => {
      if (!state.components.some((candidate) => candidate.id === component.id)) {
        state.components.push(clone(component));
      }
      state.selection = [component.id];
      state.ui.sidebarView = "inspector";
    },
    undo: () => {
      state.components = state.components.filter((candidate) => candidate.id !== component.id);
      state.selection = [];
    }
  }));
  return component;
}

export function bindComponentLibrary({
  container,
  state,
  canvas,
  commandEngine
}) {
  container.addEventListener("click", (event) => {
    const button = event.target.closest?.("[data-component-type]");
    if (!button) return;
    addComponentAtViewport({
      type: button.dataset.componentType,
      state,
      canvas,
      commandEngine
    });
  });
}
