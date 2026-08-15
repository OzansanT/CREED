import {
  LEGACY_PANEL_LAYOUT_STORAGE_KEY,
  LEGACY_STATE_STORAGE_KEYS,
  PANEL_LAYOUT_STORAGE_KEY,
  STATE_SAVE_DELAY,
  STORAGE_KEY
} from "./config.js";
import { normalizeCreedDocument, serializeCreedDocument } from "./creed-document.js";
import { replaceState, state } from "./state.js";

let stateSaveTimer = 0;
let pendingStorage = null;

function getDefaultStorage() {
  return globalThis.localStorage;
}

function safeGetItem(storage, key) {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function safeSetItem(storage, key, value) {
  try {
    storage?.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function safeRemoveItem(storage, key) {
  try {
    storage?.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

function parseStoredJson(storage, key) {
  const raw = safeGetItem(storage, key);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    return value && typeof value === "object" ? value : null;
  } catch {
    return null;
  }
}

export function saveState(storage = getDefaultStorage()) {
  try {
    state.updatedAt = new Date().toISOString();
    const payload = JSON.stringify(serializeCreedDocument(state));
    return safeSetItem(storage, STORAGE_KEY, payload);
  } catch {
    return false;
  }
}

export function queueStateSave(delay = STATE_SAVE_DELAY, storage = getDefaultStorage()) {
  pendingStorage = storage;
  globalThis.clearTimeout(stateSaveTimer);
  stateSaveTimer = globalThis.setTimeout(() => {
    stateSaveTimer = 0;
    saveState(pendingStorage);
    pendingStorage = null;
  }, delay);
}

export function flushStateSave(storage = pendingStorage || getDefaultStorage()) {
  globalThis.clearTimeout(stateSaveTimer);
  stateSaveTimer = 0;
  pendingStorage = null;
  return saveState(storage);
}

export function loadState(storage = getDefaultStorage()) {
  const keys = [STORAGE_KEY, ...LEGACY_STATE_STORAGE_KEYS];
  for (const key of keys) {
    const saved = parseStoredJson(storage, key);
    if (!saved) continue;
    replaceState(normalizeCreedDocument(saved));
    if (key !== STORAGE_KEY && saveState(storage)) safeRemoveItem(storage, key);
    return true;
  }
  return false;
}

export function clearStoredState(storage = getDefaultStorage()) {
  globalThis.clearTimeout(stateSaveTimer);
  stateSaveTimer = 0;
  pendingStorage = null;
  const results = [
    safeRemoveItem(storage, STORAGE_KEY),
    ...LEGACY_STATE_STORAGE_KEYS.map((key) => safeRemoveItem(storage, key))
  ];
  return results.every(Boolean);
}

function normalizePanelDimensions(saved) {
  if (!saved) return null;
  const layout = {
    primaryWidth: Math.round(Number(saved.primaryWidth)),
    secondaryWidth: Math.round(Number(saved.secondaryWidth)),
    terminalHeight: Math.round(Number(saved.terminalHeight))
  };
  return Object.values(layout).every((value) => Number.isFinite(value) && value > 0)
    ? layout
    : null;
}

export function savePanelLayout(layoutState, storage = getDefaultStorage()) {
  const dimensions = normalizePanelDimensions(layoutState);
  const visibility = {
    primaryVisible: layoutState?.primaryVisible,
    secondaryVisible: layoutState?.secondaryVisible,
    terminalVisible: layoutState?.terminalVisible
  };
  if (!dimensions || !Object.values(visibility).every((value) => typeof value === "boolean")) {
    return false;
  }
  const saved = safeSetItem(storage, PANEL_LAYOUT_STORAGE_KEY, JSON.stringify({
    ...dimensions,
    ...visibility
  }));
  if (saved) safeRemoveItem(storage, LEGACY_PANEL_LAYOUT_STORAGE_KEY);
  return saved;
}

export function loadPanelLayout(storage = getDefaultStorage()) {
  const saved = parseStoredJson(storage, PANEL_LAYOUT_STORAGE_KEY);
  const dimensions = normalizePanelDimensions(saved);
  const visibility = {
    primaryVisible: saved?.primaryVisible,
    secondaryVisible: saved?.secondaryVisible,
    terminalVisible: saved?.terminalVisible
  };
  if (dimensions && Object.values(visibility).every((value) => typeof value === "boolean")) {
    return { ...dimensions, ...visibility };
  }

  const legacyDimensions = normalizePanelDimensions(
    parseStoredJson(storage, LEGACY_PANEL_LAYOUT_STORAGE_KEY)
  );
  if (!legacyDimensions) return null;
  const migrated = {
    ...legacyDimensions,
    primaryVisible: true,
    secondaryVisible: true,
    terminalVisible: true
  };
  savePanelLayout(migrated, storage);
  return migrated;
}

export function clearPanelLayout(storage = getDefaultStorage()) {
  return [
    safeRemoveItem(storage, PANEL_LAYOUT_STORAGE_KEY),
    safeRemoveItem(storage, LEGACY_PANEL_LAYOUT_STORAGE_KEY)
  ].every(Boolean);
}
