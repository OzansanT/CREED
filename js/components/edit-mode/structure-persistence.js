const STRUCTURE_STORAGE_KEY = "creed.editModeStructure.v2";
const STRUCTURE_VERSION = 2;
const LEGACY_LAYOUT_STORAGE_KEY = "creed.editModeLayout.v1";
const EDIT_MODE_KEY_ATTRIBUTE = "data-edit-mode-key";
const LOCKED_SELECTOR = "[data-edit-mode-locked=\"true\"]";
const TRANSIENT_STYLE_PROPERTIES = ["outline", "outline-offset", "box-shadow", "opacity"];

function safeReadStructure() {
  try {
    const raw = localStorage.getItem(STRUCTURE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.version !== STRUCTURE_VERSION || !Array.isArray(parsed.parents)) return null;
    return parsed;
  } catch {
    return null;
  }
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
    for (const property of TRANSIENT_STYLE_PROPERTIES) node.style.removeProperty(property);
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
  for (const property of TRANSIENT_STYLE_PROPERTIES) element.style.removeProperty(property);
  return element;
}

function mutationContainsEditableNode(record) {
  const nodes = [...record.addedNodes, ...record.removedNodes];
  return nodes.some((node) => node instanceof Element && !isLockedElement(node));
}

function renameSaveControl(saveButton) {
  if (!saveButton) return;
  const label = saveButton.querySelector(".titlebar-action__label");
  if (label) label.textContent = "Save Structure";
  saveButton.title = "Save Edit Mode structure, duplicates, deletions and layout";
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
  let restoring = false;

  function markParent(parent) {
    if (!(parent instanceof Element) || isLockedElement(parent)) return;
    const key = getElementKey(parent);
    if (key) touchedParentKeys.add(key);
  }

  function captureStructure() {
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
          children.push({
            key,
            kind: "created",
            html: serializeCreatedElement(child)
          });
        }
      }

      parents.push({ parentKey, children });
    }

    return {
      version: STRUCTURE_VERSION,
      savedAt: new Date().toISOString(),
      parents
    };
  }

  function save() {
    const structure = captureStructure();
    if (!safeWriteStructure(structure)) {
      notify("Edit structure could not be saved.");
      return false;
    }

    safeRemove(LEGACY_LAYOUT_STORAGE_KEY);
    notify("Edit structure saved.");
    return true;
  }

  function restore(structure = safeReadStructure()) {
    if (!structure?.parents?.length) return false;
    restoring = true;
    let applied = false;

    try {
      const resolved = [];

      for (const record of structure.parents) {
        const parent = findElementByKey(record.parentKey);
        if (!parent || !Array.isArray(record.children)) continue;
        touchedParentKeys.add(record.parentKey);

        const children = [];
        for (const entry of record.children) {
          if (!entry?.key) continue;
          let child = findElementByKey(entry.key);
          if (!child && entry.kind === "created") {
            child = deserializeCreatedElement(entry);
          }
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
    } finally {
      restoring = false;
    }

    if (applied) {
      safeRemove(LEGACY_LAYOUT_STORAGE_KEY);
      notify("Saved edit structure restored.");
    }
    return applied;
  }

  function clear() {
    safeRemove(STRUCTURE_STORAGE_KEY);
    safeRemove(LEGACY_LAYOUT_STORAGE_KEY);
    touchedParentKeys.clear();
    return true;
  }

  const observer = new MutationObserver((records) => {
    if (restoring || !editMode.isActive()) return;
    for (const record of records) {
      if (record.type !== "childList" || !mutationContainsEditableNode(record)) continue;
      markParent(record.target);
    }
  });

  restore();
  observer.observe(document.body, { childList: true, subtree: true });

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
