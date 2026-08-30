const BLOCKED_TAGS = new Set([
  "HTML",
  "HEAD",
  "BODY",
  "SCRIPT",
  "STYLE",
  "LINK",
  "META",
  "TITLE",
  "BASE",
  "NOSCRIPT"
]);

const VOID_TAGS = new Set([
  "AREA",
  "BASE",
  "BR",
  "COL",
  "EMBED",
  "HR",
  "IMG",
  "INPUT",
  "LINK",
  "META",
  "PARAM",
  "SOURCE",
  "TRACK",
  "WBR"
]);

const EDIT_BLUE = "#007acc";
const DROP_EDGE_RATIO = 0.25;

function createEditButton(resetButton) {
  const existing = document.getElementById("editModeBtn");
  if (existing) return existing;
  if (!resetButton?.parentElement) return null;

  const button = document.createElement("button");
  button.id = "editModeBtn";
  button.className = "titlebar-action";
  button.type = "button";
  button.title = "Toggle element edit mode";
  button.setAttribute("aria-label", "Toggle element edit mode");
  button.setAttribute("aria-pressed", "false");
  button.dataset.editModeLocked = "true";

  const label = document.createElement("span");
  label.className = "titlebar-action__label";
  label.textContent = "Edit";
  button.append(label);

  resetButton.insertAdjacentElement("afterend", button);
  return button;
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

export function bindEditMode({ resetButton } = {}) {
  const button = createEditButton(resetButton);
  if (!button) {
    return Object.freeze({
      isActive: () => false,
      setActive: () => false,
      toggle: () => false
    });
  }

  let active = false;
  let dragSource = null;
  let hoverState = null;
  let dropState = null;
  let sourceOpacity = null;
  const originalDraggable = new Map();

  function isEligible(element) {
    return element instanceof Element
      && !BLOCKED_TAGS.has(element.tagName)
      && element !== button
      && !button.contains(element)
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
    if (!active || dragSource || !isEligible(element) || hoverState?.element === element) return;
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

  function isValidDropTarget(target) {
    return Boolean(
      dragSource
      && target
      && target !== dragSource
      && !dragSource.contains(target)
    );
  }

  function moveSource(target, position) {
    if (!isValidDropTarget(target)) return false;

    if (position === "inside") {
      if (VOID_TAGS.has(target.tagName)) return false;
      target.append(dragSource);
      return true;
    }

    const parent = target.parentNode;
    if (!parent || parent === dragSource || dragSource.contains(parent)) return false;

    if (position === "before") parent.insertBefore(dragSource, target);
    else parent.insertBefore(dragSource, target.nextSibling);
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
    if (event.target instanceof Node && button.contains(event.target)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
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
    const position = getDropPosition(target, event.clientY);
    moveSource(target, position);
    clearDrop();
  }

  function handleDragEnd() {
    if (dragSource) restoreStyle(dragSource, sourceOpacity);
    dragSource = null;
    sourceOpacity = null;
    clearDrop();
    clearHover();
  }

  const observer = new MutationObserver((records) => {
    if (!active) return;
    for (const record of records) {
      record.addedNodes.forEach((node) => markTreeDraggable(node));
    }
  });

  function setButtonActive(nextActive) {
    button.setAttribute("aria-pressed", String(nextActive));
    button.title = nextActive ? "Edit mode active — click to close" : "Toggle element edit mode";
    if (nextActive) {
      button.style.setProperty("background", EDIT_BLUE);
      button.style.setProperty("border-color", EDIT_BLUE);
      button.style.setProperty("color", "#fff");
    } else {
      button.style.removeProperty("background");
      button.style.removeProperty("border-color");
      button.style.removeProperty("color");
    }
  }

  function setActive(nextActive) {
    const next = Boolean(nextActive);
    if (active === next) return active;
    active = next;
    setButtonActive(active);

    if (active) {
      refreshDraggables();
      observer.observe(document.body, { childList: true, subtree: true });
    } else {
      observer.disconnect();
      handleDragEnd();
      restoreDraggables();
    }

    return active;
  }

  function toggle() {
    return setActive(!active);
  }

  button.addEventListener("click", toggle);
  document.addEventListener("mouseover", handleMouseOver, true);
  document.addEventListener("mouseout", handleMouseOut, true);
  document.addEventListener("click", handleClickCapture, true);
  document.addEventListener("dragstart", handleDragStart, true);
  document.addEventListener("dragover", handleDragOver, true);
  document.addEventListener("drop", handleDrop, true);
  document.addEventListener("dragend", handleDragEnd, true);

  return Object.freeze({
    isActive: () => active,
    setActive,
    toggle
  });
}
