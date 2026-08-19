function isInteractiveTarget(target) {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest("input, textarea, select, button, [contenteditable]:not([contenteditable='false'])"));
}

export function parseSourceLocation(value) {
  const match = String(value ?? "").trim().match(/^(\d+)(?:\s*[: ,]\s*(\d+))?$/);
  if (!match) return null;
  return {
    line: Number.parseInt(match[1], 10),
    column: match[2] ? Number.parseInt(match[2], 10) : 1
  };
}

export function bindSourceNavigation({ viewport, isSourceActive, getActiveFile, onStatus }) {
  let query = "";
  let matches = [];
  let activeIndex = -1;
  let truncated = false;
  let searchGeneration = 0;

  function updateStatus() {
    if (!query) return onStatus?.("");
    if (matches.length === 0) return onStatus?.("0 matches");
    const total = truncated ? matches.length + "+" : String(matches.length);
    onStatus?.((activeIndex + 1) + "/" + total + " matches");
  }

  function goToMatch(index) {
    if (matches.length === 0) return null;
    activeIndex = (index + matches.length) % matches.length;
    const match = viewport.setActiveSearchIndex(activeIndex);
    if (!match) return null;
    viewport.goToLocation(match.line + 1, match.column + 1);
    updateStatus();
    return match;
  }

  async function find(nextQuery) {
    const next = String(nextQuery ?? "");
    searchGeneration += 1;
    const generation = searchGeneration;
    query = next;
    matches = [];
    activeIndex = -1;
    truncated = false;

    if (!query) {
      viewport.clearSearch();
      updateStatus();
      return { matches, truncated };
    }
    if (!viewport.isReady()) {
      onStatus?.("Source not ready");
      return { matches, truncated };
    }

    onStatus?.("Searching…");
    try {
      const result = await viewport.search(query, { matchCase: false });
      if (generation !== searchGeneration) return result;
      matches = result.matches;
      truncated = Boolean(result.truncated);
      activeIndex = matches.length > 0 ? 0 : -1;
      viewport.setSearchResults(matches, activeIndex);
      if (matches.length > 0) goToMatch(activeIndex);
      else updateStatus();
      return result;
    } catch {
      if (generation === searchGeneration) {
        viewport.clearSearch();
        onStatus?.("Search unavailable");
      }
      return { matches: [], truncated: false };
    }
  }

  function reset() {
    searchGeneration += 1;
    query = "";
    matches = [];
    activeIndex = -1;
    truncated = false;
    viewport.clearSearch();
    onStatus?.("");
  }

  function promptFind() {
    const fileName = getActiveFile?.() || "source";
    const next = window.prompt("Find in " + fileName, query);
    if (next !== null) void find(next);
  }

  function promptGoTo() {
    const next = window.prompt("Go to line[:column]", "1");
    if (next === null) return;
    const location = parseSourceLocation(next);
    if (!location) return onStatus?.("Invalid line:column");
    const resolved = viewport.goToLocation(location.line, location.column);
    if (resolved) onStatus?.("Ln " + resolved.line + ", Col " + resolved.column);
  }

  document.addEventListener("keydown", (event) => {
    if (!isSourceActive?.()) return;
    const interactive = isInteractiveTarget(event.target);
    const commandKey = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();

    if (commandKey && !event.altKey && key === "f" && !interactive) {
      event.preventDefault();
      promptFind();
      return;
    }
    if (commandKey && !event.altKey && key === "g" && !interactive) {
      event.preventDefault();
      promptGoTo();
      return;
    }
    if (event.key === "F3" && !event.ctrlKey && !event.metaKey && !event.altKey && !interactive) {
      if (matches.length === 0) return;
      event.preventDefault();
      goToMatch(activeIndex + (event.shiftKey ? -1 : 1));
      return;
    }
    if (event.key === "Escape" && query && !interactive) {
      event.preventDefault();
      reset();
    }
  });

  return Object.freeze({
    find,
    next: () => goToMatch(activeIndex + 1),
    previous: () => goToMatch(activeIndex - 1),
    goTo: (line, column = 1) => viewport.goToLocation(line, column),
    reset,
    getState: () => ({ query, matches: [...matches], activeIndex, truncated })
  });
}
