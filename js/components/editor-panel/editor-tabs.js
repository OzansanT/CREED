import { createIcon } from "../../ui/icons.js";

export function createEditorTabs({
  container,
  canvasTab,
  codeView,
  onActivate,
  onClose
}) {
  const tabs = new Map();
  let activeFile = "";

  function createTabId(fileName) {
    let hash = 2166136261;
    for (const character of fileName) {
      hash ^= character.codePointAt(0);
      hash = Math.imul(hash, 16777619);
    }
    const slug = fileName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    return "fileTab-" + slug + "-" + (hash >>> 0).toString(36);
  }

  function setCanvasSelected(selected) {
    canvasTab.classList.toggle("is-active", selected);
    canvasTab.setAttribute("aria-selected", String(selected));
    canvasTab.tabIndex = selected ? 0 : -1;
  }

  function synchronizeTabs() {
    setCanvasSelected(activeFile === "");
    tabs.forEach(({ tab }, fileName) => {
      const selected = fileName === activeFile;
      tab.classList.toggle("is-active", selected);
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
    });
  }

  function activate(fileName, { focus = false, notify = true } = {}) {
    if (fileName && !tabs.has(fileName)) return false;

    activeFile = fileName;
    synchronizeTabs();

    const activeTab = fileName ? tabs.get(fileName)?.tab : canvasTab;
    if (activeTab) {
      codeView.setAttribute("aria-labelledby", activeTab.id);
      if (focus) activeTab.focus();
      if (fileName) activeTab.scrollIntoView({ block: "nearest", inline: "nearest" });
    }

    if (notify) onActivate?.(fileName);
    return true;
  }

  function close(fileName, { focus = true } = {}) {
    const record = tabs.get(fileName);
    if (!record) return false;

    const openFiles = [...tabs.keys()];
    const closedIndex = openFiles.indexOf(fileName);
    const wasActive = activeFile === fileName;

    tabs.delete(fileName);
    record.tab.remove();
    onClose?.(fileName);

    if (wasActive) {
      const remainingFiles = [...tabs.keys()];
      const nextFile = remainingFiles[Math.min(closedIndex, remainingFiles.length - 1)] || "";
      activate(nextFile, { focus });
    } else {
      synchronizeTabs();
    }
    return true;
  }

  function clear({ notify = true } = {}) {
    const openFiles = [...tabs.keys()];
    for (const fileName of openFiles) {
      const record = tabs.get(fileName);
      record?.tab.remove();
      tabs.delete(fileName);
      onClose?.(fileName);
    }
    activeFile = "";
    synchronizeTabs();
    codeView.setAttribute("aria-labelledby", canvasTab.id);
    if (notify) onActivate?.("");
    return openFiles;
  }

  function focusRelative(fileName, direction) {
    const sequence = ["", ...tabs.keys()];
    const currentIndex = sequence.indexOf(fileName);
    const nextIndex = (currentIndex + direction + sequence.length) % sequence.length;
    activate(sequence[nextIndex], { focus: true });
  }

  function updateTabAccessibleName(record, fileName) {
    const label = record.tab.querySelector(".editor-tab__label");
    const closeButton = record.tab.querySelector(".editor-tab__close");
    const dirty = record.tab.classList.contains("is-dirty");
    if (label) label.textContent = fileName;
    if (closeButton) {
      closeButton.title = (dirty ? "Discard unsaved changes and close " : "Close ") + fileName;
      closeButton.setAttribute("aria-label", closeButton.title);
    }
    record.tab.title = dirty ? fileName + " — unsaved changes" : fileName;
  }

  function createFileTab(fileName, kind) {
    const tab = document.createElement("div");
    const icon = document.createElement("span");
    const label = document.createElement("span");
    const dirtyIndicator = document.createElement("span");
    const closeButton = document.createElement("button");

    tab.id = createTabId(fileName);
    tab.className = "editor-tab editor-tab--file";
    tab.dataset.resource = fileName;
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-selected", "false");
    tab.setAttribute("aria-controls", codeView.id);
    tab.tabIndex = -1;

    icon.className = "editor-tab__icon file-kind";
    icon.textContent = kind;
    label.className = "editor-tab__label";
    label.textContent = fileName;
    dirtyIndicator.className = "editor-tab__dirty";
    dirtyIndicator.textContent = "●";
    dirtyIndicator.hidden = true;
    dirtyIndicator.setAttribute("aria-hidden", "true");

    closeButton.className = "editor-tab__close";
    closeButton.type = "button";
    closeButton.append(createIcon("close"));

    tab.append(icon, label, dirtyIndicator, closeButton);
    const currentFileName = () => tab.dataset.resource || "";
    tab.addEventListener("click", (event) => {
      if (event.target.closest(".editor-tab__close")) return;
      activate(currentFileName());
    });
    tab.addEventListener("auxclick", (event) => {
      if (event.button !== 1) return;
      event.preventDefault();
      close(currentFileName());
    });
    tab.addEventListener("keydown", (event) => {
      const current = currentFileName();
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        focusRelative(current, -1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        focusRelative(current, 1);
      } else if (event.key === "Home") {
        event.preventDefault();
        activate("", { focus: true });
      } else if (event.key === "End") {
        event.preventDefault();
        activate([...tabs.keys()].at(-1) || "", { focus: true });
      } else if (event.key === "Delete") {
        event.preventDefault();
        close(current);
      } else if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        activate(current);
      }
    });
    closeButton.addEventListener("click", (event) => {
      event.stopPropagation();
      close(currentFileName());
    });

    container.append(tab);
    const record = { tab, kind };
    tabs.set(fileName, record);
    updateTabAccessibleName(record, fileName);
    return tab;
  }

  function open(fileName, kind, { activate: shouldActivate = true } = {}) {
    if (!tabs.has(fileName)) createFileTab(fileName, kind);
    if (shouldActivate) activate(fileName);
    else synchronizeTabs();
  }

  function setDirty(fileName, dirty) {
    const record = tabs.get(fileName);
    if (!record) return false;
    record.tab.classList.toggle("is-dirty", Boolean(dirty));
    const indicator = record.tab.querySelector(".editor-tab__dirty");
    if (indicator) indicator.hidden = !dirty;
    updateTabAccessibleName(record, fileName);
    return true;
  }

  function rename(oldName, newName, kind) {
    const record = tabs.get(oldName);
    if (!record || tabs.has(newName)) return false;
    const entries = [...tabs.entries()];
    tabs.clear();
    for (const [fileName, item] of entries) {
      tabs.set(fileName === oldName ? newName : fileName, item);
    }
    record.kind = kind || record.kind;
    record.tab.id = createTabId(newName);
    record.tab.dataset.resource = newName;
    const icon = record.tab.querySelector(".editor-tab__icon");
    if (icon && kind) icon.textContent = kind;
    updateTabAccessibleName(record, newName);
    if (activeFile === oldName) activeFile = newName;
    synchronizeTabs();
    return true;
  }

  canvasTab.addEventListener("click", () => activate(""));
  canvasTab.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowRight" || tabs.size === 0) return;
    event.preventDefault();
    activate(tabs.keys().next().value, { focus: true });
  });

  activate("", { notify: false });

  return Object.freeze({
    open,
    close,
    clear,
    activate,
    rename,
    setDirty,
    showCanvas: () => activate(""),
    getActiveFile: () => activeFile,
    getOpenFiles: () => [...tabs.keys()]
  });
}
