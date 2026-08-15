import { getComponentDefinition } from "./component-registry.js";
import { openGeneratedJsonFile } from "./json-file.js";
import { applyResponsiveStyles } from "./responsive-styles.js";
import { isEffectivelyLocked, isEffectivelyVisible } from "./component-tree.js";
import { safeDownloadName, safeMimeType, sanitizeUrl } from "./security.js";

function createRoot(component) {
  const element = document.createElement("section");
  element.className = "canvas-component";
  element.tabIndex = 0;
  element.setAttribute("role", "group");
  element.dataset.componentId = component.id;
  return element;
}

function button(label, action) {
  const control = document.createElement("button");
  control.type = "button";
  control.className = "primary component-action";
  control.textContent = label;
  control.addEventListener("pointerdown", (event) => event.stopPropagation());
  control.addEventListener("click", (event) => {
    event.stopPropagation();
    action();
  });
  return control;
}

function downloadFile(component) {
  const blob = new Blob([String(component.props.content || "")], {
    type: safeMimeType(component.props.mimeType || "text/plain")
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = safeDownloadName(component.props.name, "creed-file.txt");
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function renderContent(element, component) {
  const props = component.props || {};
  element.replaceChildren();
  if (component.type === "origin") {
    const eyebrow = document.createElement("small");
    const title = document.createElement("h1");
    const description = document.createElement("p");
    eyebrow.textContent = props.eyebrow || "● WORLD ORIGIN";
    title.textContent = props.title || "CREED";
    description.textContent = props.description || "";
    element.append(eyebrow, title, description);
    return;
  }
  if (component.type === "json") {
    const eyebrow = document.createElement("small");
    const title = document.createElement("h2");
    eyebrow.textContent = "COMPONENT";
    title.textContent = props.title || "JSON File";
    element.append(eyebrow, title, button("Open JSON File", () => openGeneratedJsonFile(props.data)));
    return;
  }
  if (component.type === "text") {
    const text = document.createElement("p");
    text.className = "canvas-component__text";
    text.textContent = props.text || "";
    element.append(text);
    return;
  }
  if (component.type === "image") {
    const safeSource = sanitizeUrl(props.src, { image: true });
    if (safeSource) {
      const image = document.createElement("img");
      image.src = safeSource;
      image.alt = props.alt || "";
      image.draggable = false;
      element.append(image);
    } else {
      const placeholder = document.createElement("div");
      placeholder.className = "canvas-component__placeholder";
      placeholder.textContent = "Image";
      element.append(placeholder);
    }
    return;
  }
  if (component.type === "button") {
    const preview = document.createElement("span");
    preview.className = "canvas-component__button-preview";
    preview.textContent = props.text || "Button";
    element.append(preview);
    return;
  }
  if (component.type === "link") {
    const preview = document.createElement("span");
    preview.className = "canvas-component__link-preview";
    preview.textContent = props.text || props.href || "Link";
    element.append(preview);
    return;
  }
  if (component.type === "file") {
    const eyebrow = document.createElement("small");
    const title = document.createElement("h2");
    eyebrow.textContent = props.mimeType || "FILE";
    title.textContent = props.name || "File";
    element.append(eyebrow, title, button("Download", () => downloadFile(component)));
    return;
  }
  const label = document.createElement("strong");
  const details = document.createElement("span");
  label.className = "canvas-component__frame-label";
  details.className = "canvas-component__frame-size";
  label.textContent = props.label || component.name;
  details.textContent = Math.round(component.width) + " × " + Math.round(component.height);
  element.append(label, details);
}

function contentSignature(component, breakpoint) {
  return JSON.stringify({
    type: component.type,
    props: component.props,
    breakpoint
  });
}

export function createComponentRenderer({ layer, state }) {
  const elements = new Map();

  function sync() {
    const activeIds = new Set();
    const selected = new Set(state.selection);
    const sorted = [...state.components].sort((a, b) => a.z - b.z);
    sorted.forEach((component) => {
      activeIds.add(component.id);
      let element = elements.get(component.id);
      if (!element) {
        element = createRoot(component);
        elements.set(component.id, element);
        layer.append(element);
      }
      const wasDragging = element.classList.contains("is-dragging");
      const wasClicked = element.classList.contains("was-clicked");
      const definition = getComponentDefinition(component.type);
      element.className = "canvas-component canvas-component--" + component.type;
      element.dataset.componentId = component.id;
      element.dataset.componentType = component.type;
      element.setAttribute("aria-label", (definition?.label || component.name) + " component");
      element.setAttribute("aria-selected", String(selected.has(component.id)));
      element.classList.toggle("is-selected", selected.has(component.id));
      element.classList.toggle("is-locked", isEffectivelyLocked(state.components, component));
      element.classList.toggle("is-dragging", wasDragging);
      element.classList.toggle("was-clicked", wasClicked);
      element.hidden = !isEffectivelyVisible(state.components, component);
      element.style.left = component.x + "px";
      element.style.top = component.y + "px";
      element.style.width = component.width + "px";
      element.style.height = component.height + "px";
      element.style.zIndex = String(component.z);
      element.style.transform = "translate(-50%, -50%) rotate(" + component.rotation + "deg)";
      applyResponsiveStyles(
        element,
        component,
        state.ui.previewBreakpoint,
        state.designTokens
      );
      const signature = contentSignature(component, state.ui.previewBreakpoint);
      if (element.dataset.contentSignature !== signature) {
        renderContent(element, component);
        element.dataset.contentSignature = signature;
      }
    });
    elements.forEach((element, id) => {
      if (activeIds.has(id)) return;
      element.remove();
      elements.delete(id);
    });
  }

  function getElement(componentId) {
    return elements.get(componentId) || null;
  }

  return Object.freeze({ sync, getElement });
}
