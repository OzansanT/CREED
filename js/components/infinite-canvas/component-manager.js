import { createCommand } from "../../core/command-engine.js";
import { getViewportWorldCenter, screenToWorld } from "../../core/coordinates.js";
import { bindComponentResize } from "./component-resize-input.js";
import { snapWorldPoint } from "./snapping.js";

const MIN_COMPONENT_WIDTH = 220;
const MIN_COMPONENT_HEIGHT = 140;
const MINIMIZED_HEIGHT = 36;
const MAXIMIZE_MARGIN = 24;
const WINDOW_STATES = new Set(["normal", "minimized", "maximized"]);

function nextId(type) {
  const random = globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2);
  return `cmp-${type}-${random}`;
}

function normalizeBounds(value) {
  if (!value || typeof value !== "object") return null;
  const worldX = Number(value.worldX);
  const worldY = Number(value.worldY);
  const width = Number(value.width);
  const height = Number(value.height);
  if (![worldX, worldY, width, height].every(Number.isFinite)) return null;
  return {
    worldX,
    worldY,
    width: Math.max(MIN_COMPONENT_WIDTH, width),
    height: Math.max(MIN_COMPONENT_HEIGHT, height)
  };
}

function normalizeRecord(record, definition) {
  const windowState = WINDOW_STATES.has(record.windowState) ? record.windowState : "normal";
  return {
    id: String(record.id || nextId(definition.type)),
    type: definition.type,
    worldX: Number.isFinite(record.worldX) ? record.worldX : 0,
    worldY: Number.isFinite(record.worldY) ? record.worldY : 0,
    width: Math.max(MIN_COMPONENT_WIDTH, Number(record.width) || definition.defaultWidth || 360),
    height: Math.max(MIN_COMPONENT_HEIGHT, Number(record.height) || definition.defaultHeight || 240),
    windowState,
    restoreBounds: windowState === "maximized" ? normalizeBounds(record.restoreBounds) : null,
    data: record.data && typeof record.data === "object" ? { ...record.data } : {}
  };
}

function copyRecord(item) {
  return {
    ...item,
    restoreBounds: item.restoreBounds ? { ...item.restoreBounds } : null,
    data: { ...(item.data || {}) }
  };
}

function boundsOf(record) {
  return { worldX: record.worldX, worldY: record.worldY, width: record.width, height: record.height };
}

function writeBounds(record, bounds) {
  record.worldX = bounds.worldX;
  record.worldY = bounds.worldY;
  record.width = bounds.width;
  record.height = bounds.height;
}

export function bindCanvasComponentManager({
  canvas,
  world,
  state,
  registry,
  update,
  persist,
  history,
  context = {},
  notify
} = {}) {
  if (!canvas || !world || !state || !registry) throw new TypeError("Canvas component manager requires canvas, world, state and registry.");
  if (!Array.isArray(state.canvasComponents)) state.canvasComponents = [];

  const mounted = new Map();
  let api = null;

  function snapshot() {
    return state.canvasComponents.map(copyRecord);
  }

  function setPosition(element, record) {
    const minimized = record.windowState === "minimized";
    const maximized = record.windowState === "maximized";
    element.style.left = `${record.worldX}px`;
    element.style.top = `${record.worldY}px`;
    element.style.width = `${record.width}px`;
    element.style.height = `${minimized ? MINIMIZED_HEIGHT : record.height}px`;
    element.style.minHeight = minimized ? `${MINIMIZED_HEIGHT}px` : `${MIN_COMPONENT_HEIGHT}px`;
    element.dataset.windowState = record.windowState || "normal";
    element.classList.toggle("is-minimized", minimized);
    element.classList.toggle("is-maximized", maximized);

    const content = element.querySelector(".canvas-component__content");
    if (content) content.hidden = minimized;
    const minimize = element.querySelector('[data-component-action="minimize"]');
    if (minimize) {
      minimize.textContent = minimized ? "▢" : "—";
      minimize.title = minimized ? "Restore component" : "Minimize component";
      minimize.setAttribute("aria-label", minimize.title);
      minimize.setAttribute("aria-pressed", String(minimized));
    }
    const maximize = element.querySelector('[data-component-action="maximize"]');
    if (maximize) {
      maximize.textContent = maximized ? "❐" : "□";
      maximize.title = maximized ? "Restore component" : "Maximize component";
      maximize.setAttribute("aria-label", maximize.title);
      maximize.setAttribute("aria-pressed", String(maximized));
    }
    element.querySelectorAll(".canvas-component__resize-handle").forEach((handle) => {
      handle.hidden = record.windowState !== "normal";
    });
  }

  function unmountRecord(id) {
    const entry = mounted.get(id);
    if (!entry) return;
    try { entry.dispose?.(); } catch {}
    entry.shell.remove();
    mounted.delete(id);
  }

  function applySnapshot(nextSnapshot) {
    for (const id of [...mounted.keys()]) unmountRecord(id);
    state.canvasComponents = nextSnapshot.map(copyRecord);
    renderAll();
    update?.();
    persist?.();
  }

  function applyRecordBounds(id, bounds) {
    const record = state.canvasComponents.find((item) => item.id === id);
    if (!record) return false;
    writeBounds(record, bounds);
    const shell = mounted.get(id)?.shell;
    if (shell) setPosition(shell, record);
    persist?.();
    update?.();
    return true;
  }

  function bindInstanceDrag(shell, handle, record) {
    let pointerId = null;
    let startX = 0;
    let startY = 0;
    let originalX = 0;
    let originalY = 0;
    let moved = false;

    handle.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || pointerId !== null || record.windowState === "maximized") return;
      event.preventDefault();
      event.stopPropagation();
      pointerId = event.pointerId;
      startX = event.clientX;
      startY = event.clientY;
      originalX = record.worldX;
      originalY = record.worldY;
      moved = false;
      shell.classList.add("is-dragging");
      handle.setPointerCapture?.(pointerId);
    });

    handle.addEventListener("pointermove", (event) => {
      if (event.pointerId !== pointerId) return;
      event.preventDefault();
      event.stopPropagation();
      const dx = (event.clientX - startX) / state.zoom;
      const dy = (event.clientY - startY) / state.zoom;
      moved ||= Math.abs(dx) > 2 || Math.abs(dy) > 2;
      const raw = { worldX: originalX + dx, worldY: originalY + dy };
      const candidates = state.canvasComponents
        .filter((item) => item.id !== record.id)
        .map((item) => ({ worldX: item.worldX, worldY: item.worldY }));
      const next = event.altKey
        ? raw
        : snapWorldPoint({ x: raw.worldX, y: raw.worldY, zoom: state.zoom, candidates });
      record.worldX = next.worldX;
      record.worldY = next.worldY;
      setPosition(shell, record);
    });

    function commitMove() {
      if (!moved) return;
      const before = { worldX: originalX, worldY: originalY, width: record.width, height: record.height };
      const after = boundsOf(record);
      persist?.();
      history?.record(createCommand({
        label: `Move ${record.type} component`,
        redo: () => applyRecordBounds(record.id, after),
        undo: () => applyRecordBounds(record.id, before),
        isNoop: () => originalX === after.worldX && originalY === after.worldY
      }));
    }

    function finish(event) {
      if (pointerId === null || event.pointerId !== pointerId) return;
      event.stopPropagation?.();
      const active = pointerId;
      pointerId = null;
      shell.classList.remove("is-dragging");
      if (handle.hasPointerCapture?.(active)) handle.releasePointerCapture(active);
      commitMove();
    }

    handle.addEventListener("pointerup", finish);
    handle.addEventListener("pointercancel", finish);
    handle.addEventListener("lostpointercapture", (event) => {
      if (pointerId === null) return;
      const active = pointerId;
      pointerId = null;
      shell.classList.remove("is-dragging");
      commitMove();
      void active;
      event.stopPropagation?.();
    });
  }

  function recordWindowChange(label, before, trackHistory) {
    persist?.();
    update?.();
    if (!trackHistory || !history) return;
    const after = snapshot();
    history.record(createCommand({ label, redo: () => applySnapshot(after), undo: () => applySnapshot(before) }));
  }

  function toggleMinimize(id, { trackHistory = true } = {}) {
    const record = state.canvasComponents.find((item) => item.id === id);
    if (!record) return false;
    const before = snapshot();
    if (record.windowState === "minimized") {
      record.windowState = "normal";
    } else {
      if (record.windowState === "maximized" && record.restoreBounds) writeBounds(record, record.restoreBounds);
      record.restoreBounds = null;
      record.windowState = "minimized";
    }
    const shell = mounted.get(id)?.shell;
    if (shell) setPosition(shell, record);
    recordWindowChange(`${record.windowState === "minimized" ? "Minimize" : "Restore"} ${record.type} component`, before, trackHistory);
    return true;
  }

  function toggleMaximize(id, { trackHistory = true } = {}) {
    const record = state.canvasComponents.find((item) => item.id === id);
    if (!record) return false;
    const before = snapshot();
    if (record.windowState === "maximized") {
      if (record.restoreBounds) writeBounds(record, record.restoreBounds);
      record.restoreBounds = null;
      record.windowState = "normal";
    } else {
      record.restoreBounds = boundsOf(record);
      const center = getViewportWorldCenter(canvas, state);
      const zoom = Math.max(0.01, state.zoom);
      record.worldX = center.x;
      record.worldY = center.y;
      record.width = Math.max(MIN_COMPONENT_WIDTH, (canvas.clientWidth - (MAXIMIZE_MARGIN * 2)) / zoom);
      record.height = Math.max(MIN_COMPONENT_HEIGHT, (canvas.clientHeight - (MAXIMIZE_MARGIN * 2)) / zoom);
      record.windowState = "maximized";
    }
    const shell = mounted.get(id)?.shell;
    if (shell) setPosition(shell, record);
    recordWindowChange(`${record.windowState === "maximized" ? "Maximize" : "Restore"} ${record.type} component`, before, trackHistory);
    return true;
  }

  function makeWindowButton(action, label) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "icon-button";
    button.dataset.componentAction = action;
    button.textContent = label;
    Object.assign(button.style, { width: "28px", minWidth: "28px" });
    button.addEventListener("pointerdown", (event) => event.stopPropagation());
    return button;
  }

  function mountRecord(record) {
    const definition = registry.get(record.type);
    if (!definition || mounted.has(record.id)) return null;

    const shell = document.createElement("section");
    shell.className = "canvas-card canvas-card--component canvas-component";
    shell.dataset.componentId = record.id;
    shell.dataset.componentType = record.type;
    shell.tabIndex = 0;
    Object.assign(shell.style, {
      position: "absolute", display: "flex", flexDirection: "column", padding: "0", overflow: "visible",
      minWidth: `${MIN_COMPONENT_WIDTH}px`, cursor: "default", touchAction: "auto"
    });

    const header = document.createElement("header");
    header.className = "canvas-component__header";
    Object.assign(header.style, {
      display: "flex", alignItems: "center", gap: "6px", minHeight: "34px", padding: "5px 7px 5px 10px",
      borderBottom: "1px solid var(--border, #d0d0d0)", cursor: "grab", userSelect: "none", touchAction: "none",
      background: "var(--panel-bg, #f7f7fa)", overflow: "hidden"
    });

    const title = document.createElement("strong");
    title.textContent = definition.title;
    Object.assign(title.style, { flex: "1", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" });

    const minimize = makeWindowButton("minimize", "—");
    minimize.addEventListener("click", (event) => { event.stopPropagation(); toggleMinimize(record.id); });
    const maximize = makeWindowButton("maximize", "□");
    maximize.addEventListener("click", (event) => { event.stopPropagation(); toggleMaximize(record.id); });
    const close = makeWindowButton("close", "×");
    close.title = `Remove ${definition.title}`;
    close.setAttribute("aria-label", `Remove ${definition.title}`);
    close.addEventListener("click", (event) => { event.stopPropagation(); remove(record.id); });

    const content = document.createElement("div");
    content.className = "canvas-component__content";
    Object.assign(content.style, {
      position: "relative", flex: "1", minHeight: "0", overflow: "hidden", userSelect: "text",
      background: "inherit", borderRadius: "0 0 var(--radius-sm, 4px) var(--radius-sm, 4px)"
    });

    header.append(title, minimize, maximize, close);
    shell.append(header, content);
    world.append(shell);
    mounted.set(record.id, { shell, dispose: () => {} });

    const componentDispose = definition.mount({ shell, content, record, context, notify, manager: api }) || (() => {});
    const resizeDispose = bindComponentResize({
      shell,
      record,
      state,
      persist,
      history,
      setPosition,
      applyRecordBounds,
      isResizable: () => record.windowState === "normal"
    });
    mounted.set(record.id, {
      shell,
      dispose: () => {
        resizeDispose?.();
        componentDispose?.();
      }
    });
    bindInstanceDrag(shell, header, record);
    setPosition(shell, record);
    return shell;
  }

  function renderAll() {
    const ids = new Set(state.canvasComponents.map((item) => item.id));
    for (const id of [...mounted.keys()]) if (!ids.has(id)) unmountRecord(id);
    for (const record of state.canvasComponents) {
      const entry = mounted.get(record.id);
      if (entry) setPosition(entry.shell, record);
      else mountRecord(record);
    }
  }

  function add(type, point = null, { record: suppliedRecord = null, trackHistory = true } = {}) {
    const definition = registry.get(type);
    if (!definition) return null;
    if (definition.singleton) {
      const existing = state.canvasComponents.find((item) => item.type === type);
      if (existing) {
        mounted.get(existing.id)?.shell.focus({ preventScroll: true });
        notify?.(`${definition.title} is already on the canvas.`);
        return existing;
      }
    }
    const center = point || getViewportWorldCenter(canvas, state);
    const before = snapshot();
    const record = normalizeRecord(suppliedRecord || {
      type,
      worldX: center.x,
      worldY: center.y,
      width: definition.defaultWidth,
      height: definition.defaultHeight,
      windowState: "normal"
    }, definition);
    state.canvasComponents.push(record);
    mountRecord(record);
    persist?.();
    update?.();
    if (trackHistory && history) {
      const after = snapshot();
      history.record(createCommand({ label: `Add ${definition.title}`, redo: () => applySnapshot(after), undo: () => applySnapshot(before) }));
    }
    notify?.(`Added ${definition.title}`);
    requestAnimationFrame(() => mounted.get(record.id)?.shell.focus({ preventScroll: true }));
    return record;
  }

  function remove(id, { trackHistory = true } = {}) {
    const record = state.canvasComponents.find((item) => item.id === id);
    if (!record) return false;
    const definition = registry.get(record.type);
    const before = snapshot();
    unmountRecord(id);
    state.canvasComponents = state.canvasComponents.filter((item) => item.id !== id);
    persist?.();
    update?.();
    if (trackHistory && history) {
      const after = snapshot();
      history.record(createCommand({ label: `Remove ${definition?.title || record.type}`, redo: () => applySnapshot(after), undo: () => applySnapshot(before) }));
    }
    notify?.(`Removed ${definition?.title || record.type}`);
    return true;
  }

  function clear({ trackHistory = false } = {}) {
    const before = snapshot();
    for (const id of [...mounted.keys()]) unmountRecord(id);
    state.canvasComponents = [];
    persist?.();
    update?.();
    if (trackHistory && history && before.length) {
      history.record(createCommand({ label: "Clear canvas components", redo: () => applySnapshot([]), undo: () => applySnapshot(before) }));
    }
  }

  function bindPalette(root) {
    if (!root) return;
    root.querySelectorAll("[data-canvas-component-type]").forEach((source) => {
      const type = source.dataset.canvasComponentType;
      source.draggable = true;
      source.addEventListener("dragstart", (event) => {
        event.dataTransfer?.setData("application/x-creed-canvas-component", type);
        if (event.dataTransfer) event.dataTransfer.effectAllowed = "copy";
      });
      source.addEventListener("click", () => add(type));
    });
  }

  canvas.addEventListener("dragover", (event) => {
    if (!event.dataTransfer?.types.includes("application/x-creed-canvas-component")) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  });
  canvas.addEventListener("drop", (event) => {
    const type = event.dataTransfer?.getData("application/x-creed-canvas-component");
    if (!type || !registry.has(type)) return;
    event.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const point = screenToWorld(event.clientX - rect.left, event.clientY - rect.top, state);
    add(type, point);
  });

  api = Object.freeze({
    add,
    remove,
    clear,
    renderAll,
    bindPalette,
    toggleMinimize,
    toggleMaximize,
    getRecords: () => snapshot(),
    getMountedElement: (id) => mounted.get(id)?.shell || null,
    getMountedElements: () => [...mounted.values()].map((entry) => entry.shell)
  });

  renderAll();
  return api;
}
