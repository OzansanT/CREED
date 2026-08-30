import { createElementInspector } from "./element-inspector.js";

const BLOCKED_TAGS = new Set([
  "HTML", "HEAD", "BODY", "SCRIPT", "STYLE", "LINK", "META", "TITLE", "BASE", "NOSCRIPT"
]);

const VOID_TAGS = new Set([
  "AREA", "BASE", "BR", "COL", "EMBED", "HR", "IMG", "INPUT", "LINK", "META", "PARAM", "SOURCE", "TRACK", "WBR"
]);

const EDIT_BLUE = "#007acc";
const DROP_EDGE_RATIO = 0.25;
const EDIT_LAYOUT_STORAGE_KEY = "creed.editModeLayout.v1";
const EDIT_LAYOUT_VERSION = 1;

function createTitlebarButton({ id, label, title, after, hidden = false }) {
  const existing = document.getElementById(id);
  if (existing) return existing;
  if (!after?.parentElement) return null;

  const button = document.createElement("button");
  button.id = id;
  button.className = "titlebar-action";
  button.type = "button";
  button.title = title;
  button.setAttribute("aria-label", title);
  button.dataset.editModeLocked = "true";
  button.dataset.editModeControl = "true";
  button.hidden = hidden;

  const labelElement = document.createElement("span");
  labelElement.className = "titlebar-action__label";
  labelElement.textContent = label;
  button.append(labelElement);
  after.insertAdjacentElement("afterend", button);
  return button;
}

function createControls(resetButton) {
  const editButton = createTitlebarButton({
    id: "editModeBtn",
    label: "Edit",
    title: "Toggle element edit mode",
    after: resetButton
  });
  if (!editButton) return null;
  editButton.setAttribute("aria-pressed", "false");

  const undoButton = createTitlebarButton({
    id: "editModeUndoBtn",
    label: "Undo",
    title: "Undo last Edit Mode action",
    after: editButton,
    hidden: true
  });
  const redoButton = createTitlebarButton({
    id: "editModeRedoBtn",
    label: "Redo",
    title: "Redo last Edit Mode action",
    after: undoButton,
    hidden: true
  });
  const saveButton = createTitlebarButton({
    id: "editModeSaveBtn",
    label: "Save Layout",
    title: "Save the current Edit Mode layout",
    after: redoButton,
    hidden: true
  });

  if (!undoButton || !redoButton || !saveButton) return null;
  return { editButton, undoButton, redoButton, saveButton };
}

function snapshotStyle(element, properties) {
  return Object.fromEntries(properties.map((property) => [
    property,
    {
      value: element.style.getPropertyValue(property),
      priority: element.style.getPropertyPriority(property)
    }
  ]));
}

function restoreStyle(element, snapshot) {
  if (!element || !snapshot) return;
  for (const [property, state] of Object.entries(snapshot)) {
    if (state.value) element.style.setProperty(property, state.value, state.priority);
    else element.style.removeProperty(property);
  }
}

function getDropPosition(target, clientY) {
  const rect = target.getBoundingClientRect();
  if (!Number.isFinite(rect.height) || rect.height <= 0) return "inside";
  const ratio = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
  if (ratio <= DROP_EDGE_RATIO) return "before";
  if (ratio >= 1 - DROP_EDGE_RATIO) return "after";
  return VOID_TAGS.has(target.tagName) ? (ratio < 0.5 ? "before" : "after") : "inside";
}

function safeReadLayout() {
  try {
    const raw = localStorage.getItem(EDIT_LAYOUT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.version !== EDIT_LAYOUT_VERSION || !Array.isArray(parsed.parents)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function safeWriteLayout(layout) {
  try {
    localStorage.setItem(EDIT_LAYOUT_STORAGE_KEY, JSON.stringify(layout));
    return true;
  } catch {
    return false;
  }
}

function safeClearLayout() {
  try {
    localStorage.removeItem(EDIT_LAYOUT_STORAGE_KEY);
  } catch {
    // Storage can be unavailable in restricted browser contexts.
  }
}

function nextCopyId(originalId) {
  const base = `${originalId}-copy`;
  if (!document.getElementById(base)) return base;
  let index = 2;
  while (document.getElementById(`${base}-${index}`)) index += 1;
  return `${base}-${index}`;
}

function prepareClone(source) {
  const clone = source.cloneNode(true);
  const nodes = [clone, ...clone.querySelectorAll("*")];
  for (const node of nodes) {
    delete node.dataset.editModeKey;
    node.removeAttribute("draggable");
    node.style.removeProperty("outline");
    node.style.removeProperty("outline-offset");
    node.style.removeProperty("box-shadow");
    node.style.removeProperty("opacity");
    if (node.id) node.id = nextCopyId(node.id);
  }
  return clone;
}

export function bindEditMode({ resetButton, notify = () => {} } = {}) {
  const controls = createControls(resetButton);
  if (!controls) {
    return Object.freeze({
      isActive: () => false,
      setActive: () => false,
      toggle: () => false,
      undo: () => false,
      redo: () => false,
      saveLayout: () => false,
      select: () => false,
      clearSelection: () => false
    });
  }

  const { editButton, undoButton, redoButton, saveButton } = controls;
  let active = false;
  let dragSource = null;
  let hoverState = null;
  let selectedState = null;
  let dropState = null;
  let sourceOpacity = null;
  let dirty = false;
  const originalDraggable = new Map();
  const elementByKey = new Map();
  const touchedParentKeys = new Set();
  const undoStack = [];
  const redoStack = [];

  function getStructuralKey(element) {
    if (element.id) return `id:${element.id}`;
    const parts = [];
    let current = element;
    while (current && current !== document.body) {
      const parent = current.parentElement;
      if (!parent) break;
      const sameTagSiblings = [...parent.children].filter((child) => child.tagName === current.tagName);
      parts.unshift(`${current.tagName.toLowerCase()}:${sameTagSiblings.indexOf(current)}`);
      if (parent.id) {
        parts.unshift(`id:${parent.id}`);
        break;
      }
      current = parent;
    }
    return `path:${parts.join("/")}`;
  }

  function ensureElementKey(element) {
    if (!(element instanceof Element) || BLOCKED_TAGS.has(element.tagName)) return null;
    const existing = element.dataset.editModeKey;
    const key = existing || getStructuralKey(element);
    element.dataset.editModeKey = key;
    elementByKey.set(key, element);
    return key;
  }

  function indexTree(root) {
    if (!(root instanceof Element)) return;
    ensureElementKey(root);
    root.querySelectorAll("*").forEach(ensureElementKey);
  }

  function getElementByKey(key) {
    const cached = elementByKey.get(key);
    if (cached?.isConnected) return cached;
    const found = [...document.querySelectorAll("[data-edit-mode-key]")]
      .find((element) => element.dataset.editModeKey === key) || null;
    if (found) elementByKey.set(key, found);
    return found;
  }

  function isEligible(element) {
    return element instanceof Element
      && !BLOCKED_TAGS.has(element.tagName)
      && !element.closest("[data-edit-mode-locked=\"true\"]");
  }

  function rememberDraggable(element) {
    if (!isEligible(element) || originalDraggable.has(element)) return;
    originalDraggable.set(element, element.hasAttribute("draggable") ? element.getAttribute("draggable") : null);
    element.setAttribute("draggable", "true");
  }

  function markTreeDraggable(root) {
    if (!(root instanceof Element)) return;
    rememberDraggable(root);
    root.querySelectorAll("*").forEach(rememberDraggable);
  }

  function refreshDraggables() {
    document.body.querySelectorAll("*").forEach(rememberDraggable);
  }

  function restoreDraggables() {
    for (const [element, value] of originalDraggable) {
      if (value === null) element.removeAttribute("draggable");
      else element.setAttribute("draggable", value);
    }
    originalDraggable.clear();
  }

  function clearHover() {
    if (!hoverState) return;
    restoreStyle(hoverState.element, hoverState.snapshot);
    hoverState = null;
  }

  function showHover(element) {
    if (!active || dragSource || !isEligible(element) || selectedState?.element === element || hoverState?.element === element) return;
    clearHover();
    const snapshot = snapshotStyle(element, ["outline", "outline-offset"]);
    element.style.setProperty("outline", `1px solid ${EDIT_BLUE}`);
    element.style.setProperty("outline-offset", "-1px");
    hoverState = { element, snapshot };
  }

  function clearDrop() {
    if (!dropState) return;
    restoreStyle(dropState.element, dropState.snapshot);
    dropState = null;
  }

  function showDrop(element, position) {
    if (dropState?.element === element && dropState.position === position) return;
    clearDrop();
    const snapshot = snapshotStyle(element, ["box-shadow"]);
    const shadow = position === "before"
      ? `inset 0 2px 0 ${EDIT_BLUE}`
      : position === "after"
        ? `inset 0 -2px 0 ${EDIT_BLUE}`
        : `inset 0 0 0 2px ${EDIT_BLUE}`;
    element.style.setProperty("box-shadow", shadow);
    dropState = { element, position, snapshot };
  }

  function resolveTarget(eventTarget) {
    if (!(eventTarget instanceof Element)) return null;
    return isEligible(eventTarget) ? eventTarget : null;
  }

  function insertNode(parent, source, nextSibling) {
    if (!(parent instanceof Node) || !(source instanceof Node) || source.contains(parent)) return false;
    const anchor = nextSibling?.parentNode === parent ? nextSibling : null;
    parent.insertBefore(source, anchor);
    return true;
  }

  function markTouchedParent(parent) {
    if (!(parent instanceof Element)) return;
    const key = ensureElementKey(parent);
    if (key) touchedParentKeys.add(key);
  }

  function updateControlState() {
    undoButton.disabled = !active || undoStack.length === 0;
    redoButton.disabled = !active || redoStack.length === 0;
    saveButton.disabled = !active || !dirty;
    undoButton.hidden = !active;
    redoButton.hidden = !active;
    saveButton.hidden = !active;
  }

  function refreshInspector() {
    if (!active || !selectedState?.element?.isConnected) {
      inspector.hide();
      return false;
    }
    return inspector.update(selectedState.element);
  }

  function clearSelection() {
    if (!selectedState) {
      inspector.hide();
      return false;
    }
    restoreStyle(selectedState.element, selectedState.snapshot);
    selectedState = null;
    inspector.hide();
    return true;
  }

  function select(element) {
    if (!active || !isEligible(element)) return false;
    if (selectedState?.element === element) return refreshInspector();
    clearSelection();
    clearHover();
    const snapshot = snapshotStyle(element, ["outline", "outline-offset"]);
    element.style.setProperty("outline", `2px solid ${EDIT_BLUE}`);
    element.style.setProperty("outline-offset", "-2px");
    selectedState = { element, snapshot };
    ensureElementKey(element);
    return refreshInspector();
  }

  function recordTransaction(transaction) {
    undoStack.push(transaction);
    redoStack.length = 0;
    for (const parent of transaction.parents || []) markTouchedParent(parent);
    dirty = true;
    updateControlState();
    refreshInspector();
  }

  function createMoveTransaction(source, fromParent, fromNextSibling, toParent, toNextSibling) {
    return {
      parents: [fromParent, toParent],
      undo: () => insertNode(fromParent, source, fromNextSibling),
      redo: () => insertNode(toParent, source, toNextSibling)
    };
  }

  function recordCompletedMove(source, fromParent, fromNextSibling) {
    recordTransaction(createMoveTransaction(source, fromParent, fromNextSibling, source.parentNode, source.nextSibling));
  }

  function runHistory(stack, destination) {
    if (!active || stack.length === 0) return false;
    const transaction = stack.pop();
    const action = stack === undoStack ? transaction.undo : transaction.redo;
    if (!action()) {
      stack.push(transaction);
      return false;
    }
    destination.push(transaction);
    for (const parent of transaction.parents || []) markTouchedParent(parent);
    dirty = true;
    if (selectedState?.element && !selectedState.element.isConnected) clearSelection();
    updateControlState();
    refreshInspector();
    return true;
  }

  function undo() {
    return runHistory(undoStack, redoStack);
  }

  function redo() {
    return runHistory(redoStack, undoStack);
  }

  function isValidDropTarget(target) {
    return Boolean(dragSource && target && target !== dragSource && !dragSource.contains(target));
  }

  function moveSource(target, position) {
    if (!isValidDropTarget(target)) return false;
    const source = dragSource;
    const fromParent = source.parentNode;
    const fromNextSibling = source.nextSibling;

    if (position === "inside") {
      if (VOID_TAGS.has(target.tagName)) return false;
      target.append(source);
    } else {
      const parent = target.parentNode;
      if (!parent || parent === source || source.contains(parent)) return false;
      if (position === "before") parent.insertBefore(source, target);
      else parent.insertBefore(source, target.nextSibling);
    }

    recordCompletedMove(source, fromParent, fromNextSibling);
    return true;
  }

  function moveSelected(direction) {
    const source = selectedState?.element;
    const parent = source?.parentNode;
    if (!active || !source || !parent) return false;
    const fromNextSibling = source.nextSibling;

    if (direction < 0) {
      const previous = source.previousElementSibling;
      if (!previous) return false;
      parent.insertBefore(source, previous);
    } else {
      const next = source.nextElementSibling;
      if (!next) return false;
      parent.insertBefore(source, next.nextSibling);
    }

    recordCompletedMove(source, parent, fromNextSibling);
    return true;
  }

  function deleteSelected() {
    const source = selectedState?.element;
    const parent = source?.parentNode;
    if (!active || !source || !parent) return false;
    const nextSibling = source.nextSibling;
    clearSelection();
    source.remove();
    recordTransaction({
      parents: [parent],
      undo: () => insertNode(parent, source, nextSibling),
      redo: () => {
        if (!source.isConnected) return false;
        source.remove();
        return true;
      }
    });
    notify("Element deleted. Undo is available.");
    return true;
  }

  function duplicateSelected() {
    const source = selectedState?.element;
    const parent = source?.parentNode;
    if (!active || !source || !parent) return false;
    const clone = prepareClone(source);
    const anchor = source.nextSibling;
    parent.insertBefore(clone, anchor);
    indexTree(clone);
    if (active) markTreeDraggable(clone);

    recordTransaction({
      parents: [parent],
      undo: () => {
        if (!clone.isConnected) return false;
        clone.remove();
        return true;
      },
      redo: () => insertNode(parent, clone, anchor)
    });
    select(clone);
    notify("Element duplicated.");
    return true;
  }

  const inspector = createElementInspector({
    onClear: clearSelection,
    onDelete: deleteSelected,
    onDuplicate: duplicateSelected,
    onMoveUp: () => moveSelected(-1),
    onMoveDown: () => moveSelected(1)
  });

  function captureLayout() {
    const parents = [];
    for (const parentKey of touchedParentKeys) {
      const parent = getElementByKey(parentKey);
      if (!parent) continue;
      const childKeys = [...parent.children].map((child) => ensureElementKey(child)).filter(Boolean);
      parents.push({ parentKey, childKeys });
    }
    return { version: EDIT_LAYOUT_VERSION, parents };
  }

  function applyLayout(layout) {
    if (!layout?.parents?.length) return false;
    let applied = false;
    for (const record of layout.parents) {
      const parent = getElementByKey(record.parentKey);
      if (!parent || !Array.isArray(record.childKeys)) continue;
      touchedParentKeys.add(record.parentKey);
      for (const childKey of record.childKeys) {
        const child = getElementByKey(childKey);
        if (!child || child === parent || child.contains(parent)) continue;
        parent.append(child);
        applied = true;
      }
    }
    return applied;
  }

  function saveLayout() {
    if (!active) return false;
    const layout = captureLayout();
    if (!safeWriteLayout(layout)) {
      notify("Edit layout could not be saved.");
      return false;
    }
    dirty = false;
    updateControlState();
    notify("Edit layout saved.");
    return true;
  }

  function handleMouseOver(event) {
    if (!active || dragSource) return;
    showHover(resolveTarget(event.target));
  }

  function handleMouseOut(event) {
    if (!active || dragSource || !hoverState) return;
    const next = event.relatedTarget;
    if (next instanceof Node && hoverState.element.contains(next)) return;
    clearHover();
  }

  function handleClickCapture(event) {
    if (!active) return;
    if (event.target instanceof Element && event.target.closest("[data-edit-mode-control=\"true\"]")) return;
    const target = resolveTarget(event.target);
    event.preventDefault();
    event.stopImmediatePropagation();
    if (target) select(target);
  }

  function handleDragStart(event) {
    if (!active) return;
    const source = resolveTarget(event.target);
    if (!source) {
      event.preventDefault();
      return;
    }
    dragSource = source;
    clearHover();
    sourceOpacity = snapshotStyle(source, ["opacity"]);
    source.style.setProperty("opacity", "0.55");
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", source.id || source.tagName.toLowerCase());
    }
  }

  function handleDragOver(event) {
    if (!active || !dragSource) return;
    const target = resolveTarget(event.target);
    if (!isValidDropTarget(target)) {
      clearDrop();
      return;
    }
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
    showDrop(target, getDropPosition(target, event.clientY));
  }

  function handleDrop(event) {
    if (!active || !dragSource) return;
    const target = resolveTarget(event.target);
    if (!isValidDropTarget(target)) return;
    event.preventDefault();
    moveSource(target, getDropPosition(target, event.clientY));
    clearDrop();
  }

  function handleDragEnd() {
    if (dragSource) restoreStyle(dragSource, sourceOpacity);
    dragSource = null;
    sourceOpacity = null;
    clearDrop();
    clearHover();
    refreshInspector();
  }

  function handleKeyDown(event) {
    if (!active) return;
    if (event.target instanceof Element && event.target.closest("input, textarea, [contenteditable=\"true\"]")) return;
    const commandKey = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();

    if (commandKey && key === "s") {
      event.preventDefault();
      event.stopImmediatePropagation();
      saveLayout();
      return;
    }
    if (commandKey && key === "z") {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (event.shiftKey) redo();
      else undo();
      return;
    }
    if (commandKey && key === "y") {
      event.preventDefault();
      event.stopImmediatePropagation();
      redo();
      return;
    }
    if (event.key === "Delete" && selectedState) {
      event.preventDefault();
      event.stopImmediatePropagation();
      deleteSelected();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      if (selectedState) clearSelection();
      else setActive(false);
    }
  }

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      record.addedNodes.forEach((node) => {
        if (!(node instanceof Element)) return;
        indexTree(node);
        if (active) markTreeDraggable(node);
      });
    }
    refreshInspector();
  });

  function setButtonActive(nextActive) {
    editButton.setAttribute("aria-pressed", String(nextActive));
    editButton.title = nextActive ? "Edit mode active — click to close" : "Toggle element edit mode";
    if (nextActive) {
      editButton.style.setProperty("background", EDIT_BLUE);
      editButton.style.setProperty("border-color", EDIT_BLUE);
      editButton.style.setProperty("color", "#fff");
    } else {
      editButton.style.removeProperty("background");
      editButton.style.removeProperty("border-color");
      editButton.style.removeProperty("color");
    }
  }

  function setActive(nextActive) {
    const next = Boolean(nextActive);
    if (active === next) return active;
    active = next;
    setButtonActive(active);
    if (active) {
      refreshDraggables();
    } else {
      handleDragEnd();
      clearSelection();
      restoreDraggables();
    }
    updateControlState();
    return active;
  }

  function toggle() {
    return setActive(!active);
  }

  indexTree(document.body);
  observer.observe(document.body, { childList: true, subtree: true });
  const savedLayout = safeReadLayout();
  if (savedLayout && applyLayout(savedLayout)) {
    dirty = false;
    notify("Saved edit layout restored.");
  }

  editButton.addEventListener("click", toggle);
  undoButton.addEventListener("click", undo);
  redoButton.addEventListener("click", redo);
  saveButton.addEventListener("click", saveLayout);
  resetButton?.addEventListener("click", () => {
    safeClearLayout();
    clearSelection();
    touchedParentKeys.clear();
    undoStack.length = 0;
    redoStack.length = 0;
    dirty = false;
    updateControlState();
  });
  document.addEventListener("mouseover", handleMouseOver, true);
  document.addEventListener("mouseout", handleMouseOut, true);
  document.addEventListener("click", handleClickCapture, true);
  document.addEventListener("dragstart", handleDragStart, true);
  document.addEventListener("dragover", handleDragOver, true);
  document.addEventListener("drop", handleDrop, true);
  document.addEventListener("dragend", handleDragEnd, true);
  document.addEventListener("keydown", handleKeyDown, true);
  window.addEventListener("resize", refreshInspector);

  updateControlState();

  return Object.freeze({
    isActive: () => active,
    setActive,
    toggle,
    undo,
    redo,
    saveLayout,
    select,
    clearSelection
  });
}
