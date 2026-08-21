function parentDirectory(path) {
  const index = path.lastIndexOf("/");
  return index < 0 ? "" : path.slice(0, index);
}

function baseName(path) {
  return path.slice(path.lastIndexOf("/") + 1);
}

function joinPath(directory, name) {
  return directory ? directory + "/" + name : name;
}

function createCopyPath(path, hasFile, hasDirectory) {
  const directory = parentDirectory(path);
  const name = baseName(path);
  const dot = name.lastIndexOf(".");
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const extension = dot > 0 ? name.slice(dot) : "";
  let index = 1;
  let candidate = joinPath(directory, `${stem}-copy${extension}`);
  while (hasFile(candidate) || hasDirectory(candidate)) {
    index += 1;
    candidate = joinPath(directory, `${stem}-copy-${index}${extension}`);
  }
  return candidate;
}

function showContextMenu({ event, actions }) {
  document.querySelector(".explorer-context-menu")?.remove();
  const menu = document.createElement("div");
  menu.className = "explorer-context-menu";
  menu.setAttribute("role", "menu");
  Object.assign(menu.style, {
    position: "fixed",
    zIndex: "10000",
    left: `${event.clientX}px`,
    top: `${event.clientY}px`,
    minWidth: "150px",
    padding: "4px",
    background: "var(--surface-raised, #fff)",
    border: "1px solid var(--border, #c8c8c8)",
    boxShadow: "0 4px 16px rgba(0,0,0,.18)"
  });
  for (const action of actions) {
    if (!action) continue;
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = action.label;
    button.setAttribute("role", "menuitem");
    Object.assign(button.style, { display: "block", width: "100%", textAlign: "left" });
    button.addEventListener("click", () => {
      menu.remove();
      Promise.resolve(action.run()).catch(action.onError);
    });
    menu.append(button);
  }
  document.body.append(menu);
  const dismiss = (dismissEvent) => {
    if (!menu.contains(dismissEvent.target)) menu.remove();
    document.removeEventListener("pointerdown", dismiss, true);
  };
  queueMicrotask(() => document.addEventListener("pointerdown", dismiss, true));
  menu.querySelector("button")?.focus();
}

export function bindExplorerFileActions({
  fileTree,
  newFileButton,
  newFolderButton,
  refreshButton,
  workspace,
  explorer,
  openFile,
  renameOpenFile,
  closeDeletedFiles,
  notify
}) {
  let draggedFile = "";

  function reportError(error) {
    notify?.(error instanceof Error ? error.message : String(error));
  }

  function selectedDirectory() {
    const selection = explorer.getSelection();
    if (!selection.path) return "";
    return selection.kind === "directory" ? selection.path : parentDirectory(selection.path);
  }

  async function createFile() {
    const directory = selectedDirectory();
    const raw = window.prompt("New file path", joinPath(directory, "untitled.js"));
    if (raw == null) return false;
    const path = workspace.createFile(raw.trim(), "");
    explorer.refresh();
    explorer.reveal(path);
    await openFile?.(path);
    notify?.("Created " + path);
    return true;
  }

  function createDirectory() {
    const directory = selectedDirectory();
    const raw = window.prompt("New folder path", joinPath(directory, "new-folder"));
    if (raw == null) return false;
    const path = workspace.createDirectory(raw.trim());
    explorer.refresh();
    explorer.setSelected(path, "directory");
    notify?.("Created " + path);
    return true;
  }

  async function renamePath(path, kind) {
    const raw = window.prompt("Rename workspace path", path);
    if (raw == null || raw.trim() === path) return false;
    const target = await workspace.rename(path, raw.trim());
    renameOpenFile?.(path, target, kind);
    explorer.refresh();
    explorer.reveal(kind === "file" ? target : target + "/placeholder");
    explorer.setSelected(target, kind);
    notify?.(`Renamed ${path} → ${target}`);
    return true;
  }

  async function duplicatePath(path) {
    const target = createCopyPath(path, workspace.hasFile, workspace.hasDirectory);
    await workspace.duplicateFile(path, target);
    explorer.refresh();
    explorer.reveal(target);
    await openFile?.(target);
    notify?.("Duplicated as " + target);
    return true;
  }

  function deletePath(path, kind) {
    if (!window.confirm(`Delete ${path}?`)) return false;
    const deleted = kind === "directory" ? workspace.deleteDirectory(path) : workspace.deleteFile(path);
    if (!deleted) return false;
    closeDeletedFiles?.(path, kind);
    explorer.refresh();
    notify?.("Deleted " + path);
    return true;
  }

  async function moveFileToDirectory(fileName, directory) {
    if (!fileName || !directory || parentDirectory(fileName) === directory) return false;
    const target = joinPath(directory, baseName(fileName));
    const renamed = await workspace.rename(fileName, target);
    renameOpenFile?.(fileName, renamed, "file");
    explorer.refresh();
    explorer.reveal(renamed);
    notify?.(`Moved ${fileName} → ${renamed}`);
    return true;
  }

  newFileButton?.addEventListener("click", () => createFile().catch(reportError));
  newFolderButton?.addEventListener("click", () => {
    try { createDirectory(); } catch (error) { reportError(error); }
  });
  refreshButton?.addEventListener("click", () => {
    explorer.refresh();
    workspace.refresh();
    notify?.("Explorer refreshed");
  });

  fileTree.addEventListener("contextmenu", (event) => {
    const row = event.target.closest(".file-row[data-resource], .file-row[data-directory]");
    if (!row) return;
    event.preventDefault();
    const path = row.dataset.resource || row.dataset.directory;
    const kind = row.dataset.resource ? "file" : "directory";
    explorer.setSelected(path, kind);
    showContextMenu({
      event,
      actions: [
        { label: "Rename", run: () => renamePath(path, kind), onError: reportError },
        kind === "file" ? { label: "Duplicate", run: () => duplicatePath(path), onError: reportError } : null,
        { label: "Delete", run: () => deletePath(path, kind), onError: reportError }
      ]
    });
  });

  fileTree.addEventListener("keydown", (event) => {
    const row = event.target.closest(".file-row[data-resource], .file-row[data-directory]");
    if (!row) return;
    const path = row.dataset.resource || row.dataset.directory;
    const kind = row.dataset.resource ? "file" : "directory";
    if (event.key === "F2") {
      event.preventDefault();
      renamePath(path, kind).catch(reportError);
    } else if (event.key === "Delete") {
      event.preventDefault();
      try { deletePath(path, kind); } catch (error) { reportError(error); }
    }
  });

  fileTree.addEventListener("dragstart", (event) => {
    const row = event.target.closest(".file-row[data-resource]");
    if (!row) return;
    draggedFile = row.dataset.resource || "";
    event.dataTransfer?.setData("text/plain", draggedFile);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
  });
  fileTree.addEventListener("dragend", () => { draggedFile = ""; });
  fileTree.addEventListener("dragover", (event) => {
    const folder = event.target.closest(".file-row[data-directory]");
    if (!folder || !draggedFile) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
  });
  fileTree.addEventListener("drop", (event) => {
    const folder = event.target.closest(".file-row[data-directory]");
    if (!folder) return;
    event.preventDefault();
    const source = draggedFile || event.dataTransfer?.getData("text/plain") || "";
    draggedFile = "";
    moveFileToDirectory(source, folder.dataset.directory).catch(reportError);
  });

  return Object.freeze({ createFile, createDirectory, renamePath, duplicatePath, deletePath, moveFileToDirectory });
}
