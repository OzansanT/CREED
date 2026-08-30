import { createWorkspaceSearchEngine } from "../editor-panel/workspace-search.js";
import { createLanguageProviderRegistry, createWorkspaceSymbolIndex } from "../editor-panel/workspace-symbols.js";

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function checkbox(labelText) {
  const label = el("label", "toolbar");
  const input = document.createElement("input");
  input.type = "checkbox";
  label.append(input, document.createTextNode(" " + labelText));
  return { label, input };
}

function workspaceLocationCoordinate(location, zeroBasedKey, oneBasedKey) {
  const oneBased = Number(location?.[oneBasedKey]);
  if (Number.isFinite(oneBased)) return Math.max(1, Math.trunc(oneBased));
  const zeroBased = Number(location?.[zeroBasedKey]);
  return Math.max(1, Math.trunc(Number.isFinite(zeroBased) ? zeroBased : 0) + 1);
}

export function navigateToWorkspaceLocation(location, { openFile, openFileAt } = {}) {
  if (!location?.fileName) return false;
  const line = workspaceLocationCoordinate(location, "line", "lineNumber");
  const column = workspaceLocationCoordinate(location, "column", "columnNumber");
  if (typeof openFileAt === "function") return openFileAt(location.fileName, line, column) !== false;
  if (typeof openFile === "function") return openFile(location.fileName) !== false;
  return false;
}

export function bindWorkspaceSearchView({ sidebar, explorerView, workspace, openFile, openFileAt, breadcrumbName, notify }) {
  const engine = createWorkspaceSearchEngine({ workspace });
  const symbolIndex = createWorkspaceSymbolIndex({ workspace });
  const providers = createLanguageProviderRegistry();
  providers.register("*", symbolIndex.provider);

  const view = el("section", "primary-sidebar__content explorer-view panel__content");
  view.id = "workspaceSearchView";
  view.hidden = true;
  view.setAttribute("aria-label", "Workspace Search");

  const header = el("div", "explorer-view__header");
  header.append(el("strong", "", "SEARCH"));

  const searchSection = el("div", "section");
  const query = document.createElement("input");
  query.id = "workspaceSearchInput";
  query.type = "search";
  query.placeholder = "Search workspace";
  query.setAttribute("aria-label", "Search workspace");
  const replacement = document.createElement("input");
  replacement.id = "workspaceReplaceInput";
  replacement.type = "text";
  replacement.placeholder = "Replace with";
  replacement.setAttribute("aria-label", "Replace workspace matches with");
  const actions = el("div", "toolbar");
  const searchButton = el("button", "", "Search");
  searchButton.type = "button";
  const replaceButton = el("button", "", "Replace All");
  replaceButton.type = "button";
  actions.append(searchButton, replaceButton);
  const optionBar = el("div", "toolbar");
  const matchCase = checkbox("Aa");
  const wholeWord = checkbox("Word");
  const regex = checkbox("Regex");
  optionBar.append(matchCase.label, wholeWord.label, regex.label);
  const summary = el("div", "label", "No search yet");
  const results = el("div", "workspace-search__results");
  results.id = "workspaceSearchResults";
  results.setAttribute("role", "tree");
  searchSection.append(query, replacement, actions, optionBar, summary, results);

  const outlineSection = el("div", "section");
  outlineSection.append(el("span", "label", "OUTLINE"));
  const outlineRefresh = el("button", "", "Refresh active file symbols");
  outlineRefresh.type = "button";
  const outline = el("div", "workspace-search__outline");
  outline.id = "workspaceOutlineResults";
  outlineSection.append(outlineRefresh, outline);

  const symbolsSection = el("div", "section");
  symbolsSection.append(el("span", "label", "WORKSPACE SYMBOLS"));
  const symbolQuery = document.createElement("input");
  symbolQuery.id = "workspaceSymbolInput";
  symbolQuery.type = "search";
  symbolQuery.placeholder = "Go to symbol";
  symbolQuery.setAttribute("aria-label", "Go to workspace symbol");
  const symbolResults = el("div", "workspace-search__symbols");
  const references = el("div", "workspace-search__references");
  symbolsSection.append(symbolQuery, symbolResults, references);

  view.append(header, searchSection, outlineSection, symbolsSection);
  explorerView.insertAdjacentElement("afterend", view);

  function options() {
    return {
      matchCase: matchCase.input.checked,
      wholeWord: wholeWord.input.checked,
      useRegex: regex.input.checked
    };
  }

  function navigate(location) {
    return navigateToWorkspaceLocation(location, { openFile, openFileAt });
  }

  function resultButton(location, label) {
    const button = el("button", "file-row", label);
    button.type = "button";
    button.addEventListener("click", () => navigate(location));
    return button;
  }

  async function runSearch() {
    const value = query.value;
    if (!value) {
      results.replaceChildren();
      summary.textContent = "Enter a search query";
      return null;
    }
    summary.textContent = "Searching…";
    try {
      const found = await engine.search(value, options());
      const fragment = document.createDocumentFragment();
      for (const group of found.groups) {
        const section = el("section", "workspace-search__group");
        const title = el("strong", "", `${group.fileName} (${group.matches.length})`);
        section.append(title);
        for (const match of group.matches) {
          section.append(resultButton(match, `${match.lineNumber}:${match.columnNumber}  ${match.preview}`));
        }
        fragment.append(section);
      }
      results.replaceChildren(fragment);
      summary.textContent = `${found.totalMatches} matches in ${found.groups.length} files${found.truncated ? " · truncated" : ""}`;
      return found;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      summary.textContent = message;
      notify?.(message);
      return null;
    }
  }

  async function replaceAll() {
    if (!query.value) return false;
    try {
      const replaced = await engine.replaceAll(query.value, replacement.value, options());
      notify?.(`Replaced ${replaced.replacements} matches in ${replaced.filesChanged} files`);
      await symbolIndex.refresh();
      await runSearch();
      return true;
    } catch (error) {
      notify?.(error instanceof Error ? error.message : String(error));
      return false;
    }
  }

  function symbolRow(symbol, { includeReferences = true } = {}) {
    const row = el("div", "toolbar");
    const open = resultButton(symbol, `${symbol.kind} · ${symbol.name} — ${symbol.fileName}:${symbol.line + 1}`);
    row.append(open);
    if (includeReferences) {
      const refs = el("button", "", "Refs");
      refs.type = "button";
      refs.addEventListener("click", async () => {
        const found = await providers.provideReferences({ language: "*", symbol: symbol.name, matchCase: true });
        references.replaceChildren(...(found || []).map((item) => resultButton(item, `${item.fileName}:${item.lineNumber}:${item.columnNumber}  ${item.preview}`)));
      });
      const definition = el("button", "", "Definition");
      definition.type = "button";
      definition.addEventListener("click", async () => navigate(await providers.provideDefinition({ language: "*", symbol: symbol.name, fileName: symbol.fileName })));
      row.append(definition, refs);
    }
    return row;
  }

  async function refreshOutline() {
    const fileName = breadcrumbName?.textContent || "";
    if (!fileName || fileName === "Infinite Canvas" || !workspace.hasFile(fileName)) {
      outline.replaceChildren(el("span", "label", "No active source file"));
      return [];
    }
    try {
      await symbolIndex.indexFile(fileName);
      const symbols = symbolIndex.fileSymbols(fileName);
      outline.replaceChildren(...symbols.map((symbol) => symbolRow(symbol, { includeReferences: false })));
      return symbols;
    } catch (error) {
      notify?.(error instanceof Error ? error.message : String(error));
      return [];
    }
  }

  function renderWorkspaceSymbols() {
    const symbols = symbolIndex.searchSymbols(symbolQuery.value, { limit: 100 });
    symbolResults.replaceChildren(...symbols.map((symbol) => symbolRow(symbol)));
    return symbols;
  }

  searchButton.addEventListener("click", runSearch);
  query.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      runSearch();
    }
  });
  replaceButton.addEventListener("click", replaceAll);
  outlineRefresh.addEventListener("click", refreshOutline);
  symbolQuery.addEventListener("input", renderWorkspaceSymbols);

  let refreshTimer = 0;
  workspace.subscribe(() => {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(async () => {
      await symbolIndex.refresh();
      renderWorkspaceSymbols();
      if (!view.hidden) refreshOutline();
    }, 120);
  });

  symbolIndex.refresh().then(renderWorkspaceSymbols).catch(() => {});

  return Object.freeze({
    view,
    engine,
    symbolIndex,
    providers,
    runSearch,
    replaceAll,
    refreshOutline,
    setVisible(visible) {
      view.hidden = !visible;
      explorerView.hidden = Boolean(visible);
      if (visible) {
        refreshOutline();
        requestAnimationFrame(() => query.focus());
      }
    }
  });
}
