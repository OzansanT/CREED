import { EDITOR_BUFFER_STORAGE_KEY } from "../../core/config.js";

export const EDITOR_BUFFER_SCHEMA_VERSION = 1;
const MAX_UNDO_ENTRIES = 100;
const MAX_UNDO_CHARACTERS = 2_000_000;

function createMemoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key)
  };
}

function getDefaultStorage() {
  return typeof localStorage === "undefined" ? createMemoryStorage() : localStorage;
}

function normalizePersisted(value) {
  if (!value || typeof value !== "object" || value.version !== EDITOR_BUFFER_SCHEMA_VERSION) {
    return { version: EDITOR_BUFFER_SCHEMA_VERSION, buffers: {} };
  }
  const buffers = {};
  for (const [fileName, state] of Object.entries(value.buffers || {})) {
    if (!fileName || !state || typeof state !== "object") continue;
    if (typeof state.text !== "string" || typeof state.savedText !== "string") continue;
    buffers[fileName] = { text: state.text, savedText: state.savedText };
  }
  return { version: EDITOR_BUFFER_SCHEMA_VERSION, buffers };
}

function trimUndoStack(stack) {
  while (stack.length > MAX_UNDO_ENTRIES) stack.shift();
  let total = stack.reduce((sum, value) => sum + value.length, 0);
  while (stack.length > 1 && total > MAX_UNDO_CHARACTERS) {
    total -= stack[0].length;
    stack.shift();
  }
}

export function createEditorBufferStore({ storage = getDefaultStorage() } = {}) {
  const records = new Map();
  let restored;
  try {
    restored = normalizePersisted(JSON.parse(storage.getItem(EDITOR_BUFFER_STORAGE_KEY)));
  } catch {
    restored = normalizePersisted(null);
  }
  const restoredBuffers = new Map(Object.entries(restored.buffers));

  function persist() {
    const buffers = {};
    for (const [fileName, record] of records) {
      if (record.text !== record.savedText) {
        buffers[fileName] = { text: record.text, savedText: record.savedText };
      }
    }
    for (const [fileName, record] of restoredBuffers) {
      if (!records.has(fileName) && record.text !== record.savedText) buffers[fileName] = record;
    }
    try {
      if (Object.keys(buffers).length) {
        storage.setItem(EDITOR_BUFFER_STORAGE_KEY, JSON.stringify({ version: EDITOR_BUFFER_SCHEMA_VERSION, buffers }));
      } else {
        storage.removeItem(EDITOR_BUFFER_STORAGE_KEY);
      }
      return true;
    } catch {
      return false;
    }
  }

  function createRecord(source, restoredRecord = null) {
    const savedText = source;
    const text = restoredRecord && restoredRecord.text !== restoredRecord.savedText
      ? restoredRecord.text
      : source;
    return { text, savedText, undo: [], redo: [] };
  }

  function open(fileName, source) {
    if (!fileName || typeof source !== "string") throw new TypeError("Buffer open requires file name and source text.");
    const existing = records.get(fileName);
    if (existing) return existing.text;
    const restoredRecord = restoredBuffers.get(fileName) || null;
    restoredBuffers.delete(fileName);
    const record = createRecord(source, restoredRecord);
    records.set(fileName, record);
    persist();
    return record.text;
  }

  function requireRecord(fileName) {
    const record = records.get(fileName);
    if (!record) throw new Error("Editor buffer is not open: " + fileName);
    return record;
  }

  function setText(fileName, text, { recordHistory = true } = {}) {
    if (typeof text !== "string") throw new TypeError("Editor buffer text must be a string.");
    const record = requireRecord(fileName);
    if (record.text === text) return false;
    if (recordHistory) {
      record.undo.push(record.text);
      trimUndoStack(record.undo);
      record.redo.length = 0;
    }
    record.text = text;
    persist();
    return true;
  }

  function undo(fileName) {
    const record = requireRecord(fileName);
    const previous = record.undo.pop();
    if (previous == null) return null;
    record.redo.push(record.text);
    trimUndoStack(record.redo);
    record.text = previous;
    persist();
    return record.text;
  }

  function redo(fileName) {
    const record = requireRecord(fileName);
    const next = record.redo.pop();
    if (next == null) return null;
    record.undo.push(record.text);
    trimUndoStack(record.undo);
    record.text = next;
    persist();
    return record.text;
  }

  function markSaved(fileName) {
    const record = requireRecord(fileName);
    record.savedText = record.text;
    persist();
    return record.text;
  }

  function revert(fileName, savedText) {
    if (typeof savedText !== "string") throw new TypeError("Saved source must be a string.");
    const record = records.get(fileName) || createRecord(savedText);
    record.text = savedText;
    record.savedText = savedText;
    record.undo.length = 0;
    record.redo.length = 0;
    records.set(fileName, record);
    restoredBuffers.delete(fileName);
    persist();
    return savedText;
  }

  function rename(oldName, newName) {
    if (records.has(oldName)) {
      records.set(newName, records.get(oldName));
      records.delete(oldName);
    }
    if (restoredBuffers.has(oldName)) {
      restoredBuffers.set(newName, restoredBuffers.get(oldName));
      restoredBuffers.delete(oldName);
    }
    persist();
  }

  function remove(fileName, { discardDirty = false } = {}) {
    const record = records.get(fileName);
    if (record && !discardDirty && record.text !== record.savedText) {
      restoredBuffers.set(fileName, { text: record.text, savedText: record.savedText });
    } else {
      restoredBuffers.delete(fileName);
    }
    records.delete(fileName);
    persist();
  }

  function dirtyFiles() {
    const dirty = new Set();
    for (const [fileName, record] of records) {
      if (record.text !== record.savedText) dirty.add(fileName);
    }
    for (const [fileName, record] of restoredBuffers) {
      if (record.text !== record.savedText) dirty.add(fileName);
    }
    return [...dirty].sort((left, right) => left.localeCompare(right));
  }

  return Object.freeze({
    open,
    setText,
    undo,
    redo,
    markSaved,
    revert,
    rename,
    remove,
    persist,
    getText: (fileName) => records.get(fileName)?.text ?? restoredBuffers.get(fileName)?.text ?? null,
    getSavedText: (fileName) => records.get(fileName)?.savedText ?? restoredBuffers.get(fileName)?.savedText ?? null,
    isDirty: (fileName) => {
      const record = records.get(fileName) || restoredBuffers.get(fileName);
      return Boolean(record && record.text !== record.savedText);
    },
    dirtyFiles,
    has: (fileName) => records.has(fileName) || restoredBuffers.has(fileName),
    clear() {
      records.clear();
      restoredBuffers.clear();
      try { storage.removeItem(EDITOR_BUFFER_STORAGE_KEY); } catch { /* ignore */ }
    }
  });
}
