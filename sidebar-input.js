import { createCommand } from "./command-engine.js";
import {
  createComponent,
  getComponentById,
  JSON_COMPONENT_ID
} from "./component-registry.js";
import { getViewportLocalCenter } from "./coordinates.js";

function playCardClick(card) {
  card.classList.remove("was-clicked");
  void card.offsetWidth;
  card.classList.add("was-clicked");
}

function cloneComponent(component) {
  if (!component) return null;
  return typeof structuredClone === "function"
    ? structuredClone(component)
    : JSON.parse(JSON.stringify(component));
}

export function bindSidebarMenu({
  canvasButton,
  infiniteCanvasButton,
  componentsButton,
  layersButton,
  inspectorButton,
  addJsonCardButton,
  canvas,
  componentLayer,
  showCanvas,
  state,
  commandEngine,
  update,
  persist
}) {
  function setView(view) {
    state.ui.sidebarView = view;
    update();
    persist?.();
  }

  function replaceJsonComponent(snapshot) {
    const index = state.components.findIndex((component) => component.id === JSON_COMPONENT_ID);
    if (!snapshot) {
      if (index >= 0) state.components.splice(index, 1);
      return;
    }
    const clone = cloneComponent(snapshot);
    if (index >= 0) state.components.splice(index, 1, clone);
    else state.components.push(clone);
  }

  canvasButton.addEventListener("click", () => setView("canvas"));
  infiniteCanvasButton.addEventListener("click", () => {
    setView("infiniteCanvas");
    showCanvas?.();
  });
  componentsButton.addEventListener("click", () => setView("components"));
  layersButton.addEventListener("click", () => setView("layers"));
  inspectorButton.addEventListener("click", () => setView("inspector"));

  addJsonCardButton.addEventListener("click", () => {
    const center = getViewportLocalCenter(canvas, state);
    const existing = getComponentById(state.components, JSON_COMPONENT_ID);
    const before = cloneComponent(existing);
    const after = {
      ...(existing || createComponent("json", { id: JSON_COMPONENT_ID })),
      visible: true,
      x: center.x,
      y: center.y
    };
    state.ui.sidebarView = "components";
    if (commandEngine) {
      commandEngine.execute(createCommand({
        label: before?.visible ? "Move JSON File" : "Add JSON File",
        redo: () => replaceJsonComponent(after),
        undo: () => replaceJsonComponent(before)
      }));
    } else {
      replaceJsonComponent(after);
      update();
      persist?.();
    }
    requestAnimationFrame(() => {
      const jsonCard = componentLayer.querySelector('[data-component-id="' + JSON_COMPONENT_ID + '"]');
      jsonCard?.focus({ preventScroll: true });
      if (jsonCard) playCardClick(jsonCard);
    });
  });
}
