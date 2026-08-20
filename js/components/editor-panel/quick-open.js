import { WORKSPACE_FILES } from "./source-files.js";

const DEFAULT_LIMIT = 80;

function normalizeQuery(value) {
  return String(value || "").trim().toLowerCase();
}

function fileScore(fileName, query) {
  if (!query) return 0;
  const path = fileName.toLowerCase();
  const name = path.split("/").at(-1) || path;
  if (name === query) return 0;
  if (name.startsWith(query)) return 1;
  if (path.startsWith(query)) return 2;
  const index = path.indexOf(query);
  return index === -1 ? Number.POSITIVE_INFINITY : 3 + index / Math.max(1, path.length);
}

export function rankQuickOpenFiles(query, files = WORKSPACE_FILES, limit = DEFAULT_LIMIT) {
  const normalized = normalizeQuery(query);
  return files
    .map((fileName, index) => ({ fileName, index, score: fileScore(fileName, normalized) }))
    .filter((entry) => Number.isFinite(entry.score))
    .sort((left, right) => left.score - right.score || left.index - right.index)
    .slice(0, limit)
    .map((entry) => entry.fileName);
}

function createQuickOpenDialog() {
  const dialog = document.createElement("dialog");
  dialog.id = "quickOpenDialog";
  dialog.setAttribute("aria-label", "Quick Open");

  const shell = document.createElement("div");
  shell.className = "panel";

  const input = document.createElement("input");
  input.id = "quickOpenInput";
  input.type = "search";
  input.autocomplete = "off";
  input.spellcheck = false;
  input.placeholder = "Search files by name or path";
  input.setAttribute("aria-label", "Search workspace files");
  input.setAttribute("aria-controls", "quickOpenResults");
  input.setAttribute("aria-autocomplete", "list");

  const results = document.createElement("div");
  results.id = "quickOpenResults";
  results.setAttribute("role", "listbox");
  results.setAttribute("aria-label", "Matching workspace files");

  shell.append(input, results);
  dialog.append(shell);
  document.body.append(dialog);
  return { dialog, input, results };
}

export function bindQuickOpen({ openFile, notify, files = WORKSPACE_FILES } = {}) {
  const { dialog, input, results } = createQuickOpenDialog();
  let entries = [];
  let selectedIndex = 0;

  function close() {
    if (dialog.open) dialog.close();
  }

  function updateSelection() {
    const buttons = [...results.querySelectorAll("button[data-quick-open-file]")];
    buttons.forEach((button, index) => {
      const selected = index === selectedIndex;
      button.setAttribute("aria-selected", String(selected));
      button.tabIndex = selected ? 0 : -1;
    });
    buttons[selectedIndex]?.scrollIntoView({ block: "nearest" });
  }

  function render() {
    entries = rankQuickOpenFiles(input.value, files);
    selectedIndex = Math.min(selectedIndex, Math.max(0, entries.length - 1));
    const fragment = document.createDocumentFragment();

    entries.forEach((fileName, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.quickOpenFile = fileName;
      button.setAttribute("role", "option");
      button.setAttribute("aria-selected", String(index === selectedIndex));
      button.tabIndex = index === selectedIndex ? 0 : -1;
      button.textContent = fileName;
      button.addEventListener("pointermove", () => {
        selectedIndex = index;
        updateSelection();
      });
      button.addEventListener("click", () => execute(fileName));
      fragment.append(button);
    });

    if (!entries.length) {
      const empty = document.createElement("div");
      empty.textContent = "No matching workspace files.";
      empty.setAttribute("role", "status");
      fragment.append(empty);
    }

    results.replaceChildren(fragment);
  }

  function execute(fileName = entries[selectedIndex]) {
    if (!fileName) return false;
    try {
      const opened = openFile?.(fileName);
      if (opened === false) throw new Error("Unable to open " + fileName);
      close();
      return true;
    } catch (error) {
      notify?.(error instanceof Error ? error.message : String(error));
      return false;
    }
  }

  function open() {
    if (!dialog.open) dialog.showModal();
    input.value = "";
    selectedIndex = 0;
    render();
    requestAnimationFrame(() => input.focus());
  }

  input.addEventListener("input", () => {
    selectedIndex = 0;
    render();
  });

  input.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      selectedIndex = Math.min(entries.length - 1, selectedIndex + 1);
      updateSelection();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      selectedIndex = Math.max(0, selectedIndex - 1);
      updateSelection();
    } else if (event.key === "Enter") {
      event.preventDefault();
      execute();
    } else if (event.key === "Escape") {
      event.preventDefault();
      close();
    }
  });

  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) close();
  });

  window.addEventListener("keydown", (event) => {
    if (!(event.ctrlKey || event.metaKey) || event.altKey || event.key.toLowerCase() !== "p") return;
    event.preventDefault();
    open();
  });

  return Object.freeze({ open, close, render, execute });
}
