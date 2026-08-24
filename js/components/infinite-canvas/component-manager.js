import { createCommand } from "../../core/command-engine.js";
import { getViewportWorldCenter, screenToWorld } from "../../core/coordinates.js";
import { snapWorldPoint } from "./snapping.js";

function nextId(type) {
  const random = globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2);
  return `cmp-${type}-${random}`;
}

function normalizeRecord(record, definition) {
  return {
    id: String(record.id || nextId(definition.type)),
    type: definition.type,
    worldX: Number.isFinite(record.worldX) ? record.worldX : 0,
    worldY: Number.isFinite(record.worldY) ? record.worldY : 0,
    width: Math.max(220, Number(record.width) || definition.defaultWidth || 360),
    height: Math.max(140, Number(record.height) || definition.defaultHeight || 240),
    data: record.data && typeof record.data === "object" ? { ...record.data } : {}
  };
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
    return state.canvasComponents.map((item) => ({ ...item, data: { ...(item.data || {}) } }));
  }

  function setPosition(element, record) {
    element.style.left = `${record.worldX}px`;
    element.style.top = `${record.worldY}px`;
    element.style.width = `${record.width}px`;
    element.style.height = `${record.height}px`;
  }

  function unmountRecord(id) {
    const entry = mounted.get(id);
    if (!entry) return;
    try { entry.dispose?.(); } catch {}
    entry.shell.remove();
    mounted.delete(id);
  }

  function applySnapshot(nextSnapshot) {
    state.canvasComponents = nextSnapshot.map((item) => ({ ...item, data: { ...(item.data || {}) } }));
    renderAll();
    update?.();
    persist?.();
  }

  function bindInstanceDrag(shell, handle, record) {
    let pointerId = null;
    let startX = 0;
    let startY = 0;
    let originalX = 0;
    let originalY = 0;
    let moved = false;

    handle.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || pointerId !== null) return;
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

    function finish(event) {
      if (pointerId === null || event.pointerId !== pointerId) return;
      event.stopPropagation?.();
      const active = pointerId;
      pointerId = null;
      shell.classList.remove("is-dragging");
      if (handle.hasPointerCapture?.(active)) handle.releasePointerCapture(active);
      if (!moved) return;
      const afterX = record.worldX;
      const afterY = record.worldY;
      persist?.();
      history?.record(createCommand({
        label: `Move ${record.type} component`,
        redo: () => { record.worldX = afterX; record.worldY = afterY; setPosition(shell, record); persist?.(); },
        undo: () => { record.worldX = originalX; record.worldY = originalY; setPosition(shell, record); persist?.(); },
        isNoop: () => originalX === afterX && originalY === afterY
      }));
    }

    handle.addEventListener("pointerup", finish);
    handle.addEventListener("pointercancel", finish);
    handle.addEventListener("lostpointercapture", () => {
      if (pointerId === null) return;
      const active = pointerId;
      pointerId = null;
      shell.classList.remove("is-dragging");
      if (!moved) return;
      const afterX = record.worldX;
      const afterY = record.worldY;
      persist?.();
      history?.record(createCommand({
        label: `Move ${record.type} component`,
        redo: () => { record.worldX = afterX; record.worldY = afterY; setPosition(shell, record); persist?.(); },
        undo: () => { record.worldX = originalX; record.worldY = originalY; setPosition(shell, record); persist?.(); },
        isNoop: () => originalX === afterX && originalY === afterY
      }));
      void active;
    });
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
      position: "absolute", display: "flex", flexDirection: "column", padding: "0", overflow: "hidden",
      minWidth: "220px", minHeight: "140px", cursor: "default", touchAction: "auto"
    });
    setPosition(shell, record);

    const header = document.createElement("header");
    header.className = "canvas-component__header";
    Object.assign(header.style, {
      display: "flex", alignItems: "center", gap: "8px", minHeight: "34px", padding: "5px 7px 5px 10px",
      borderBottom: "1px solid var(--border, #d0d0d0)", cursor: "grab", userSelect: "none", touchAction: "none",
      background: "var(--panel-bg, #f7f7fa)"
    });

    const title = document.createElement("strong");
    title.textContent = definition.title;
    Object.assign(title.style, { flex: "1", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" });

    const close = document.createElement("button");
    close.type = "button";
    close.className = "icon-button";
    close.textContent = "×";
    close.title = `Remove ${definition.title}`;
    close.setAttribute("aria-label", `Remove ${definition.title}`);
    Object.assign(close.style, { width: "28px", minWidth: "28px" });
    close.addEventListener("pointerdown", (event) => event.stopPropagation());
    close.addEventListener("click", (event) => { event.stopPropagation(); remove(record.id); });

    const content = document.createElement("div");
    content.className = "canvas-component__content";
    Object.assign(content.style, { position: "relative", flex: "1", minHeight: "0", overflow: "hidden", userSelect: "text" });

    header.append(title, close);
    shell.append(header, content);
    world.append(shell);

    const dispose = definition.mount({ shell, content, record, context, notify, manager: api }) || (() => {});
    mounted.set(record.id, { shell, dispose });
    bindInstanceDrag(shell, header, record);
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
      height: definition.defaultHeight
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
    getRecords: () => snapshot(),
    getMountedElement: (id) => mounted.get(id)?.shell || null,
    getMountedElements: () => [...mounted.values()].map((entry) => entry.shell)
  });

  renderAll();
  return api;
}
