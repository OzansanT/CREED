const STRUCTURE_STORAGE_KEY = "creed.editModeStructure.v3";
const STRUCTURE_VERSION = 3;
const LEGACY_STRUCTURE_STORAGE_KEY = "creed.editModeStructure.v2";
const LEGACY_LAYOUT_STORAGE_KEY = "creed.editModeLayout.v1";
const EDIT_MODE_KEY_ATTRIBUTE = "data-edit-mode-key";
const LOCKED_SELECTOR = "[data-edit-mode-locked=\"true\"]";
const TRANSIENT_STYLE_PROPERTIES = ["outline", "outline-offset", "box-shadow", "opacity"];

function safeParseStorage(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function safeReadStructure() {
  const current = safeParseStorage(STRUCTURE_STORAGE_KEY);
  if (current?.version === STRUCTURE_VERSION && Array.isArray(current.parents) && Array.isArray(current.elements)) {
    return current;
  }

  const legacy = safeParseStorage(LEGACY_STRUCTURE_STORAGE_KEY);
  if (legacy?.version === 2 && Array.isArray(legacy.parents)) {
    return {
      version: STRUCTURE_VERSION,
      savedAt: legacy.savedAt || null,
      parents: legacy.parents,
      elements: [],
      migratedFrom: 2
    };
  }
  return null;
}

function safeWriteStructure(structure) {
  try {
    localStorage.setItem(STRUCTURE_STORAGE_KEY, JSON.stringify(structure));
    return true;
  } catch {
    return false;
  }
}

function safeRemove(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    // Storage can be unavailable in restricted browser contexts.
  }
}

function getElementKey(element) {
  return element instanceof Element ? element.getAttribute(EDIT_MODE_KEY_ATTRIBUTE) : null;
}

function findElementByKey(key) {
  if (!key) return null;
  if (getElementKey(document.body) === key) return document.body;
  return [...document.querySelectorAll(`[${EDIT_MODE_KEY_ATTRIBUTE}]`)]
    .find((element) => getElementKey(element) === key) || null;
}

function isLockedElement(element) {
  return element instanceof Element && Boolean(element.closest(LOCKED_SELECTOR));
}

function captureBaseline() {
  const keys = new Set();
  const childrenByParentKey = new Map();
  const elements = [document.body, ...document.body.querySelectorAll("*")];

  for (const element of elements) {
    const key = getElementKey(element);
    if (!key) continue;
    keys.add(key);
    childrenByParentKey.set(
      key,
      [...element.children].map(getElementKey).filter(Boolean)
    );
  }

  return { keys, childrenByParentKey };
}

function cleanSnapshotElement(element) {
  const clone = element.cloneNode(true);
  const nodes = [clone, ...clone.querySelectorAll("*")];

  for (const node of nodes) {
    node.removeAttribute("draggable");
    node.removeAttribute("aria-grabbed");
    for (const property of TRANSIENT_STYLE_PROPERTIES) node.style?.removeProperty(property);
  }

  return clone;
}

function serializeCreatedElement(element) {
  return cleanSnapshotElement(element).outerHTML;
}

function deserializeCreatedElement(entry) {
  if (!entry?.html || !entry.key) return null;
  const template = document.createElement("template");
  template.innerHTML = entry.html.trim();
  const element = template.content.firstElementChild;
  if (!element) return null;

  element.setAttribute(EDIT_MODE_KEY_ATTRIBUTE, entry.key);
  element.removeAttribute("draggable");
  for (const property of TRANSIENT_STYLE_PROPERTIES) element.style?.removeProperty(property);
  return element;
}

function mutationContainsEditableElement(record) {
  const nodes = [...record.addedNodes, ...record.removedNodes];
  return nodes.some((node) => node instanceof Element && !isLockedElement(node));
}

function mutationContainsText(record) {
  return [...record.addedNodes, ...record.removedNodes].some((node) => node.nodeType === Node.TEXT_NODE);
}

function sanitizedInlineStyle(element) {
  const clone = cleanSnapshotElement(element);
  return clone.getAttribute("style");
}

function renameSaveControl(saveButton) {
  if (!saveButton) return;
  const label = saveButton.querySelector(".titlebar-action__label");
  if (label) label.textContent = "Save Structure";
  saveButton.title = "Save Edit Mode structure, properties, duplicates, deletions and layout";
  saveButton.setAttribute("aria-label", saveButton.title);
}

export function bindEditModeStructurePersistence({
  editMode,
  resetButton,
  notify = () => {}
} = {}) {
  if (!editMode?.isActive) {
    return Object.freeze({
      save: () => false,
      restore: () => false,
      clear: () => false
    });
  }

  const saveButton = document.getElementById("editModeSaveBtn");
  renameSaveControl(saveButton);

  const baseline = captureBaseline();
  const touchedParentKeys = new Set();
  const touchedStyleKeys = new Set();
  const touchedTextKeys = new Set();
  let restoring = false;

  function markParent(parent) {
    if (!(parent instanceof Element) || isLockedElement(parent)) return;
    const key = getElementKey(parent);
    if (key) touchedParentKeys.add(key);
  }

  function markStyle(element) {
    if (!(element instanceof Element) || isLockedElement(element)) return;
    const key = getElementKey(element);
    if (key) touchedStyleKeys.add(key);
  }

  function markText(element) {
    if (!(element instanceof Element) || isLockedElement(element)) return;
    const key = getElementKey(element);
    if (key) touchedTextKeys.add(key);
  }

  function captureParents() {
    const parents = [];
    for (const parentKey of touchedParentKeys) {
      const parent = findElementByKey(parentKey);
      if (!parent?.isConnected) continue;

      const children = [];
      for (const child of parent.children) {
        const key = getElementKey(child);
        if (!key) continue;

        if (baseline.keys.has(key)) {
          children.push({ key, kind: "existing" });
        } else {
          children.push({ key, kind: "created", html: serializeCreatedElement(child) });
        }
      }
      parents.push({ parentKey, children });
    }
    return parents;
  }

  function captureElements() {
    const keys = new Set([...touchedStyleKeys, ...touchedTextKeys]);
    const elements = [];

    for (const key of keys) {
      const element = findElementByKey(key);
      if (!element?.isConnected) continue;
      const record = { key };

      if (touchedStyleKeys.has(key)) record.style = sanitizedInlineStyle(element);
      if (touchedTextKeys.has(key) && element.children.length === 0) record.text = element.textContent;
      if (Object.hasOwn(record, "style") || Object.hasOwn(record, "text")) elements.push(record);
    }
    return elements;
  }

  function captureStructure() {
    return {
      version: STRUCTURE_VERSION,
      savedAt: new Date().toISOString(),
      parents: captureParents(),
      elements: captureElements()
    };
  }

  function save() {
    const structure = captureStructure();
    if (!safeWriteStructure(structure)) {
      notify("Edit structure could not be saved.");
      return false;
    }

    safeRemove(LEGACY_STRUCTURE_STORAGE_KEY);
    safeRemove(LEGACY_LAYOUT_STORAGE_KEY);
    notify("Edit structure and properties saved.");
    return true;
  }

  function restore(structure = safeReadStructure()) {
    if (!structure || (!structure.parents?.length && !structure.elements?.length)) return false;
    restoring = true;
    let applied = false;

    try {
      const resolved = [];

      for (const record of structure.parents || []) {
        const parent = findElementByKey(record.parentKey);
        if (!parent || !Array.isArray(record.children)) continue;
        touchedParentKeys.add(record.parentKey);

        const children = [];
        for (const entry of record.children) {
          if (!entry?.key) continue;
          let child = findElementByKey(entry.key);
          if (!child && entry.kind === "created") child = deserializeCreatedElement(entry);
          if (!child || child === parent || child.contains(parent)) continue;
          children.push({ key: entry.key, element: child });
        }
        resolved.push({ parent, parentKey: record.parentKey, children });
      }

      for (const record of resolved) {
        for (const child of record.children) {
          record.parent.append(child.element);
          applied = true;
        }
      }

      for (const record of resolved) {
        const desiredKeys = new Set(record.children.map((child) => child.key));
        const baselineChildKeys = new Set(baseline.childrenByParentKey.get(record.parentKey) || []);

        for (const child of [...record.parent.children]) {
          const key = getElementKey(child);
          if (key && baselineChildKeys.has(key) && !desiredKeys.has(key)) {
            child.remove();
            applied = true;
          }
        }
      }

      for (const record of structure.elements || []) {
        const element = findElementByKey(record.key);
        if (!element) continue;

        if (Object.hasOwn(record, "style")) {
          touchedStyleKeys.add(record.key);
          if (record.style === null) element.removeAttribute("style");
          else element.setAttribute("style", record.style);
          applied = true;
        }

        if (Object.hasOwn(record, "text") && element.children.length === 0) {
          touchedTextKeys.add(record.key);
          element.textContent = String(record.text ?? "");
          applied = true;
        }
      }
    } finally {
      restoring = false;
    }

    if (applied) {
      if (structure.migratedFrom === 2) {
        safeWriteStructure({
          version: STRUCTURE_VERSION,
          savedAt: new Date().toISOString(),
          parents: structure.parents || [],
          elements: structure.elements || []
        });
      }
      safeRemove(LEGACY_STRUCTURE_STORAGE_KEY);
      safeRemove(LEGACY_LAYOUT_STORAGE_KEY);
      notify("Saved edit structure and properties restored.");
    }
    return applied;
  }

  function clear() {
    safeRemove(STRUCTURE_STORAGE_KEY);
    safeRemove(LEGACY_STRUCTURE_STORAGE_KEY);
    safeRemove(LEGACY_LAYOUT_STORAGE_KEY);
    touchedParentKeys.clear();
    touchedStyleKeys.clear();
    touchedTextKeys.clear();
    return true;
  }

  const observer = new MutationObserver((records) => {
    if (restoring || !editMode.isActive()) return;

    for (const record of records) {
      if (record.type === "attributes" && record.attributeName === "style") {
        markStyle(record.target);
        continue;
      }

      if (record.type === "characterData") {
        markText(record.target.parentElement);
        continue;
      }

      if (record.type !== "childList") continue;
      if (mutationContainsEditableElement(record)) markParent(record.target);
      if (mutationContainsText(record)) markText(record.target);
    }
  });

  restore();
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["style"],
    characterData: true
  });

  saveButton?.addEventListener("click", () => {
    save();
  });

  resetButton?.addEventListener("click", () => {
    clear();
  });

  window.addEventListener("keydown", (event) => {
    if (!editMode.isActive() || !(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "s") return;
    if (event.target instanceof Element && event.target.closest("input, textarea, [contenteditable=\"true\"]")) return;
    queueMicrotask(save);
  }, true);

  return Object.freeze({ save, restore, clear });
}
