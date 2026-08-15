const STORAGE_KEY = "creedSettings.v1";

export const DEFAULT_SETTINGS = Object.freeze({
  theme: "system",
  locale: "en",
  reduceMotion: false,
  editorFontSize: 12,
  layoutPreset: "full",
  workspaceTrusted: false
});

function normalize(settings) {
  const source = settings && typeof settings === "object" ? settings : {};
  const theme = ["system", "light", "dark", "contrast"].includes(source.theme) ? source.theme : DEFAULT_SETTINGS.theme;
  const locale = ["en", "tr"].includes(source.locale) ? source.locale : DEFAULT_SETTINGS.locale;
  const fontSize = Math.min(20, Math.max(10, Math.round(Number(source.editorFontSize) || DEFAULT_SETTINGS.editorFontSize)));
  return {
    theme,
    locale,
    reduceMotion: source.reduceMotion === true,
    editorFontSize: fontSize,
    layoutPreset: ["full", "canvas", "code", "compact"].includes(source.layoutPreset) ? source.layoutPreset : DEFAULT_SETTINGS.layoutPreset,
    workspaceTrusted: source.workspaceTrusted === true
  };
}

function loadLocalSettings() {
  try {
    return normalize(JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveLocalSettings(settings) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch { /* IndexedDB remains available. */ }
}

export function createSettingsStore(initial = loadLocalSettings()) {
  let settings = normalize(initial);
  const listeners = new Set();

  function apply() {
    document.documentElement.dataset.theme = settings.theme;
    document.documentElement.lang = settings.locale;
    document.documentElement.classList.toggle("reduce-motion", settings.reduceMotion);
    document.documentElement.style.setProperty("--editor-font-size", settings.editorFontSize + "px");
  }

  function emit() {
    saveLocalSettings(settings);
    apply();
    listeners.forEach((listener) => listener({ ...settings }));
  }

  apply();
  return Object.freeze({
    get: () => ({ ...settings }),
    set(patch) {
      settings = normalize({ ...settings, ...(patch || {}) });
      emit();
      return { ...settings };
    },
    replace(next) {
      settings = normalize(next);
      emit();
      return { ...settings };
    },
    reset() {
      settings = { ...DEFAULT_SETTINGS };
      emit();
      return { ...settings };
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  });
}
