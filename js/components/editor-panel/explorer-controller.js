import { getFileExtension, getFileKind } from "./file-metadata.js";

function baseName(path) {
  return path.slice(path.lastIndexOf("/") + 1);
}

function buildWorkspaceTree(files, directories) {
  const root = { name: "", path: "", directories: new Map(), files: [] };

  function ensureDirectory(path) {
    let node = root;
    let current = "";
    for (const segment of path ? path.split("/") : []) {
      current = current ? current + "/" + segment : segment;
      if (!node.directories.has(segment)) {
        node.directories.set(segment, { name: segment, path: current, directories: new Map(), files: [] });
      }
      node = node.directories.get(segment);
    }
    return node;
  }

  for (const directory of directories || []) ensureDirectory(directory);
  for (const fileName of files || []) {
    const parent = fileName.includes("/") ? fileName.slice(0, fileName.lastIndexOf("/")) : "";
    ensureDirectory(parent).files.push(fileName);
  }
  return root;
}

function createFileButton(fileName, depth) {
  const button = document.createElement("button");
  const icon = document.createElement("span");
  const label = document.createElement("span");
  const extension = getFileExtension(fileName);

  button.className = "file-row";
  button.type = "button";
  button.dataset.resource = fileName;
  button.dataset.kind = "file";
  button.setAttribute("role", "treeitem");
  button.setAttribute("aria-selected", "false");
  button.draggable = true;
  button.style.paddingInlineStart = `${8 + (depth * 14)}px`;
  button.title = fileName;

  icon.className = "file-row__icon file-row__icon--" + (extension || "file");
  icon.textContent = getFileKind(fileName);
  label.className = "file-row__name";
  label.textContent = baseName(fileName);
  button.append(icon, label);
  return button;
}

function createDirectoryGroup(node, depth, collapsedFolders) {
  const container = document.createElement("div");
  const button = document.createElement("button");
  const icon = document.createElement("span");
  const label = document.createElement("span");
  const children = document.createElement("div");
  const collapsed = collapsedFolders.has(node.path);

  container.className = "workspace-tree__directory";
  container.dataset.directoryGroup = node.path;
  button.className = "file-row file-row--folder";
  button.type = "button";
  button.dataset.directory = node.path;
  button.dataset.kind = "directory";
  button.setAttribute("role", "treeitem");
  button.setAttribute("aria-expanded", String(!collapsed));
  button.setAttribute("aria-selected", "false");
  button.style.paddingInlineStart = `${8 + (depth * 14)}px`;
  button.title = node.path;

  icon.className = "file-row__icon file-row__icon--folder";
  icon.textContent = collapsed ? "›" : "⌄";
  label.className = "file-row__name";
  label.textContent = node.name;
  button.append(icon, label);

  children.className = "workspace-tree__children";
  children.dataset.directoryChildren = node.path;
  children.setAttribute("role", "group");
  children.hidden = collapsed;

  const directories = [...node.directories.values()].sort((left, right) => left.name.localeCompare(right.name));
  for (const directory of directories) {
    children.append(createDirectoryGroup(directory, depth + 1, collapsedFolders));
  }
  for (const fileName of [...node.files].sort((left, right) => baseName(left).localeCompare(baseName(right)))) {
    children.append(createFileButton(fileName, depth + 1));
  }

  container.append(button, children);
  return container;
}

export function createExplorerController({ rootToggle, fileTree, getFiles, getDirectories, onOpen }) {
  const collapsedFolders = new Set();
  let selectedPath = "";
  let selectedKind = "";

  fileTree.setAttribute("role", "tree");
  fileTree.removeAttribute("aria-multiselectable");

  function render() {
    const tree = buildWorkspaceTree(getFiles?.() || [], getDirectories?.() || []);
    const fragment = document.createDocumentFragment();
    for (const directory of [...tree.directories.values()].sort((a, b) => a.name.localeCompare(b.name))) {
      fragment.append(createDirectoryGroup(directory, 0, collapsedFolders));
    }
    for (const fileName of [...tree.files].sort((left, right) => left.localeCompare(right))) {
      fragment.append(createFileButton(fileName, 0));
    }
    fileTree.replaceChildren(fragment);
    setSelected(selectedPath, selectedKind);
    return true;
  }

  function setExpanded(expanded) {
    rootToggle.setAttribute("aria-expanded", String(expanded));
    rootToggle.title = expanded ? "Collapse CREED files" : "Expand CREED files";
    fileTree.hidden = !expanded;
  }

  function setSelected(path, kind = path ? "file" : "") {
    selectedPath = path || "";
    selectedKind = selectedPath ? kind : "";
    fileTree.querySelectorAll(".file-row[data-resource], .file-row[data-directory]").forEach((button) => {
      const candidate = button.dataset.resource || button.dataset.directory || "";
      const candidateKind = button.dataset.kind || "";
      const selected = candidate === selectedPath && candidateKind === selectedKind;
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-selected", String(selected));
    });
  }

  function toggleDirectory(path) {
    const button = fileTree.querySelector(`[data-directory="${CSS.escape(path)}"]`);
    const children = fileTree.querySelector(`[data-directory-children="${CSS.escape(path)}"]`);
    if (!button || !children) return false;
    const collapsed = !children.hidden;
    children.hidden = collapsed;
    button.setAttribute("aria-expanded", String(!collapsed));
    const icon = button.querySelector(".file-row__icon");
    if (icon) icon.textContent = collapsed ? "›" : "⌄";
    if (collapsed) collapsedFolders.add(path);
    else collapsedFolders.delete(path);
    return true;
  }

  function reveal(path) {
    let parent = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
    const parents = [];
    while (parent) {
      parents.unshift(parent);
      parent = parent.includes("/") ? parent.slice(0, parent.lastIndexOf("/")) : "";
    }
    parents.forEach((directory) => collapsedFolders.delete(directory));
    render();
    const button = fileTree.querySelector(`[data-resource="${CSS.escape(path)}"]`);
    button?.scrollIntoView({ block: "nearest" });
  }

  fileTree.addEventListener("click", (event) => {
    const button = event.target.closest(".file-row");
    if (!button) return;
    const fileName = button.dataset.resource;
    const directory = button.dataset.directory;
    if (fileName) {
      setSelected(fileName, "file");
      onOpen?.(fileName);
    } else if (directory) {
      setSelected(directory, "directory");
      toggleDirectory(directory);
    }
  });

  rootToggle.addEventListener("click", () => {
    setExpanded(rootToggle.getAttribute("aria-expanded") !== "true");
  });

  render();
  setExpanded(true);

  return Object.freeze({
    setExpanded,
    setSelected,
    refresh: render,
    reveal,
    getSelection: () => ({ path: selectedPath, kind: selectedKind })
  });
}
