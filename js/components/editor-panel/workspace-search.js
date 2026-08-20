import { WORKSPACE_FILES } from "./source-files.js";

const SEARCHABLE_EXTENSIONS = new Set([
  "css", "html", "js", "json", "md", "mjs", "txt", "webmanifest", "yaml", "yml"
]);
const MAX_TOTAL_MATCHES = 500;
const MAX_MATCHES_PER_FILE = 100;
const SEARCH_CONCURRENCY = 6;

function getExtension(fileName) {
  const name = String(fileName || "");
  const index = name.lastIndexOf(".");
  return index === -1 ? "" : name.slice(index + 1).toLowerCase();
}

export function isWorkspaceSearchable(fileName) {
  return SEARCHABLE_EXTENSIONS.has(getExtension(fileName));
}

function createMatcher(query, { matchCase = false, useRegex = false } = {}) {
  const source = String(query || "");
  if (!source) return null;
  if (useRegex) return new RegExp(source, matchCase ? "g" : "gi");
  const escaped = source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(escaped, matchCase ? "g" : "gi");
}

export function searchTextSource(source, query, options = {}) {
  const matcher = createMatcher(query, options);
  if (!matcher) return [];
  const maxMatches = Math.max(1, Number(options.maxMatches) || MAX_MATCHES_PER_FILE);
  const matches = [];
  const lines = String(source ?? "").split(/\r?\n/);

  for (let lineIndex = 0; lineIndex < lines.length && matches.length < maxMatches; lineIndex += 1) {
    const line = lines[lineIndex];
    matcher.lastIndex = 0;
    let match;
    while ((match = matcher.exec(line)) && matches.length < maxMatches) {
      matches.push({
        line: lineIndex + 1,
        column: match.index + 1,
        preview: line
      });
      if (match[0] === "") matcher.lastIndex += 1;
    }
  }
  return matches;
}

async function defaultLoadFile(fileName, signal) {
  const response = await fetch("./" + fileName, { signal, cache: "no-store" });
  if (!response.ok) throw new Error(`Unable to load ${fileName}: HTTP ${response.status}`);
  return response.text();
}

export async function searchWorkspaceFiles({
  query,
  files = WORKSPACE_FILES,
  loadFile = defaultLoadFile,
  matchCase = false,
  useRegex = false,
  signal,
  onProgress,
  maxMatches = MAX_TOTAL_MATCHES
}) {
  const candidates = files.filter(isWorkspaceSearchable);
  const results = [];
  let nextIndex = 0;
  let completed = 0;

  createMatcher(query, { matchCase, useRegex });

  async function worker() {
    while (nextIndex < candidates.length && results.length < maxMatches) {
      if (signal?.aborted) throw new DOMException("Search aborted", "AbortError");
      const index = nextIndex;
      nextIndex += 1;
      const fileName = candidates[index];
      try {
        const source = await loadFile(fileName, signal);
        const remaining = Math.max(1, maxMatches - results.length);
        const fileMatches = searchTextSource(source, query, {
          matchCase,
          useRegex,
          maxMatches: Math.min(MAX_MATCHES_PER_FILE, remaining)
        });
        fileMatches.forEach((match) => results.push({ path: fileName, ...match }));
      } catch (error) {
        if (error?.name === "AbortError") throw error;
      } finally {
        completed += 1;
        onProgress?.({ completed, total: candidates.length, matches: results.length });
      }
    }
  }

  const workerCount = Math.min(SEARCH_CONCURRENCY, candidates.length || 1);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results.slice(0, maxMatches);
}

function createWorkspaceSearchDialog() {
  const dialog = document.createElement("dialog");
  dialog.id = "workspaceSearchDialog";
  dialog.setAttribute("aria-label", "Search workspace");

  const form = document.createElement("form");
  form.className = "panel";

  const query = document.createElement("input");
  query.id = "workspaceSearchInput";
  query.type = "search";
  query.autocomplete = "off";
  query.placeholder = "Search all workspace files";
  query.setAttribute("aria-label", "Search all workspace files");

  const options = document.createElement("div");
  options.className = "toolbar";
  const caseLabel = document.createElement("label");
  const caseInput = document.createElement("input");
  caseInput.type = "checkbox";
  caseLabel.append(caseInput, document.createTextNode(" Match case"));
  const regexLabel = document.createElement("label");
  const regexInput = document.createElement("input");
  regexInput.type = "checkbox";
  regexLabel.append(regexInput, document.createTextNode(" Regex"));
  const submit = document.createElement("button");
  submit.type = "submit";
  submit.textContent = "Search";
  options.append(caseLabel, regexLabel, submit);

  const progress = document.createElement("div");
  progress.setAttribute("role", "status");
  progress.textContent = "Enter text to search all workspace files.";

  const results = document.createElement("div");
  results.setAttribute("role", "listbox");
  results.setAttribute("aria-label", "Workspace search results");

  form.append(query, options, progress, results);
  dialog.append(form);
  document.body.append(dialog);
  return { dialog, form, query, caseInput, regexInput, progress, results };
}

export function bindWorkspaceSearch({ openFile, notify, files = WORKSPACE_FILES } = {}) {
  const ui = createWorkspaceSearchDialog();
  let controller = null;

  function close() {
    controller?.abort();
    controller = null;
    if (ui.dialog.open) ui.dialog.close();
  }

  function open() {
    if (!ui.dialog.open) ui.dialog.showModal();
    requestAnimationFrame(() => ui.query.focus());
  }

  function renderResults(matches) {
    const fragment = document.createDocumentFragment();
    for (const match of matches) {
      const button = document.createElement("button");
      button.type = "button";
      button.setAttribute("role", "option");
      button.textContent = `${match.path}:${match.line}:${match.column}  ${match.preview.trim()}`;
      button.addEventListener("click", () => {
        openFile?.(match.path, { line: match.line, column: match.column });
        close();
      });
      fragment.append(button);
    }
    if (!matches.length) {
      const empty = document.createElement("div");
      empty.textContent = "No matches found.";
      empty.setAttribute("role", "status");
      fragment.append(empty);
    }
    ui.results.replaceChildren(fragment);
  }

  async function runSearch() {
    controller?.abort();
    controller = new AbortController();
    const query = ui.query.value.trim();
    if (!query) {
      ui.results.replaceChildren();
      ui.progress.textContent = "Enter text to search all workspace files.";
      return [];
    }

    ui.progress.textContent = "Searching workspace…";
    try {
      const matches = await searchWorkspaceFiles({
        query,
        files,
        matchCase: ui.caseInput.checked,
        useRegex: ui.regexInput.checked,
        signal: controller.signal,
        onProgress: ({ completed, total, matches: count }) => {
          ui.progress.textContent = `Searching ${completed}/${total} files · ${count} matches`;
        }
      });
      ui.progress.textContent = `${matches.length} matches in ${new Set(matches.map((match) => match.path)).size} files`;
      renderResults(matches);
      return matches;
    } catch (error) {
      if (error?.name === "AbortError") return [];
      const message = error instanceof Error ? error.message : String(error);
      ui.progress.textContent = message;
      notify?.(message);
      return [];
    }
  }

  ui.form.addEventListener("submit", (event) => {
    event.preventDefault();
    runSearch();
  });
  ui.dialog.addEventListener("click", (event) => {
    if (event.target === ui.dialog) close();
  });
  window.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    if ((event.ctrlKey || event.metaKey) && event.shiftKey && !event.altKey && key === "f") {
      event.preventDefault();
      open();
    }
  });

  return Object.freeze({ open, close, runSearch });
}
