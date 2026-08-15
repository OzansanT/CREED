import { downloadTextFile } from "./download.js";

const STATUS_LABEL = Object.freeze({ added: "A", modified: "M", deleted: "D" });

function patchForChange(change) {
  const before = change.baseline === null ? [] : String(change.baseline ?? "").split("\n");
  const after = change.deleted ? [] : String(change.content ?? "").split("\n");
  return [
    `--- ${change.baseline === null ? "/dev/null" : "a/" + change.path}`,
    `+++ ${change.deleted ? "/dev/null" : "b/" + change.path}`,
    `@@ -1,${before.length} +1,${after.length} @@`,
    ...before.map((line) => "-" + line),
    ...after.map((line) => "+" + line)
  ].join("\n");
}

function makeButton(text, title = text) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = text;
  button.title = title;
  return button;
}

export function createSourceControlView({ store, openFile, notify, logOutput }) {
  return function renderSourceControl(container) {
    const root = document.createElement("div");
    const branchSection = document.createElement("section");
    branchSection.className = "activity-section";
    const title = document.createElement("h2");
    title.textContent = "Source Control";
    const branchForm = document.createElement("form");
    branchForm.className = "activity-form";
    const branchInput = document.createElement("input");
    branchInput.value = store.getBranch();
    branchInput.setAttribute("aria-label", "Local branch name");
    const branchButton = makeButton("Switch");
    branchButton.type = "submit";
    branchForm.append(branchInput, branchButton);
    const note = document.createElement("p");
    note.textContent = "Changes and commits are maintained in the browser workspace. Export a patch to transfer them.";
    branchSection.append(title, branchForm, note);

    const commitSection = document.createElement("section");
    commitSection.className = "activity-section";
    const commitForm = document.createElement("form");
    commitForm.className = "activity-form activity-form--column";
    const message = document.createElement("textarea");
    message.rows = 2;
    message.placeholder = "Commit message";
    message.setAttribute("aria-label", "Commit message");
    const commitButton = makeButton("Commit staged changes");
    commitButton.className = "primary";
    commitButton.type = "submit";
    commitForm.append(message, commitButton);
    commitSection.append(commitForm);

    const changesSection = document.createElement("section");
    changesSection.className = "activity-section";
    const changesHeading = document.createElement("h3");
    const changeActions = document.createElement("div");
    changeActions.className = "activity-actions";
    const stageAll = makeButton("Stage all");
    const unstageAll = makeButton("Unstage all");
    const discardAll = makeButton("Discard all");
    const exportPatch = makeButton("Export patch");
    changeActions.append(stageAll, unstageAll, discardAll, exportPatch);
    const changesList = document.createElement("div");
    changesList.className = "change-list";
    const diff = document.createElement("pre");
    diff.className = "diff-view";
    diff.hidden = true;
    changesSection.append(changesHeading, changeActions, changesList, diff);

    const historySection = document.createElement("section");
    historySection.className = "activity-section";
    const historyHeading = document.createElement("h3");
    historyHeading.textContent = "Local commits";
    const historyList = document.createElement("div");
    historyList.className = "commit-list";
    historySection.append(historyHeading, historyList);
    root.append(branchSection, commitSection, changesSection, historySection);
    container.replaceChildren(root);

    function render() {
      const changes = store.listChanges();
      changesHeading.textContent = `Changes (${changes.length})`;
      commitButton.disabled = !changes.some((change) => change.staged);
      const fragment = document.createDocumentFragment();
      changes.forEach((change) => {
        const item = document.createElement("div");
        item.className = "change-item";
        const badge = document.createElement("span");
        badge.className = "change-badge " + change.status;
        badge.textContent = STATUS_LABEL[change.status] || "?";
        const open = makeButton(change.path, `Open ${change.path}`);
        open.addEventListener("click", () => {
          if (change.deleted) {
            diff.textContent = patchForChange(change);
            diff.hidden = false;
          } else openFile(change.path);
        });
        const actions = document.createElement("div");
        actions.className = "change-item__actions";
        const stage = makeButton(change.staged ? "−" : "+", change.staged ? "Unstage" : "Stage");
        const showDiff = makeButton("≠", "Show diff");
        const discard = makeButton("↶", "Discard change");
        stage.addEventListener("click", () => {
          store.setStaged(change.path, !change.staged);
          render();
        });
        showDiff.addEventListener("click", () => {
          diff.textContent = patchForChange(change);
          diff.hidden = false;
        });
        discard.addEventListener("click", () => {
          if (!window.confirm(`Discard the browser-workspace change to ${change.path}?`)) return;
          store.discard(change.path);
          render();
        });
        actions.append(stage, showDiff, discard);
        item.append(badge, open, actions);
        fragment.append(item);
      });
      if (!changes.length) {
        const empty = document.createElement("div");
        empty.className = "activity-empty";
        empty.textContent = "No browser-workspace changes.";
        fragment.append(empty);
        diff.hidden = true;
      }
      changesList.replaceChildren(fragment);

      const commits = store.getCommits();
      const commitFragment = document.createDocumentFragment();
      commits.forEach((commit) => {
        const item = document.createElement("div");
        item.className = "commit-item";
        const heading = document.createElement("strong");
        heading.textContent = commit.message;
        const meta = document.createElement("small");
        meta.textContent = `${commit.id} · ${commit.files.length} files · ${new Date(commit.createdAt).toLocaleString()}`;
        item.append(heading, document.createElement("br"), meta);
        commitFragment.append(item);
      });
      if (!commits.length) {
        const empty = document.createElement("div");
        empty.className = "activity-empty";
        empty.textContent = "No local commits yet.";
        commitFragment.append(empty);
      }
      historyList.replaceChildren(commitFragment);
    }

    branchForm.addEventListener("submit", (event) => {
      event.preventDefault();
      try {
        store.setBranch(branchInput.value);
        notify?.(`Switched browser workspace to ${store.getBranch()}`);
      } catch (error) {
        notify?.(error.message);
      }
    });
    commitForm.addEventListener("submit", (event) => {
      event.preventDefault();
      try {
        const commit = store.commit(message.value);
        message.value = "";
        logOutput?.(`Committed ${commit.id}: ${commit.message}`);
        notify?.(`Created ${commit.id}`);
        render();
      } catch (error) {
        notify?.(error.message);
      }
    });
    stageAll.addEventListener("click", () => { store.stageAll(true); render(); });
    unstageAll.addEventListener("click", () => { store.stageAll(false); render(); });
    discardAll.addEventListener("click", () => {
      if (!store.listChanges().length || !window.confirm("Discard every browser-workspace change?")) return;
      store.discardAll();
      render();
    });
    exportPatch.addEventListener("click", () => {
      const patch = store.exportPatch();
      if (!patch) { notify?.("There are no changes to export"); return; }
      downloadTextFile("creed-workspace.patch", patch, "text/x-diff");
      notify?.("Patch exported");
    });
    const unsubscribe = store.subscribe((event) => {
      if (["write", "create", "delete", "rename", "stage", "stage-all", "discard", "discard-all", "commit", "branch", "replace-all", "restore", "reset"].includes(event.type)) render();
    });
    render();
    return unsubscribe;
  };
}
