import { createIcon } from "./icons.js?v=20260818-1";

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
      if (fileName) {
        activeTab.scrollIntoView({ block: "nearest", inline: "nearest" });
      }
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

  function focusRelative(fileName, direction) {
    const sequence = ["", ...tabs.keys()];
    const currentIndex = sequence.indexOf(fileName);
    const nextIndex = (currentIndex + direction + sequence.length) % sequence.length;
    activate(sequence[nextIndex], { focus: true });
  }

  function createFileTab(fileName, kind) {
    const tab = document.createElement("div");
    const icon = document.createElement("span");
    const label = document.createElement("span");
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

    closeButton.className = "editor-tab__close";
    closeButton.type = "button";
    closeButton.title = "Close " + fileName;
    closeButton.setAttribute("aria-label", "Close " + fileName);
    closeButton.append(createIcon("close"));

    tab.append(icon, label, closeButton);
    tab.addEventListener("click", (event) => {
      if (event.target.closest(".editor-tab__close")) return;
      activate(fileName);
    });
    tab.addEventListener("auxclick", (event) => {
      if (event.button !== 1) return;
      event.preventDefault();
      close(fileName);
    });
    tab.addEventListener("keydown", (event) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        focusRelative(fileName, -1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        focusRelative(fileName, 1);
      } else if (event.key === "Home") {
        event.preventDefault();
        activate("", { focus: true });
      } else if (event.key === "End") {
        event.preventDefault();
        const lastFile = [...tabs.keys()].at(-1) || "";
        activate(lastFile, { focus: true });
      } else if (event.key === "Delete") {
        event.preventDefault();
        close(fileName);
      } else if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        activate(fileName);
      }
    });
    closeButton.addEventListener("click", (event) => {
      event.stopPropagation();
      close(fileName);
    });

    container.append(tab);
    tabs.set(fileName, { tab, kind });
    return tab;
  }

  function open(fileName, kind) {
    if (!tabs.has(fileName)) createFileTab(fileName, kind);
    activate(fileName);
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
    activate,
    showCanvas: () => activate(""),
    getActiveFile: () => activeFile,
    getOpenFiles: () => [...tabs.keys()]
  });
}
