import { createCommand } from "./command-engine.js";
import { getComponentById } from "./component-registry.js";

function clone(value) {
  return typeof structuredClone === "function"
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
}

function getPath(target, path) {
  return path.split(".").reduce((value, key) => value?.[key], target);
}

function setPath(target, path, value) {
  const keys = path.split(".");
  const last = keys.pop();
  const parent = keys.reduce((value, key) => {
    value[key] ||= {};
    return value[key];
  }, target);
  parent[last] = value;
}

function inputValue(input, component, breakpoint) {
  const path = input.dataset.styleField
    ? "styles." + breakpoint + "." + input.dataset.styleField
    : input.dataset.field;
  const value = getPath(component, path);
  if (input.type === "checkbox") return Boolean(value);
  return value ?? "";
}

export function bindInspector({
  form,
  empty,
  previewButtons,
  state,
  commandEngine,
  update,
  persist
}) {
  let signature = "";

  function selectedComponent() {
    return state.selection.length === 1
      ? getComponentById(state.components, state.selection[0])
      : null;
  }

  function sync() {
    const component = selectedComponent();
    const nextSignature = JSON.stringify({
      id: component?.id,
      component,
      breakpoint: state.ui.previewBreakpoint
    });
    if (nextSignature === signature) return;
    signature = nextSignature;
    form.hidden = !component;
    empty.hidden = Boolean(component);
    previewButtons.forEach((button) => {
      const active = button.dataset.breakpoint === state.ui.previewBreakpoint;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    if (!component) return;
    form.querySelectorAll("[data-field], [data-style-field]").forEach((input) => {
      const value = inputValue(input, component, state.ui.previewBreakpoint);
      if (input.type === "checkbox") input.checked = value;
      else input.value = value;
    });
    const type = form.querySelector("[data-inspector-type]");
    if (type) type.textContent = component.type;
  }

  form.addEventListener("change", (event) => {
    const input = event.target.closest?.("[data-field], [data-style-field]");
    const component = selectedComponent();
    if (!input || !component) return;
    const path = input.dataset.styleField
      ? "styles." + state.ui.previewBreakpoint + "." + input.dataset.styleField
      : input.dataset.field;
    const before = clone(component);
    const componentId = component.id;
    let value = input.type === "checkbox" ? input.checked : input.value;
    if (input.type === "number") {
      value = Number(value);
      if (!Number.isFinite(value)) return;
      if (path === "width") value = Math.max(40, value);
      if (path === "height") value = Math.max(32, value);
    }
    const after = clone(component);
    setPath(after, path, value);
    commandEngine.execute(createCommand({
      label: "Update " + component.name,
      redo: () => {
        const current = getComponentById(state.components, componentId);
        if (current) Object.assign(current, clone(after));
      },
      undo: () => {
        const current = getComponentById(state.components, componentId);
        if (current) Object.assign(current, clone(before));
      }
    }));
  });

  previewButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.ui.previewBreakpoint = button.dataset.breakpoint;
      update();
      persist?.();
    });
  });

  return Object.freeze({ sync });
}
