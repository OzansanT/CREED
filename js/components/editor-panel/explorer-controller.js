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

function updateFileButton(button, fileName, depth) {
  const extension = getFileExtension(fileName);
  button.className = "file-row";
  button.type = "button";
  button.dataset.resource = fileName;
  button.dataset.kind = "file";
  button.setAttribute("role", "treeitem");
  if (!button.hasAttribute("aria-selected")) button.setAttribute("aria-selected", "false");
  button.draggable = true;
  button.style.paddingInlineStart = `${8 + (depth * 14)}px`;
  button.title = fileName;
  let icon = button.querySelector(":scope > .file-row__icon");
  let label = button.querySelector(":scope > .file-row__name");
  if (!icon) {
    icon = document.createElement("span");
    button.prepend(icon);
  }
  if (!label) {
    label = document.createElement("span");
    button.append(label);
  }
  icon.className = "file-row__icon file-row__icon--" + (extension || "file");
  icon.textContent = getFileKind(fileName);
  label.className = "file-row__name";
  label.textContent = baseName(fileName);
  return button;
}

function createFileButton(fileName, depth) {
  return updateFileButton(document.createElement("button"), fileName, depth);
}

function updateDirectoryGroup(container, node, depth, collapsedFolders) {
  container.className = "workspace-tree__directory";
  container.dataset.directoryGroup = node.path;
  let button = container.querySelector(":scope > .file-row--folder");
  let children = container.querySelector(":scope > .workspace-tree__children");
  if (!button) {
    button = document.createElement("button");
    container.prepend(button);
  }
  if (!children) {
    children = document.createElement("div");
    container.append(children);
  }
  const collapsed = collapsedFolders.has(node.path);
  button.className = "file-row file-row--folder";
  button.type = "button";
  button.dataset.directory = node.path;
  button.dataset.kind = "directory";
  button.setAttribute("role", "treeitem");
  button.setAttribute("aria-expanded", String(!collapsed));
  if (!button.hasAttribute("aria-selected")) button.setAttribute("aria-selected", "false");
  button.style.paddingInlineStart = `${8 + (depth * 14)}px`;
  button.title = node.path;
  let icon = button.querySelector(":scope > .file-row__icon");
  let label = button.querySelector(":scope > .file-row__name");
  if (!icon) {
    icon = document.createElement("span");
    button.prepend(icon);
  }
  if (!label) {
    label = document.createElement("span");
    button.append(label);
  }
  icon.className = "file-row__icon file-row__icon--folder";
  icon.textContent = collapsed ? "›" : "⌄";
  label.className = "file-row__name";
  label.textContent = node.name;
  children.className = "workspace-tree__children";
  children.dataset.directoryChildren = node.path;
  children.setAttribute("role", "group");
  children.hidden = collapsed;
  return { container, children };
}

function createDirectoryGroup(node, depth, collapsedFolders) {
  const container = document.createElement("div");
  updateDirectoryGroup(container, node, depth, collapsedFolders);
  return container;
}

function directChildMap(container) {
  const map = new Map();
  for (const child of container.children) {
    if (child.matches(".workspace-tree__directory[data-directory-group]")) {
      map.set("d:" + child.dataset.directoryGroup, child);
    } else if (child.matches(".file-row[data-resource]")) {
      map.set("f:" + child.dataset.resource, child);
    }
  }
  return map;
}

export function createExplorerController({ rootToggle, fileTree, getFiles, getDirectories, onOpen }) {
  const collapsedFolders = new Set();
  let selectedPath = "";
  let selectedKind = "";
  let reconciliationStats = { reused: 0, created: 0, removed: 0 };

  fileTree.setAttribute("role", "tree");
  fileTree.removeAttribute("aria-multiselectable");

  function reconcileContainer(container, node, depth) {
    const existing = directChildMap(container);
    const desired = [];
    const directories = [...node.directories.values()].sort((a, b) => a.name.localeCompare(b.name));
    const files = [...node.files].sort((left, right) => baseName(left).localeCompare(baseName(right)));

    for (const directory of directories) {
      const key = "d:" + directory.path;
      let group = existing.get(key);
      if (group) {
        reconciliationStats.reused += 1;
        existing.delete(key);
      } else {
        group = createDirectoryGroup(directory, depth, collapsedFolders);
        reconciliationStats.created += 1;
      }
      const { children } = updateDirectoryGroup(group, directory, depth, collapsedFolders);
      reconcileContainer(children, directory, depth + 1);
      desired.push(group);
    }

    for (const fileName of files) {
      const key = "f:" + fileName;
      let button = existing.get(key);
      if (button) {
        reconciliationStats.reused += 1;
        existing.delete(key);
        updateFileButton(button, fileName, depth);
      } else {
        button = createFileButton(fileName, depth);
        reconciliationStats.created += 1;
      }
      desired.push(button);
    }

    for (const stale of existing.values()) {
      stale.remove();
      reconciliationStats.removed += 1;
    }
    for (const element of desired) container.append(element);
  }

  function render() {
    reconciliationStats = { reused: 0, created: 0, removed: 0 };
    const tree = buildWorkspaceTree(getFiles?.() || [], getDirectories?.() || []);
    reconcileContainer(fileTree, tree, 0);
    setSelected(selectedPath, selectedKind);
    return { ...reconciliationStats };
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
    const icon = button.querySelector(":scope > .file-row__icon");
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
    getSelection: () => ({ path: selectedPath, kind: selectedKind }),
    getReconciliationStats: () => ({ ...reconciliationStats })
  });
}
