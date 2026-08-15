import { downloadTextFile } from "./download.js";
import { getFileName, getLanguageInfo } from "./source-language.js";

function createNode(name = "") {
  return { name, path: "", folders: new Map(), files: [] };
}

function buildTree(store) {
  const root = createNode();
  const getFolder = (path) => {
    let node = root;
    let current = "";
    path.split("/").filter(Boolean).forEach((part) => {
      current = current ? current + "/" + part : part;
      if (!node.folders.has(part)) {
        const child = createNode(part);
        child.path = current;
        node.folders.set(part, child);
      }
      node = node.folders.get(part);
    });
    return node;
  };
  store.listDirectories().forEach(getFolder);
  store.listFiles().forEach((file) => {
    const parts = file.path.split("/");
    const folder = getFolder(parts.slice(0, -1).join("/"));
    folder.files.push(file);
  });
  return root;
}

function actionButton(label, title, onClick) {
  const button = document.createElement("button");
  button.className = "tree-action";
  button.type = "button";
  button.title = title;
  button.setAttribute("aria-label", title);
  button.textContent = label;
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    onClick();
  });
  return button;
}

function downloadWorkspace(store) {
  const files = {};
  store.listFiles().forEach((file) => {
    const record = store.getFile(file.path);
    if (record?.loaded) files[file.path] = record.content;
  });
  downloadTextFile("creed-browser-workspace.json", JSON.stringify({
    format: "creed-browser-workspace",
    version: 1,
    branch: store.getBranch(),
    exportedAt: new Date().toISOString(),
    files
  }, null, 2), "application/json");
}

export function bindExplorer({
  store,
  fileTree,
  newFileButton,
  newFolderButton,
  refreshButton,
  moreButton,
  onOpen,
  onRename,
  onDelete,
  notify
}) {
  const expanded = new Set(store.listDirectories());
  let selectedPath = "";

  async function rename(path) {
    const next = window.prompt(`Rename ${path} to:`, path);
    if (!next || next === path) return;
    try {
      const normalized = await store.renamePath(path, next);
      onRename?.(path, normalized);
      selectedPath = normalized;
      render();
      notify?.(`Renamed ${path} to ${normalized}`);
    } catch (error) {
      notify?.(error.message);
    }
  }

  async function remove(path) {
    if (!window.confirm(`Delete ${path} from the browser workspace?`)) return;
    try {
      const affected = await store.removePath(path);
      if (affected.includes(selectedPath)) selectedPath = "";
      onDelete?.(affected);
      render();
      notify?.(`Deleted ${path}`);
    } catch (error) {
      notify?.(error.message);
    }
  }

  function renderFolder(node, container) {
    [...node.folders.values()]
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach((folder) => {
        const wrapper = document.createElement("div");
        wrapper.className = "tree-node";
        const row = document.createElement("div");
        row.className = "folder-row";
        row.role = "treeitem";
        row.tabIndex = 0;
        row.dataset.folder = folder.path;
        row.setAttribute("aria-expanded", String(expanded.has(folder.path)));
        const caret = document.createElement("span");
        caret.textContent = expanded.has(folder.path) ? "⌄" : "›";
        const icon = document.createElement("span");
        icon.textContent = "▰";
        const name = document.createElement("span");
        name.className = "tree-name";
        name.textContent = folder.name;
        const actions = document.createElement("span");
        actions.className = "tree-actions";
        actions.append(
          actionButton("✎", `Rename ${folder.path}`, () => rename(folder.path)),
          actionButton("×", `Delete ${folder.path}`, () => remove(folder.path))
        );
        row.append(caret, icon, name, actions);
        const toggleFolder = () => {
          if (expanded.has(folder.path)) expanded.delete(folder.path);
          else expanded.add(folder.path);
          render();
        };
        row.addEventListener("click", toggleFolder);
        row.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") { event.preventDefault(); toggleFolder(); }
        });
        const children = document.createElement("div");
        children.className = "tree-children";
        children.hidden = !expanded.has(folder.path);
        renderFolder(folder, children);
        wrapper.append(row, children);
        container.append(wrapper);
      });

    node.files.sort((a, b) => a.path.localeCompare(b.path)).forEach((file) => {
      const row = document.createElement("div");
      const info = getLanguageInfo(file.path);
      row.className = "file-row";
      row.role = "option";
      row.tabIndex = 0;
      row.dataset.file = file.path;
      row.setAttribute("aria-selected", String(file.path === selectedPath));
      row.classList.toggle("selected", file.path === selectedPath);
      const icon = document.createElement("span");
      icon.className = "file-icon " + (info.extension || "file");
      icon.textContent = info.kind;
      const name = document.createElement("span");
      name.className = "tree-name";
      name.textContent = getFileName(file.path);
      const status = document.createElement("span");
      status.className = "tree-status " + file.status;
      status.textContent = file.status === "added" ? "A" : file.status === "modified" ? "M" : "";
      status.title = file.status === "unchanged" ? "" : file.status;
      const actions = document.createElement("span");
      actions.className = "tree-actions";
      actions.append(
        actionButton("✎", `Rename ${file.path}`, () => rename(file.path)),
        actionButton("×", `Delete ${file.path}`, () => remove(file.path))
      );
      row.append(icon, name, status, actions);
      const open = () => {
        selectedPath = file.path;
        render();
        onOpen?.(file.path);
      };
      row.addEventListener("click", open);
      row.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") { event.preventDefault(); open(); }
      });
      container.append(row);
    });
  }

  function render() {
    const fragment = document.createDocumentFragment();
    renderFolder(buildTree(store), fragment);
    fileTree.replaceChildren(fragment);
  }

  newFileButton.addEventListener("click", () => {
    const path = window.prompt("New file path:", "untitled.txt");
    if (!path) return;
    try {
      const created = store.createFile(path, "");
      selectedPath = created;
      render();
      onOpen?.(created, { edit: true });
      notify?.(`Created ${created}`);
    } catch (error) {
      notify?.(error.message);
    }
  });
  newFolderButton.addEventListener("click", () => {
    const path = window.prompt("New folder path:", "new-folder");
    if (!path) return;
    try {
      const created = store.createFolder(path);
      expanded.add(created);
      render();
      notify?.(`Created ${created}`);
    } catch (error) {
      notify?.(error.message);
    }
  });
  refreshButton.addEventListener("click", () => {
    render();
    notify?.("Explorer refreshed from the browser workspace");
  });
  moreButton.addEventListener("click", async () => {
    try {
      await store.ensureAllLoaded({ onProgress: ({ completed, total }) => notify?.(`Loading workspace ${completed}/${total}`) });
      downloadWorkspace(store);
      notify?.("Browser workspace exported");
    } catch (error) {
      notify?.(error.message);
    }
  });
  store.subscribe((event) => {
    if (["write", "create", "delete", "rename", "discard", "discard-all", "commit", "stage", "stage-all", "replace-all", "restore", "reset"].includes(event.type)) render();
  });
  render();

  return Object.freeze({
    render,
    select(path) {
      selectedPath = path || "";
      parentDirectoriesForSelection(selectedPath).forEach((directory) => expanded.add(directory));
      render();
    },
    getSelectedPath: () => selectedPath
  });
}

function parentDirectoriesForSelection(path) {
  const parts = String(path || "").split("/");
  return parts.slice(0, -1).map((_, index) => parts.slice(0, index + 1).join("/"));
}
