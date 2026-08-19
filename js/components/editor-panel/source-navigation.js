import { createIcon } from "../../ui/icons.js";

const FIND_DEBOUNCE_MS = 120;

function isInteractiveTarget(target) {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest("input, textarea, select, button, [contenteditable]:not([contenteditable='false'])"));
}

function createControlButton({ id, label, title, icon, text, pressed = null }) {
  const button = document.createElement("button");
  button.id = id;
  button.className = "source-navigation__button";
  button.type = "button";
  button.title = title;
  button.setAttribute("aria-label", label);
  if (pressed !== null) {
    button.classList.add("source-navigation__toggle");
    button.setAttribute("aria-pressed", String(pressed));
  }
  if (icon) button.append(createIcon(icon));
  else button.textContent = text;
  return button;
}

function createNavigationWidgets(host) {
  const findWidget = document.createElement("section");
  const findInput = document.createElement("input");
  const findCount = document.createElement("output");
  const matchCaseButton = createControlButton({
    id: "sourceFindMatchCaseBtn",
    label: "Match case",
    title: "Match Case (Alt+C)",
    text: "Aa",
    pressed: false
  });
  const wholeWordButton = createControlButton({
    id: "sourceFindWholeWordBtn",
    label: "Match whole word",
    title: "Match Whole Word (Alt+W)",
    text: "ab",
    pressed: false
  });
  const regexButton = createControlButton({
    id: "sourceFindRegexBtn",
    label: "Use regular expression",
    title: "Use Regular Expression (Alt+R)",
    text: ".*",
    pressed: false
  });
  const previousButton = createControlButton({
    id: "sourceFindPreviousBtn",
    label: "Previous match",
    title: "Previous Match (Shift+F3)",
    icon: "arrow-left"
  });
  const nextButton = createControlButton({
    id: "sourceFindNextBtn",
    label: "Next match",
    title: "Next Match (F3)",
    icon: "arrow-right"
  });
  const findCloseButton = createControlButton({
    id: "sourceFindCloseBtn",
    label: "Close find",
    title: "Close (Escape)",
    icon: "close"
  });

  findWidget.id = "sourceFindWidget";
  findWidget.className = "source-navigation source-navigation--find";
  findWidget.setAttribute("role", "search");
  findWidget.setAttribute("aria-label", "Find in source");
  findWidget.hidden = true;

  findInput.id = "sourceFindInput";
  findInput.className = "source-navigation__input";
  findInput.type = "search";
  findInput.autocomplete = "off";
  findInput.spellcheck = false;
  findInput.placeholder = "Find";
  findInput.setAttribute("aria-label", "Find");
  findInput.setAttribute("aria-controls", "sourceContent");
  findInput.setAttribute("aria-describedby", "sourceFindMatchCount");

  findCount.id = "sourceFindMatchCount";
  findCount.className = "source-navigation__count";
  findCount.setAttribute("aria-live", "polite");

  const findOptions = document.createElement("div");
  findOptions.className = "source-navigation__options";
  findOptions.append(matchCaseButton, wholeWordButton, regexButton);
  findWidget.append(
    findInput,
    findOptions,
    findCount,
    previousButton,
    nextButton,
    findCloseButton
  );

  const goToWidget = document.createElement("section");
  const goToLabel = document.createElement("label");
  const goToInput = document.createElement("input");
  const goToHint = document.createElement("output");
  const goToCloseButton = createControlButton({
    id: "sourceGoToCloseBtn",
    label: "Close go to line",
    title: "Close (Escape)",
    icon: "close"
  });

  goToWidget.id = "sourceGoToWidget";
  goToWidget.className = "source-navigation source-navigation--goto";
  goToWidget.setAttribute("role", "dialog");
  goToWidget.setAttribute("aria-modal", "false");
  goToWidget.setAttribute("aria-labelledby", "sourceGoToLabel");
  goToWidget.hidden = true;

  goToLabel.id = "sourceGoToLabel";
  goToLabel.className = "source-navigation__label";
  goToLabel.htmlFor = "sourceGoToInput";
  goToLabel.textContent = "Go to Line/Column";

  goToInput.id = "sourceGoToInput";
  goToInput.className = "source-navigation__input source-navigation__input--goto";
  goToInput.type = "text";
  goToInput.autocomplete = "off";
  goToInput.spellcheck = false;
  goToInput.placeholder = ":line[:column]";
  goToInput.setAttribute("aria-describedby", "sourceGoToHint");

  goToHint.id = "sourceGoToHint";
  goToHint.className = "source-navigation__hint";
  goToHint.setAttribute("aria-live", "polite");
  goToHint.textContent = "Type :line or :line:column";

  goToWidget.append(goToLabel, goToInput, goToHint, goToCloseButton);
  host.append(findWidget, goToWidget);

  return Object.freeze({
    findWidget,
    findInput,
    findCount,
    matchCaseButton,
    wholeWordButton,
    regexButton,
    previousButton,
    nextButton,
    findCloseButton,
    goToWidget,
    goToInput,
    goToHint,
    goToCloseButton
  });
}

export function parseSourceLocation(value) {
  const match = String(value ?? "").trim().match(/^:?\s*(\d+)(?:\s*[: ,]\s*(\d+))?$/);
  if (!match) return null;
  return {
    line: Number.parseInt(match[1], 10),
    column: match[2] ? Number.parseInt(match[2], 10) : 1
  };
}

export function bindSourceNavigation({ host, viewport, isSourceActive, getActiveFile, onStatus }) {
  const controls = createNavigationWidgets(host);
  const options = {
    matchCase: false,
    wholeWord: false,
    useRegex: false
  };
  let query = "";
  let matches = [];
  let activeIndex = -1;
  let truncated = false;
  let searchGeneration = 0;
  let searchTimer = 0;
  let returnFocus = null;

  function isOwnControl(target) {
    return controls.findWidget.contains(target) || controls.goToWidget.contains(target);
  }

  function captureReturnFocus() {
    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLElement && !isOwnControl(activeElement)) {
      returnFocus = activeElement;
    }
  }

  function setFindError(message = "") {
    controls.findWidget.classList.toggle("has-error", Boolean(message));
    controls.findInput.setAttribute("aria-invalid", String(Boolean(message)));
    if (message) controls.findCount.textContent = message;
  }

  function updateFindControls() {
    const hasMatches = matches.length > 0;
    controls.previousButton.disabled = !hasMatches;
    controls.nextButton.disabled = !hasMatches;

    if (controls.findWidget.classList.contains("has-error")) return;
    if (!query) {
      controls.findCount.textContent = "";
      onStatus?.("");
      return;
    }
    if (!hasMatches) {
      controls.findCount.textContent = "No results";
      onStatus?.("0 matches");
      return;
    }

    const total = truncated ? matches.length + "+" : String(matches.length);
    controls.findCount.textContent = (activeIndex + 1) + " of " + total;
    onStatus?.((activeIndex + 1) + "/" + total + " matches");
  }

  function goToMatch(index) {
    if (matches.length === 0) return null;
    activeIndex = (index + matches.length) % matches.length;
    const match = viewport.setActiveSearchIndex(activeIndex);
    if (!match) return null;
    viewport.goToLocation(match.line + 1, match.column + 1);
    updateFindControls();
    return match;
  }

  async function find(nextQuery, { navigate = true } = {}) {
    const next = String(nextQuery ?? "");
    searchGeneration += 1;
    const generation = searchGeneration;
    query = next;
    matches = [];
    activeIndex = -1;
    truncated = false;
    setFindError("");
    controls.previousButton.disabled = true;
    controls.nextButton.disabled = true;
    viewport.clearSearch();

    if (!query) {
      updateFindControls();
      return { matches, truncated };
    }
    if (!viewport.isReady()) {
      controls.findCount.textContent = "Source not ready";
      onStatus?.("Source not ready");
      return { matches, truncated };
    }

    controls.findCount.textContent = "Searching…";
    onStatus?.("Searching…");
    try {
      const result = await viewport.search(query, options);
      if (generation !== searchGeneration) return result;
      matches = result.matches;
      truncated = Boolean(result.truncated);
      activeIndex = matches.length > 0 ? 0 : -1;
      viewport.setSearchResults(matches, activeIndex);
      if (navigate && matches.length > 0) goToMatch(activeIndex);
      else updateFindControls();
      return result;
    } catch (error) {
      if (generation !== searchGeneration) return { matches: [], truncated: false };
      const message = options.useRegex ? "Invalid regex" : "Search unavailable";
      setFindError(message);
      onStatus?.(message);
      return { matches: [], truncated: false, error };
    }
  }

  function scheduleFind() {
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => {
      searchTimer = 0;
      void find(controls.findInput.value);
    }, FIND_DEBOUNCE_MS);
  }

  function setOption(name, button) {
    options[name] = !options[name];
    button.setAttribute("aria-pressed", String(options[name]));
    button.classList.toggle("is-active", options[name]);
    if (query || controls.findInput.value) void find(controls.findInput.value);
  }

  function restoreFocus() {
    if (
      returnFocus instanceof HTMLElement
      && returnFocus.isConnected
      && !returnFocus.closest("[hidden]")
    ) {
      returnFocus.focus();
    }
    returnFocus = null;
  }

  function closeGoTo({ restore = true } = {}) {
    controls.goToWidget.hidden = true;
    controls.goToWidget.classList.remove("has-error");
    if (query) updateFindControls();
    else onStatus?.("");
    if (restore) restoreFocus();
  }

  function closeFind({ clear = true, restore = true } = {}) {
    controls.findWidget.hidden = true;
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = 0;
    if (clear) {
      searchGeneration += 1;
      query = "";
      matches = [];
      activeIndex = -1;
      truncated = false;
      controls.findInput.value = "";
      setFindError("");
      viewport.clearSearch();
      updateFindControls();
    }
    if (restore) restoreFocus();
  }

  function openFind() {
    if (!isSourceActive?.()) return false;
    captureReturnFocus();
    if (controls.goToWidget.hidden === false) closeGoTo({ restore: false });
    controls.findWidget.hidden = false;
    controls.findInput.value = query;
    controls.findInput.focus();
    controls.findInput.select();
    updateFindControls();
    return true;
  }

  function previewGoTo() {
    const location = parseSourceLocation(controls.goToInput.value);
    controls.goToWidget.classList.toggle("has-error", !location && Boolean(controls.goToInput.value.trim()));
    if (!location) {
      controls.goToHint.textContent = controls.goToInput.value.trim()
        ? "Use :line or :line:column"
        : "Type :line or :line:column";
      return null;
    }

    const resolved = viewport.goToLocation(location.line, location.column);
    if (!resolved) {
      controls.goToHint.textContent = "Source not ready";
      return null;
    }
    controls.goToHint.textContent = "Line " + resolved.line + ", Column " + resolved.column;
    onStatus?.("Ln " + resolved.line + ", Col " + resolved.column);
    return resolved;
  }

  function openGoTo() {
    if (!isSourceActive?.()) return false;
    captureReturnFocus();
    if (controls.findWidget.hidden === false) closeFind({ clear: false, restore: false });
    controls.goToWidget.hidden = false;
    controls.goToInput.value = ":";
    controls.goToHint.textContent = "Type :line or :line:column";
    controls.goToInput.focus();
    controls.goToInput.setSelectionRange(1, 1);
    return true;
  }

  function reset() {
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = 0;
    searchGeneration += 1;
    query = "";
    matches = [];
    activeIndex = -1;
    truncated = false;
    controls.findInput.value = "";
    controls.findWidget.hidden = true;
    controls.goToWidget.hidden = true;
    setFindError("");
    controls.previousButton.disabled = true;
    controls.nextButton.disabled = true;
    viewport.clearSearch();
    onStatus?.("");
  }

  controls.findInput.addEventListener("input", scheduleFind);
  controls.findInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    if (matches.length > 0) goToMatch(activeIndex + (event.shiftKey ? -1 : 1));
    else void find(controls.findInput.value);
  });
  controls.previousButton.addEventListener("click", () => goToMatch(activeIndex - 1));
  controls.nextButton.addEventListener("click", () => goToMatch(activeIndex + 1));
  controls.findCloseButton.addEventListener("click", () => closeFind());
  controls.matchCaseButton.addEventListener("click", () => setOption("matchCase", controls.matchCaseButton));
  controls.wholeWordButton.addEventListener("click", () => setOption("wholeWord", controls.wholeWordButton));
  controls.regexButton.addEventListener("click", () => setOption("useRegex", controls.regexButton));

  controls.goToInput.addEventListener("input", previewGoTo);
  controls.goToInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const resolved = previewGoTo();
    if (resolved) closeGoTo();
  });
  controls.goToCloseButton.addEventListener("click", () => closeGoTo());

  document.addEventListener("keydown", (event) => {
    if (!isSourceActive?.()) return;
    const commandKey = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();
    const externalInteractive = isInteractiveTarget(event.target) && !isOwnControl(event.target);

    if (commandKey && !event.altKey && key === "f" && !externalInteractive) {
      event.preventDefault();
      openFind();
      return;
    }
    if (commandKey && !event.altKey && key === "g" && !externalInteractive) {
      event.preventDefault();
      openGoTo();
      return;
    }
    if (controls.findWidget.hidden === false && event.altKey && !commandKey) {
      const toggle = {
        c: ["matchCase", controls.matchCaseButton],
        w: ["wholeWord", controls.wholeWordButton],
        r: ["useRegex", controls.regexButton]
      }[key];
      if (toggle) {
        event.preventDefault();
        setOption(toggle[0], toggle[1]);
        return;
      }
    }
    if (event.key === "F3" && !event.ctrlKey && !event.metaKey && !event.altKey && !externalInteractive) {
      if (matches.length === 0) return;
      event.preventDefault();
      goToMatch(activeIndex + (event.shiftKey ? -1 : 1));
      return;
    }
    if (event.key === "Escape") {
      if (controls.goToWidget.hidden === false) {
        event.preventDefault();
        closeGoTo();
      } else if (controls.findWidget.hidden === false) {
        event.preventDefault();
        closeFind();
      }
    }
  });

  return Object.freeze({
    find,
    next: () => goToMatch(activeIndex + 1),
    previous: () => goToMatch(activeIndex - 1),
    goTo: (line, column = 1) => viewport.goToLocation(line, column),
    openFind,
    openGoTo,
    reset,
    getState: () => ({
      query,
      matches: [...matches],
      activeIndex,
      truncated,
      options: { ...options },
      findOpen: controls.findWidget.hidden === false,
      goToOpen: controls.goToWidget.hidden === false
    })
  });
}
