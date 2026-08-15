const registry = new Map();
let componentSequence = 0;

export const ORIGIN_COMPONENT_ID = "origin";
export const JSON_COMPONENT_ID = "json-1";

function clone(value) {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function finite(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function cleanId(value, fallback) {
  const id = typeof value === "string" ? value.trim() : "";
  return id || fallback;
}

export function createComponentId(type = "component") {
  componentSequence += 1;
  if (globalThis.crypto?.randomUUID) return type + "-" + crypto.randomUUID();
  return type + "-" + Date.now().toString(36) + "-" + componentSequence.toString(36);
}

export function registerComponentType(type, definition) {
  if (!type || typeof type !== "string") throw new TypeError("Component type must be a string");
  if (!definition || typeof definition !== "object") throw new TypeError("Component definition is required");
  registry.set(type, Object.freeze({
    label: definition.label || type,
    category: definition.category || "General",
    defaults: Object.freeze(clone(definition.defaults || {}))
  }));
  return registry.get(type);
}

export function getComponentDefinition(type) {
  return registry.get(type) || null;
}

export function listComponentTypes() {
  return [...registry.entries()].map(([type, definition]) => ({ type, ...definition }));
}

export function createComponent(type, overrides = {}) {
  const definition = getComponentDefinition(type);
  if (!definition) throw new Error("Unknown component type: " + type);
  const defaults = clone(definition.defaults);
  const id = cleanId(overrides.id, createComponentId(type));
  return {
    id,
    type,
    name: typeof overrides.name === "string" ? overrides.name : definition.label,
    visible: overrides.visible !== false,
    locked: overrides.locked === true,
    x: finite(overrides.x, finite(defaults.x, 0)),
    y: finite(overrides.y, finite(defaults.y, 0)),
    width: Math.max(40, finite(overrides.width, finite(defaults.width, 240))),
    height: Math.max(32, finite(overrides.height, finite(defaults.height, 120))),
    rotation: finite(overrides.rotation, finite(defaults.rotation, 0)),
    z: Math.round(finite(overrides.z, finite(defaults.z, 0))),
    parentId: typeof overrides.parentId === "string" ? overrides.parentId : null,
    styles: {
      desktop: { ...(defaults.styles?.desktop || {}), ...(overrides.styles?.desktop || {}) },
      tablet: { ...(defaults.styles?.tablet || {}), ...(overrides.styles?.tablet || {}) },
      mobile: { ...(defaults.styles?.mobile || {}), ...(overrides.styles?.mobile || {}) }
    },
    props: {
      ...(defaults.props || {}),
      ...(overrides.props && typeof overrides.props === "object" ? clone(overrides.props) : {})
    }
  };
}

export function normalizeComponents(components) {
  const source = Array.isArray(components) ? components : [];
  const ids = new Set();
  const normalized = [];
  source.forEach((candidate, index) => {
    if (!candidate || !getComponentDefinition(candidate.type)) return;
    const component = createComponent(candidate.type, candidate);
    if (ids.has(component.id)) component.id = createComponentId(component.type);
    ids.add(component.id);
    if (!Number.isFinite(component.z)) component.z = index;
    normalized.push(component);
  });
  return normalized;
}

export function getComponentById(components, componentId) {
  return components.find((component) => component.id === componentId) || null;
}

export function createDefaultComponents() {
  return [
    createComponent("origin", { id: ORIGIN_COMPONENT_ID, visible: true, z: 0 }),
    createComponent("json", { id: JSON_COMPONENT_ID, visible: false, z: 1 })
  ];
}

registerComponentType("origin", {
  label: "CREED Origin",
  category: "System",
  defaults: {
    width: 300,
    height: 152,
    styles: {
      desktop: { backgroundColor: "$colors.surface", color: "$colors.text", borderRadius: "8px" }
    },
    props: {
      eyebrow: "● WORLD ORIGIN",
      title: "CREED",
      description: "Infinite canvas inside a Codespaces-inspired workbench."
    }
  }
});

registerComponentType("json", {
  label: "JSON File",
  category: "Files",
  defaults: {
    width: 240,
    height: 116,
    styles: {
      desktop: { backgroundColor: "$colors.surface", color: "$colors.text", borderRadius: "3px" }
    },
    props: { title: "JSON File", data: {} }
  }
});

registerComponentType("text", {
  label: "Text",
  category: "Content",
  defaults: {
    width: 260,
    height: 72,
    styles: {
      desktop: { color: "$colors.text", fontSize: "24px", fontWeight: "600", textAlign: "left" },
      tablet: { fontSize: "22px" },
      mobile: { fontSize: "20px" }
    },
    props: { text: "Editable text" }
  }
});

registerComponentType("image", {
  label: "Image",
  category: "Media",
  defaults: {
    width: 320,
    height: 200,
    styles: { desktop: { backgroundColor: "#eef1f5", borderRadius: "8px" } },
    props: { src: "", alt: "Image component" }
  }
});

registerComponentType("button", {
  label: "Button",
  category: "Content",
  defaults: {
    width: 150,
    height: 48,
    styles: {
      desktop: {
        backgroundColor: "$colors.accent",
        color: "#ffffff",
        borderRadius: "6px",
        fontWeight: "700",
        textAlign: "center"
      }
    },
    props: { text: "Button", href: "#" }
  }
});

registerComponentType("container", {
  label: "Container",
  category: "Layout",
  defaults: {
    width: 480,
    height: 280,
    styles: {
      desktop: { backgroundColor: "$colors.surface", borderColor: "#cfd6df", borderWidth: "1px", borderStyle: "solid", borderRadius: "8px" }
    },
    props: { label: "Container" }
  }
});

registerComponentType("group", {
  label: "Group",
  category: "Layout",
  defaults: {
    width: 360,
    height: 220,
    styles: {
      desktop: { backgroundColor: "transparent", borderColor: "#7c8da1", borderWidth: "1px", borderStyle: "dashed" }
    },
    props: { label: "Group" }
  }
});

registerComponentType("section", {
  label: "Section",
  category: "Layout",
  defaults: {
    width: 760,
    height: 360,
    styles: {
      desktop: { backgroundColor: "#f7f8fb", borderColor: "#bac5d1", borderWidth: "1px", borderStyle: "dashed", borderRadius: "8px" }
    },
    props: { label: "Section" }
  }
});

registerComponentType("page", {
  label: "Page Frame",
  category: "Layout",
  defaults: {
    width: 1200,
    height: 800,
    styles: {
      desktop: { backgroundColor: "$colors.surface", borderColor: "#9aa7b5", borderWidth: "1px", borderStyle: "solid" }
    },
    props: { label: "Desktop Page", breakpoint: "desktop" }
  }
});

registerComponentType("link", {
  label: "Link",
  category: "Content",
  defaults: {
    width: 180,
    height: 42,
    styles: { desktop: { color: "$colors.accent", fontSize: "16px", textAlign: "center" } },
    props: { text: "Link", href: "#" }
  }
});

registerComponentType("file", {
  label: "File",
  category: "Files",
  defaults: {
    width: 220,
    height: 96,
    styles: { desktop: { backgroundColor: "$colors.surface", borderRadius: "6px" } },
    props: { name: "document.txt", mimeType: "text/plain", content: "" }
  }
});
