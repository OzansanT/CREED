export const UNIFIED_WORKSPACE_STATE_SCHEMA_VERSION = 1;
export const UNIFIED_WORKSPACE_STATE_KEY = "creedUnifiedWorkspaceState.v1";

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key)
  };
}

function defaultStorage() {
  return typeof localStorage === "undefined" ? memoryStorage() : localStorage;
}

function normalizeEnvelope(value) {
  if (!value || typeof value !== "object") return null;
  if (value.version === 1 && value.sections && typeof value.sections === "object") {
    return {
      version: 1,
      savedAt: Number(value.savedAt) || 0,
      sections: Object.fromEntries(Object.entries(value.sections).filter(([, raw]) => typeof raw === "string"))
    };
  }
  if (value.version === 0 && value.state && typeof value.state === "object") {
    return {
      version: 1,
      savedAt: Number(value.savedAt) || 0,
      sections: Object.fromEntries(Object.entries(value.state).filter(([, raw]) => typeof raw === "string"))
    };
  }
  return null;
}

export function createUnifiedWorkspaceState({ storage = defaultStorage(), keys = [], now = () => Date.now() } = {}) {
  const managedKeys = [...new Set(keys.filter((key) => typeof key === "string" && key && key !== UNIFIED_WORKSPACE_STATE_KEY))];

  function load() {
    try {
      return normalizeEnvelope(JSON.parse(storage.getItem(UNIFIED_WORKSPACE_STATE_KEY)));
    } catch {
      return null;
    }
  }

  function restoreMissing() {
    const envelope = load();
    if (!envelope) return 0;
    let restored = 0;
    for (const key of managedKeys) {
      if (storage.getItem(key) !== null) continue;
      const raw = envelope.sections[key];
      if (typeof raw !== "string") continue;
      try {
        storage.setItem(key, raw);
        restored += 1;
      } catch { /* quota/security failure: keep remaining state intact */ }
    }
    return restored;
  }

  function snapshot() {
    const sections = {};
    for (const key of managedKeys) {
      try {
        const raw = storage.getItem(key);
        if (raw !== null) sections[key] = raw;
      } catch { /* ignore unreadable legacy section */ }
    }
    const envelope = { version: UNIFIED_WORKSPACE_STATE_SCHEMA_VERSION, savedAt: now(), sections };
    try {
      storage.setItem(UNIFIED_WORKSPACE_STATE_KEY, JSON.stringify(envelope));
      return envelope;
    } catch {
      return null;
    }
  }

  function bindLifecycle(target = typeof window === "undefined" ? null : window) {
    if (!target?.addEventListener) return () => {};
    const save = () => snapshot();
    target.addEventListener("pagehide", save);
    const visibility = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") save();
    };
    if (typeof document !== "undefined") document.addEventListener("visibilitychange", visibility);
    return () => {
      target.removeEventListener("pagehide", save);
      if (typeof document !== "undefined") document.removeEventListener("visibilitychange", visibility);
    };
  }

  return Object.freeze({
    schemaVersion: UNIFIED_WORKSPACE_STATE_SCHEMA_VERSION,
    key: UNIFIED_WORKSPACE_STATE_KEY,
    managedKeys: () => [...managedKeys],
    load,
    restoreMissing,
    snapshot,
    bindLifecycle
  });
}
