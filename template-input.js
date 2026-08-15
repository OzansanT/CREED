import { createCommand } from "./command-engine.js";
import { getViewportLocalCenter } from "./coordinates.js";
import { createLandingHeroTemplate } from "./templates.js";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function bindTemplateInput({ button, state, canvas, commandEngine }) {
  button.addEventListener("click", () => {
    const center = getViewportLocalCenter(canvas, state);
    const startZ = Math.max(0, ...state.components.map((component) => component.z)) + 1;
    const components = createLandingHeroTemplate({ x: center.x, y: center.y, startZ });
    const ids = components.map((component) => component.id);
    commandEngine.execute(createCommand({
      label: "Add landing hero template",
      redo: () => {
        state.components.push(...clone(components).filter((component) =>
          !state.components.some((candidate) => candidate.id === component.id)
        ));
        state.selection = [...ids];
      },
      undo: () => {
        state.components = state.components.filter((component) => !ids.includes(component.id));
        state.selection = [];
      }
    }));
  });
}
