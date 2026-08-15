import { MAX_ZOOM, MIN_ZOOM } from "./config.js";
import { clamp } from "./state-utils.js";
import { normalizeDesignTokens } from "./design-tokens.js";
import { PREVIEW_BREAKPOINTS } from "./responsive-styles.js";
import {
  createDefaultComponents,
  createComponent,
  JSON_COMPONENT_ID,
  normalizeComponents,
  ORIGIN_COMPONENT_ID
} from "./component-registry.js";

export const DOCUMENT_SCHEMA_VERSION = 2;
export const SIDEBAR_VIEWS = Object.freeze([
  "canvas",
  "infiniteCanvas",
  "components",
  "layers",
  "inspector"
]);

function finite(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeSavedViews(savedViews, legacyAnchor) {
  const source = Array.isArray(savedViews)
    ? savedViews
    : legacyAnchor
      ? [{ id: "saved-default", ...legacyAnchor }]
      : [];
  const ids = new Set();
  return source.flatMap((view, index) => {
    if (!view || !Number.isFinite(Number(view.worldX)) || !Number.isFinite(Number(view.worldY))) {
      return [];
    }
    let id = typeof view.id === "string" && view.id ? view.id : "saved-view-" + (index + 1);
    if (ids.has(id)) id += "-" + (index + 1);
    ids.add(id);
    return [{
      id,
      name: typeof view.name === "string" && view.name ? view.name : "Saved View " + (index + 1),
      worldX: Number(view.worldX),
      worldY: Number(view.worldY),
      zoom: clamp(finite(view.zoom, 1), MIN_ZOOM, MAX_ZOOM)
    }];
  });
}

function normalizeConnections(connections, componentIds) {
  const ids = new Set();
  return (Array.isArray(connections) ? connections : []).flatMap((connection, index) => {
    if (!componentIds.has(connection?.from) || !componentIds.has(connection?.to) || connection.from === connection.to) {
      return [];
    }
    let id = typeof connection.id === "string" && connection.id
      ? connection.id
      : "connection-" + (index + 1);
    if (ids.has(id)) id += "-" + (index + 1);
    ids.add(id);
    return [{
      id,
      from: connection.from,
      to: connection.to,
      label: typeof connection.label === "string" ? connection.label : "",
      color: typeof connection.color === "string" ? connection.color : "#64748b"
    }];
  });
}

function legacyComponents(saved) {
  const origin = saved?.originCard || {};
  const json = saved?.jsonCard || {};
  return [
    createComponent("origin", {
      id: ORIGIN_COMPONENT_ID,
      x: finite(origin.worldX, 0),
      y: finite(origin.worldY, 0),
      visible: true,
      z: 0
    }),
    createComponent("json", {
      id: JSON_COMPONENT_ID,
      x: finite(json.worldX, 0),
      y: finite(json.worldY, 0),
      visible: json.visible === true,
      z: 1
    })
  ];
}

export function createCreedDocument(overrides = {}) {
  const now = new Date().toISOString();
  const components = normalizeComponents(overrides.components || createDefaultComponents());
  const defaults = createDefaultComponents();
  defaults.forEach((component) => {
    if (!components.some((candidate) => candidate.id === component.id)) components.push(component);
  });
  const componentIds = new Set(components.map((component) => component.id));
  const savedViews = normalizeSavedViews(overrides.savedViews, overrides.anchor);
  const activeSavedViewId = savedViews.some((view) => view.id === overrides.activeSavedViewId)
    ? overrides.activeSavedViewId
    : savedViews[0]?.id || null;
  return {
    schemaVersion: DOCUMENT_SCHEMA_VERSION,
    id: typeof overrides.id === "string" && overrides.id ? overrides.id : "creed-workspace",
    title: typeof overrides.title === "string" && overrides.title ? overrides.title : "CREED Workspace",
    createdAt: typeof overrides.createdAt === "string" ? overrides.createdAt : now,
    updatedAt: typeof overrides.updatedAt === "string" ? overrides.updatedAt : now,
    viewport: {
      x: finite(overrides.viewport?.x, 0),
      y: finite(overrides.viewport?.y, 0),
      zoom: clamp(finite(overrides.viewport?.zoom, 1), MIN_ZOOM, MAX_ZOOM)
    },
    worldOrigin: {
      x: finite(overrides.worldOrigin?.x, 0),
      y: finite(overrides.worldOrigin?.y, 0)
    },
    savedViews,
    activeSavedViewId,
    ui: {
      sidebarView: SIDEBAR_VIEWS.includes(overrides.ui?.sidebarView)
        ? overrides.ui.sidebarView
        : "canvas",
      previewBreakpoint: PREVIEW_BREAKPOINTS.includes(overrides.ui?.previewBreakpoint)
        ? overrides.ui.previewBreakpoint
        : "desktop"
    },
    components,
    connections: normalizeConnections(overrides.connections, componentIds),
    designTokens: normalizeDesignTokens(overrides.designTokens),
    selection: Array.isArray(overrides.selection)
      ? [...new Set(overrides.selection.filter((id) => typeof id === "string"))]
      : []
  };
}

export function normalizeCreedDocument(saved) {
  if (!saved || typeof saved !== "object") return createCreedDocument();
  const hasDocumentShape = saved.viewport && Array.isArray(saved.components);
  const migrated = hasDocumentShape
    ? saved
    : {
        ...saved,
        viewport: { x: saved.x, y: saved.y, zoom: saved.zoom },
        ui: { sidebarView: saved.sidebarView },
        components: legacyComponents(saved),
        savedViews: saved.anchor ? [{ id: "saved-default", ...saved.anchor }] : [],
        selection: []
      };
  const document = createCreedDocument(migrated);
  const componentIds = new Set(document.components.map((component) => component.id));
  document.selection = document.selection.filter((id) => componentIds.has(id));
  return document;
}

export function serializeCreedDocument(document) {
  return normalizeCreedDocument(document);
}
