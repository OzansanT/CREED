function element(tag, className, text = "") {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

export function createWorkspaceSearchView({ store, openFile, notify }) {
  return function renderWorkspaceSearch(container) {
    const section = element("div", "activity-section");
    const title = element("h2", "", "Search workspace");
    const form = element("form", "activity-form activity-form--column");
    const query = element("input", "activity-input");
    query.type = "search";
    query.placeholder = "Search all files";
    query.setAttribute("aria-label", "Search all workspace files");
    const replacement = element("input", "activity-input");
    replacement.type = "text";
    replacement.placeholder = "Replace with";
    replacement.setAttribute("aria-label", "Replacement text");
    const options = element("div", "activity-actions");
    const caseLabel = element("label", "");
    const caseInput = element("input", "");
    caseInput.type = "checkbox";
    caseLabel.append(caseInput, document.createTextNode(" Match case"));
    const regexLabel = element("label", "");
    const regexInput = element("input", "");
    regexInput.type = "checkbox";
    regexLabel.append(regexInput, document.createTextNode(" Regex"));
    options.append(caseLabel, regexLabel);
    const actions = element("div", "activity-actions");
    const searchButton = element("button", "primary", "Search");
    searchButton.type = "submit";
    const replaceButton = element("button", "", "Replace all");
    replaceButton.type = "button";
    actions.append(searchButton, replaceButton);
    form.append(query, replacement, options, actions);
    const progress = element("div", "activity-progress", "Enter text to search all workspace files.");
    const results = element("div", "result-list");
    section.append(title, form, progress, results);
    container.replaceChildren(section);
    let controller = null;

    async function runSearch() {
      controller?.abort();
      controller = new AbortController();
      const needle = query.value;
      if (!needle) {
        results.replaceChildren();
        progress.textContent = "Enter text to search all workspace files.";
        return [];
      }
      progress.textContent = "Loading workspace…";
      try {
        const matches = await store.search(needle, {
          caseSensitive: caseInput.checked,
          useRegex: regexInput.checked,
          signal: controller.signal,
          onProgress: ({ completed, total }) => { progress.textContent = `Loading ${completed}/${total} files…`; }
        });
        progress.textContent = `${matches.length} match${matches.length === 1 ? "" : "es"} in ${new Set(matches.map((match) => match.path)).size} files`;
        const fragment = document.createDocumentFragment();
        matches.forEach((match) => {
          const button = element("button", "result-item");
          button.type = "button";
          const heading = element("strong", "", `${match.path}:${match.line}:${match.column}`);
          const preview = element("code", "", match.preview.trim() || " ");
          button.append(heading, preview);
          button.addEventListener("click", () => openFile(match.path, { line: match.line, column: match.column }));
          fragment.append(button);
        });
        if (!matches.length) fragment.append(element("div", "activity-empty", "No matches found."));
        results.replaceChildren(fragment);
        return matches;
      } catch (error) {
        if (error.name === "AbortError") return [];
        progress.textContent = error.message;
        notify?.(error.message);
        return [];
      }
    }

    form.addEventListener("submit", (event) => { event.preventDefault(); runSearch(); });
    replaceButton.addEventListener("click", async () => {
      if (!query.value) return;
      const matches = await runSearch();
      if (!matches.length) return;
      if (!window.confirm(`Replace ${matches.length} matches across the browser workspace?`)) return;
      try {
        const summary = await store.replaceAll(query.value, replacement.value, {
          caseSensitive: caseInput.checked,
          useRegex: regexInput.checked
        });
        notify?.(`Replaced ${summary.replacements} matches in ${summary.files} files`);
        await runSearch();
      } catch (error) {
        notify?.(error.message);
      }
    });
    requestAnimationFrame(() => query.focus());
    return () => controller?.abort();
  };
}
