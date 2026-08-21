const SPLIT_STORAGE_KEY = "creedSplitEditor.v1";

function readState(storage) {
  try {
    const value = JSON.parse(storage.getItem(SPLIT_STORAGE_KEY));
    if (!value || value.version !== 1 || typeof value !== "object") return null;
    return value;
  } catch {
    return null;
  }
}

function createSession(value = {}) {
  return {
    text: typeof value.text === "string" ? value.text : "",
    savedText: typeof value.savedText === "string" ? value.savedText : "",
    dirty: Boolean(value.dirty),
    scrollTop: Math.max(0, Number(value.scrollTop) || 0),
    scrollLeft: Math.max(0, Number(value.scrollLeft) || 0),
    selectionStart: Math.max(0, Number(value.selectionStart) || 0),
    selectionEnd: Math.max(0, Number(value.selectionEnd) || 0)
  };
}

export function bindSplitEditor({
  editorViewport,
  canvasView,
  sourceView,
  splitButton,
  workspace,
  getPrimaryActiveFile,
  notify,
  storage = localStorage
}) {
  const host = document.createElement("section");
  const toolbar = document.createElement("div");
  const fileSelect = document.createElement("select");
  const status = document.createElement("span");
  const saveButton = document.createElement("button");
  const closeButton = document.createElement("button");
  const editor = document.createElement("textarea");
  const sessions = new Map();
  let activeFile = "";
  let visible = false;
  let loadingGeneration = 0;

  host.id = "secondaryEditorGroup";
  host.setAttribute("aria-label", "Secondary editor group");
  host.hidden = true;
  Object.assign(host.style, {
    position: "absolute",
    inset: "0 0 0 50%",
    zIndex: "5",
    display: "flex",
    flexDirection: "column",
    minWidth: "0",
    minHeight: "0",
    borderLeft: "1px solid var(--border, #c8c8c8)",
    background: "var(--surface, #fff)"
  });

  toolbar.className = "toolbar";
  Object.assign(toolbar.style, { flex: "0 0 auto", minHeight: "32px", padding: "3px 6px" });
  fileSelect.id = "secondaryEditorFileSelect";
  fileSelect.setAttribute("aria-label", "Secondary editor file");
  Object.assign(fileSelect.style, { flex: "1 1 auto", minWidth: "0" });
  status.id = "secondaryEditorStatus";
  status.className = "label";
  saveButton.type = "button";
  saveButton.textContent = "Save";
  saveButton.title = "Save secondary editor file (Ctrl/Cmd+S)";
  closeButton.type = "button";
  closeButton.textContent = "×";
  closeButton.title = "Close split editor";
  closeButton.setAttribute("aria-label", "Close split editor");
  toolbar.append(fileSelect, status, saveButton, closeButton);

  editor.id = "secondaryEditorText";
  editor.setAttribute("aria-label", "Secondary source editor");
  editor.spellcheck = false;
  Object.assign(editor.style, {
    flex: "1 1 auto",
    width: "100%",
    minWidth: "0",
    minHeight: "0",
    resize: "none",
    border: "0",
    outline: "none",
    padding: "10px 12px",
    fontFamily: "Consolas, 'Courier New', monospace",
    fontSize: "13px",
    lineHeight: "19px",
    whiteSpace: "pre",
    overflow: "auto",
    tabSize: "2",
    background: "transparent",
    color: "inherit"
  });
  host.append(toolbar, editor);
  editorViewport.append(host);

  function updateLayout() {
    host.hidden = !visible;
    const right = visible ? "50%" : "0";
    canvasView.style.right = right;
    sourceView.style.right = right;
    splitButton?.classList.toggle("is-active", visible);
    splitButton?.setAttribute("aria-pressed", String(visible));
  }

  function captureActive() {
    if (!activeFile) return null;
    const session = sessions.get(activeFile) || createSession();
    session.text = editor.value;
    session.dirty = session.text !== session.savedText;
    session.scrollTop = editor.scrollTop;
    session.scrollLeft = editor.scrollLeft;
    session.selectionStart = editor.selectionStart;
    session.selectionEnd = editor.selectionEnd;
    sessions.set(activeFile, session);
    return session;
  }

  function persist() {
    captureActive();
    const serializedSessions = {};
    for (const [fileName, session] of sessions) {
      if (!workspace.hasFile(fileName)) continue;
      serializedSessions[fileName] = { ...session };
    }
    try {
      storage.setItem(SPLIT_STORAGE_KEY, JSON.stringify({
        version: 1,
        visible,
        activeFile: workspace.hasFile(activeFile) ? activeFile : "",
        sessions: serializedSessions
      }));
      return true;
    } catch {
      return false;
    }
  }

  function updateStatus() {
    const session = activeFile ? sessions.get(activeFile) : null;
    status.textContent = session?.dirty ? "● Unsaved" : activeFile ? "Saved" : "";
    saveButton.disabled = !session?.dirty;
    saveButton.setAttribute("aria-disabled", String(saveButton.disabled));
  }

  function refreshFiles() {
    const files = workspace.listFiles();
    const fragment = document.createDocumentFragment();
    for (const fileName of files) {
      const option = document.createElement("option");
      option.value = fileName;
      option.textContent = fileName;
      option.selected = fileName === activeFile;
      fragment.append(option);
    }
    fileSelect.replaceChildren(fragment);
    if (activeFile && !workspace.hasFile(activeFile)) {
      activeFile = "";
      editor.value = "";
    }
    return files;
  }

  async function openFile(fileName, { focus = false } = {}) {
    if (!workspace.hasFile(fileName)) return false;
    captureActive();
    const generation = ++loadingGeneration;
    activeFile = fileName;
    fileSelect.value = fileName;
    let session = sessions.get(fileName);
    if (!session) {
      const source = await workspace.readFile(fileName);
      if (generation !== loadingGeneration || activeFile !== fileName) return false;
      session = createSession({ text: source, savedText: source });
      sessions.set(fileName, session);
    }
    editor.value = session.text;
    editor.scrollTop = session.scrollTop;
    editor.scrollLeft = session.scrollLeft;
    const max = editor.value.length;
    editor.setSelectionRange(Math.min(max, session.selectionStart), Math.min(max, session.selectionEnd));
    updateStatus();
    persist();
    if (focus) editor.focus();
    return true;
  }

  async function saveActive() {
    if (!activeFile || !workspace.hasFile(activeFile)) return false;
    const session = captureActive();
    if (!session?.dirty) return false;
    workspace.writeFile(activeFile, session.text);
    session.savedText = session.text;
    session.dirty = false;
    sessions.set(activeFile, session);
    updateStatus();
    persist();
    notify?.("Saved split editor: " + activeFile);
    return true;
  }

  async function setVisible(nextVisible, { focus = true } = {}) {
    visible = Boolean(nextVisible);
    updateLayout();
    if (!visible) {
      persist();
      return true;
    }
    const files = refreshFiles();
    const preferred = workspace.hasFile(activeFile)
      ? activeFile
      : workspace.hasFile(getPrimaryActiveFile?.())
        ? getPrimaryActiveFile()
        : files[0] || "";
    if (preferred) await openFile(preferred, { focus });
    persist();
    return true;
  }

  function close() {
    return setVisible(false);
  }

  editor.addEventListener("input", () => {
    if (!activeFile) return;
    const session = sessions.get(activeFile) || createSession();
    session.text = editor.value;
    session.dirty = session.text !== session.savedText;
    sessions.set(activeFile, session);
    updateStatus();
    persist();
  });
  editor.addEventListener("scroll", persist, { passive: true });
  editor.addEventListener("select", persist);
  editor.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      saveActive().catch((error) => notify?.(error instanceof Error ? error.message : String(error)));
    }
    if (event.key === "Tab") {
      event.preventDefault();
      const start = editor.selectionStart;
      const end = editor.selectionEnd;
      if (event.shiftKey) {
        const lineStart = editor.value.lastIndexOf("\n", start - 1) + 1;
        const removable = editor.value.slice(lineStart, lineStart + 2).match(/^ {1,2}/)?.[0] || "";
        if (removable) {
          editor.setRangeText("", lineStart, lineStart + removable.length, "preserve");
          editor.setSelectionRange(Math.max(lineStart, start - removable.length), Math.max(lineStart, end - removable.length));
        }
      } else {
        editor.setRangeText("  ", start, end, "end");
      }
      editor.dispatchEvent(new Event("input", { bubbles: true }));
    }
  });
  fileSelect.addEventListener("change", () => {
    openFile(fileSelect.value, { focus: true }).catch((error) => notify?.(error instanceof Error ? error.message : String(error)));
  });
  saveButton.addEventListener("click", () => {
    saveActive().catch((error) => notify?.(error instanceof Error ? error.message : String(error)));
  });
  closeButton.addEventListener("click", close);
  splitButton?.addEventListener("click", () => {
    setVisible(!visible).catch((error) => notify?.(error instanceof Error ? error.message : String(error)));
  });

  workspace.subscribe(async (change) => {
    refreshFiles();
    if (!activeFile) return;
    if (!workspace.hasFile(activeFile)) {
      sessions.delete(activeFile);
      const files = workspace.listFiles();
      activeFile = "";
      if (visible && files[0]) await openFile(files[0]);
      persist();
      return;
    }
    const session = sessions.get(activeFile);
    if (change.path === activeFile && change.type === "file-written" && session && !session.dirty && document.activeElement !== editor) {
      const source = await workspace.readFile(activeFile);
      session.text = source;
      session.savedText = source;
      editor.value = source;
      updateStatus();
      persist();
    }
  });

  window.addEventListener("pagehide", persist);

  const restored = readState(storage);
  if (restored?.sessions && typeof restored.sessions === "object") {
    for (const [fileName, value] of Object.entries(restored.sessions)) {
      if (workspace.hasFile(fileName)) sessions.set(fileName, createSession(value));
    }
  }
  activeFile = restored?.activeFile && workspace.hasFile(restored.activeFile) ? restored.activeFile : "";
  visible = Boolean(restored?.visible);
  refreshFiles();
  updateLayout();
  if (visible) setVisible(true, { focus: false }).catch(() => {});

  return Object.freeze({
    setVisible,
    open: () => setVisible(true),
    close,
    openFile,
    saveActive,
    isVisible: () => visible,
    getActiveFile: () => activeFile,
    getState: () => ({
      visible,
      activeFile,
      dirty: Boolean(sessions.get(activeFile)?.dirty),
      sessionCount: sessions.size
    }),
    persist
  });
}
