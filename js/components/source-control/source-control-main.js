import { createLineDiff, createSideBySideDiff, summarizeDiff } from "./diff-engine.js";
import { createGitProvider } from "./git-provider.js";
import { renderMergeConflictEditor } from "./merge-conflict-editor.js";

function createButton(label, title = label) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.title = title;
  return button;
}

function statusLabel(status) {
  if (status === "created") return "A";
  if (status === "deleted") return "D";
  return "M";
}

function renderInlineDiff(container, diff) {
  const rows = createLineDiff(diff.before, diff.after);
  const pre = document.createElement("pre");
  pre.className = "source-control__inline-diff";
  pre.style.margin = "0";
  pre.style.padding = "8px";
  pre.style.overflow = "auto";
  pre.style.fontSize = "11px";
  pre.textContent = rows.map((row) => {
    const prefix = row.type === "insert" ? "+" : row.type === "delete" ? "-" : " ";
    const left = row.beforeLine == null ? "" : String(row.beforeLine).padStart(4);
    const right = row.afterLine == null ? "" : String(row.afterLine).padStart(4);
    return `${prefix} ${left} ${right} │ ${row.text}`;
  }).join("\n");
  container.replaceChildren(pre);
}

function renderSideBySide(container, diff) {
  const rows = createSideBySideDiff(diff.before, diff.after);
  const grid = document.createElement("div");
  Object.assign(grid.style, {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
    gap: "1px",
    overflow: "auto",
    fontFamily: "monospace",
    fontSize: "11px"
  });
  for (const row of rows) {
    for (const side of [row.left, row.right]) {
      const line = document.createElement("div");
      line.style.whiteSpace = "pre";
      line.style.padding = "1px 4px";
      line.textContent = side
        ? `${String(side.beforeLine ?? side.afterLine ?? "").padStart(4)} │ ${side.text}`
        : "";
      if (side?.type === "insert") line.dataset.diffType = "insert";
      if (side?.type === "delete") line.dataset.diffType = "delete";
      grid.append(line);
    }
  }
  container.replaceChildren(grid);
}

export function bindSourceControl({ sidebar, workspace, openFile, notify } = {}) {
  const provider = createGitProvider({ workspace });
  const view = document.createElement("section");
  view.id = "sourceControlView";
  view.className = "primary-sidebar__content explorer-view panel__content";
  view.hidden = true;
  view.setAttribute("aria-label", "Source Control");

  const heading = document.createElement("h2");
  heading.textContent = "SOURCE CONTROL";

  const branchToolbar = document.createElement("div");
  branchToolbar.className = "toolbar";
  const branchSelect = document.createElement("select");
  branchSelect.id = "sourceControlBranchSelect";
  branchSelect.setAttribute("aria-label", "Current branch");
  const newBranchButton = createButton("+ Branch", "Create branch");
  newBranchButton.id = "createBranchBtn";
  branchToolbar.append(branchSelect, newBranchButton);

  const mergeToolbar = document.createElement("div");
  mergeToolbar.className = "toolbar";
  const mergeSelect = document.createElement("select");
  mergeSelect.id = "mergeBranchSelect";
  mergeSelect.setAttribute("aria-label", "Branch to merge");
  const mergeButton = createButton("Merge", "Merge selected branch");
  mergeButton.id = "mergeBranchBtn";
  mergeToolbar.append(mergeSelect, mergeButton);

  const commitForm = document.createElement("form");
  commitForm.className = "toolbar";
  const commitInput = document.createElement("input");
  commitInput.id = "sourceControlCommitMessage";
  commitInput.type = "text";
  commitInput.placeholder = "Commit message";
  commitInput.setAttribute("aria-label", "Commit message");
  const commitButton = createButton("Commit", "Commit staged changes");
  commitButton.id = "commitChangesBtn";
  commitForm.append(commitInput, commitButton);

  const stagedTitle = document.createElement("strong");
  stagedTitle.textContent = "STAGED CHANGES";
  const stagedList = document.createElement("div");
  stagedList.id = "stagedChangesList";

  const changesTitle = document.createElement("strong");
  changesTitle.textContent = "CHANGES";
  const changesList = document.createElement("div");
  changesList.id = "workingChangesList";

  const diffHeader = document.createElement("div");
  diffHeader.className = "toolbar";
  const diffTitle = document.createElement("strong");
  diffTitle.textContent = "DIFF";
  const inlineButton = createButton("Inline");
  const sideButton = createButton("Side by Side");
  diffHeader.append(diffTitle, inlineButton, sideButton);
  const diffMeta = document.createElement("div");
  diffMeta.className = "label";
  const diffBody = document.createElement("div");
  diffBody.id = "sourceControlDiff";
  diffBody.style.maxHeight = "280px";
  diffBody.style.overflow = "auto";

  const conflictsTitle = document.createElement("strong");
  conflictsTitle.textContent = "MERGE CONFLICTS";
  const conflicts = document.createElement("div");
  conflicts.id = "mergeConflictEditor";

  const graphTitle = document.createElement("strong");
  graphTitle.textContent = "COMMIT GRAPH";
  const graph = document.createElement("div");
  graph.id = "commitGraph";

  view.append(
    heading,
    branchToolbar,
    mergeToolbar,
    commitForm,
    stagedTitle,
    stagedList,
    changesTitle,
    changesList,
    diffHeader,
    diffMeta,
    diffBody,
    conflictsTitle,
    conflicts,
    graphTitle,
    graph
  );
  sidebar.append(view);

  let selectedDiff = null;
  let diffMode = "inline";
  let refreshGeneration = 0;
  let refreshTimer = 0;

  function report(error) {
    notify?.(error instanceof Error ? error.message : String(error));
  }

  function renderBranches() {
    const branches = provider.getBranches();
    const branchFragment = document.createDocumentFragment();
    const mergeFragment = document.createDocumentFragment();
    for (const branch of branches) {
      const option = document.createElement("option");
      option.value = branch.name;
      option.textContent = branch.current ? `● ${branch.name}` : branch.name;
      option.selected = branch.current;
      branchFragment.append(option);

      if (!branch.current) {
        const mergeOption = document.createElement("option");
        mergeOption.value = branch.name;
        mergeOption.textContent = branch.name;
        mergeFragment.append(mergeOption);
      }
    }
    branchSelect.replaceChildren(branchFragment);
    mergeSelect.replaceChildren(mergeFragment);
    mergeButton.disabled = mergeSelect.options.length === 0;
    mergeButton.setAttribute("aria-disabled", String(mergeButton.disabled));
  }

  async function showDiff(path, staged = false) {
    const diff = await provider.getDiff(path, { staged });
    selectedDiff = { path, staged, diff };
    const summary = summarizeDiff(diff.before, diff.after);
    diffTitle.textContent = `DIFF · ${path}`;
    diffMeta.textContent = `${diff.status} · +${summary.additions} -${summary.deletions}`;
    if (diffMode === "side") renderSideBySide(diffBody, diff);
    else renderInlineDiff(diffBody, diff);
    return diff;
  }

  function createChangeRow(change, staged) {
    const row = document.createElement("div");
    row.className = "file-row";
    row.dataset.resource = change.path;
    row.dataset.status = change.status;

    const status = document.createElement("span");
    status.className = "file-row__icon";
    status.textContent = statusLabel(change.status);
    const pathButton = document.createElement("button");
    pathButton.type = "button";
    pathButton.textContent = change.path;
    pathButton.title = staged ? "Show staged diff" : "Show working-tree diff";
    pathButton.addEventListener("click", () => showDiff(change.path, staged).catch(report));
    pathButton.addEventListener("dblclick", () => openFile?.(change.path));

    const action = createButton(staged ? "−" : "+", staged ? "Unstage" : "Stage");
    action.setAttribute("aria-label", `${staged ? "Unstage" : "Stage"} ${change.path}`);
    action.addEventListener("click", async () => {
      try {
        if (staged) provider.unstage(change.path);
        else await provider.stage(change.path);
        await refresh();
      } catch (error) {
        report(error);
      }
    });

    row.append(status, pathButton, action);
    return row;
  }

  function renderGraph() {
    const commits = provider.getCommitGraph();
    const fragment = document.createDocumentFragment();
    if (!commits.length) {
      const empty = document.createElement("div");
      empty.textContent = "No browser-local commits yet.";
      fragment.append(empty);
    }
    for (const commit of commits) {
      const row = document.createElement("div");
      row.className = "file-row";
      const marker = document.createElement("span");
      marker.textContent = "●";
      const text = document.createElement("span");
      text.textContent = `${commit.id.slice(0, 8)}  ${commit.message}  (${commit.branch})`;
      row.title = new Date(commit.timestamp).toLocaleString();
      row.append(marker, text);
      fragment.append(row);
    }
    graph.replaceChildren(fragment);
  }

  async function refresh() {
    const generation = ++refreshGeneration;
    const working = await provider.getWorkingChanges();
    if (generation !== refreshGeneration) return false;
    const staged = provider.getStaged();

    const stagedFragment = document.createDocumentFragment();
    if (!staged.length) {
      const empty = document.createElement("div");
      empty.textContent = "No staged changes.";
      stagedFragment.append(empty);
    } else {
      staged.forEach((change) => stagedFragment.append(createChangeRow(change, true)));
    }
    stagedList.replaceChildren(stagedFragment);

    const changesFragment = document.createDocumentFragment();
    if (!working.length) {
      const empty = document.createElement("div");
      empty.textContent = "Working tree clean.";
      changesFragment.append(empty);
    } else {
      working.forEach((change) => changesFragment.append(createChangeRow(change, false)));
    }
    changesList.replaceChildren(changesFragment);

    stagedTitle.textContent = `STAGED CHANGES (${staged.length})`;
    changesTitle.textContent = `CHANGES (${working.length})`;
    renderBranches();
    renderGraph();

    if (selectedDiff) {
      const stillExists = [...staged, ...working].some((change) => change.path === selectedDiff.path);
      if (stillExists) await showDiff(selectedDiff.path, selectedDiff.staged);
      else {
        selectedDiff = null;
        diffTitle.textContent = "DIFF";
        diffMeta.textContent = "";
        diffBody.replaceChildren();
      }
    }
    return true;
  }

  function scheduleRefresh() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => refresh().catch(report), 100);
  }

  inlineButton.addEventListener("click", () => {
    diffMode = "inline";
    if (selectedDiff) showDiff(selectedDiff.path, selectedDiff.staged).catch(report);
  });
  sideButton.addEventListener("click", () => {
    diffMode = "side";
    if (selectedDiff) showDiff(selectedDiff.path, selectedDiff.staged).catch(report);
  });

  commitForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const commit = await provider.commit(commitInput.value);
      commitInput.value = "";
      notify?.(`Committed ${commit.id.slice(0, 8)} on ${commit.branch}`);
      await refresh();
    } catch (error) {
      report(error);
    }
  });

  newBranchButton.addEventListener("click", () => {
    const name = window.prompt("New branch name", "feature/");
    if (name == null) return;
    try {
      provider.createBranch(name);
      refresh().catch(report);
    } catch (error) {
      report(error);
    }
  });

  branchSelect.addEventListener("change", async () => {
    try {
      await provider.switchBranch(branchSelect.value);
      notify?.("Switched to " + branchSelect.value);
      await refresh();
    } catch (error) {
      report(error);
      renderBranches();
    }
  });

  mergeButton.addEventListener("click", async () => {
    if (!mergeSelect.value) return;
    try {
      const result = await provider.mergeBranch(mergeSelect.value);
      if (result.conflicts.length) {
        renderMergeConflictEditor({
          container: conflicts,
          conflicts: result.conflicts,
          provider,
          notify,
          onResolved: (_path, remaining) => {
            conflictsTitle.textContent = `MERGE CONFLICTS (${remaining})`;
            refresh().catch(report);
          }
        });
        conflictsTitle.textContent = `MERGE CONFLICTS (${result.conflicts.length})`;
        notify?.(`Merge requires resolution in ${result.conflicts.length} file(s).`);
      } else {
        conflicts.replaceChildren();
        conflictsTitle.textContent = "MERGE CONFLICTS (0)";
        notify?.(`Merge from ${result.source} staged ${result.staged.length} file(s).`);
      }
      await refresh();
    } catch (error) {
      report(error);
    }
  });

  provider.subscribe(scheduleRefresh);
  workspace.subscribe(scheduleRefresh);
  conflictsTitle.textContent = "MERGE CONFLICTS (0)";
  refresh().catch(report);

  return Object.freeze({
    view,
    provider,
    refresh,
    showDiff,
    getDiffMode: () => diffMode
  });
}
