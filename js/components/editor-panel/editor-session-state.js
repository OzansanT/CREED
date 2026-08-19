const DEFAULT_VIEWPORT_STATE = Object.freeze({ scrollTop: 0, scrollLeft: 0 });
const DEFAULT_FIND_OPTIONS = Object.freeze({
  matchCase: false,
  wholeWord: false,
  useRegex: false
});

function toNonNegativeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : fallback;
}

function normalizeLocation(value) {
  if (!value || typeof value !== "object") return null;
  const line = Math.max(1, Math.trunc(Number(value.line) || 1));
  const column = Math.max(1, Math.trunc(Number(value.column) || 1));
  return { line, column };
}

export function normalizeEditorSessionState(state = {}) {
  const viewport = state.viewport && typeof state.viewport === "object" ? state.viewport : {};
  const navigation = state.navigation && typeof state.navigation === "object" ? state.navigation : {};
  const navigationOptions = navigation.options && typeof navigation.options === "object"
    ? navigation.options
    : {};
  const goToOpen = Boolean(navigation.goToOpen);
  const activeIndex = Number.isInteger(navigation.activeIndex)
    ? Math.max(-1, navigation.activeIndex)
    : -1;

  return {
    viewport: {
      scrollTop: toNonNegativeNumber(viewport.scrollTop, DEFAULT_VIEWPORT_STATE.scrollTop),
      scrollLeft: toNonNegativeNumber(viewport.scrollLeft, DEFAULT_VIEWPORT_STATE.scrollLeft)
    },
    navigation: {
      query: typeof navigation.query === "string" ? navigation.query : "",
      activeIndex,
      options: {
        matchCase: Boolean(navigationOptions.matchCase ?? DEFAULT_FIND_OPTIONS.matchCase),
        wholeWord: Boolean(navigationOptions.wholeWord ?? DEFAULT_FIND_OPTIONS.wholeWord),
        useRegex: Boolean(navigationOptions.useRegex ?? DEFAULT_FIND_OPTIONS.useRegex)
      },
      findOpen: goToOpen ? false : Boolean(navigation.findOpen),
      goToOpen,
      lastGoTo: normalizeLocation(navigation.lastGoTo)
    }
  };
}

export function createEditorSessionStore() {
  const sessions = new Map();

  function save(fileName, state) {
    if (!fileName) return null;
    const normalized = normalizeEditorSessionState(state);
    sessions.set(fileName, normalized);
    return normalizeEditorSessionState(normalized);
  }

  function get(fileName) {
    const state = sessions.get(fileName);
    return state ? normalizeEditorSessionState(state) : null;
  }

  function remove(fileName) {
    return sessions.delete(fileName);
  }

  return Object.freeze({
    save,
    get,
    remove,
    has: (fileName) => sessions.has(fileName),
    clear: () => sessions.clear(),
    size: () => sessions.size
  });
}
