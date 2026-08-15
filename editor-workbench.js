import { getFileName, getLanguageInfo } from "./source-language.js";

function parseHash(hash) {
  const params = new URLSearchParams(String(hash || "").replace(/^#/, ""));
  const file = params.get("file");
  return file
    ? { type: "file", path: file, line: Number(params.get("line")) || 1, column: Number(params.get("column")) || 1 }
    : { type: params.has("preview") ? "preview" : "canvas" };
}

function positionFromOffset(source, offset) {
  const before = source.slice(0, Math.max(0, offset)).split("\n");
  return { line: before.length, column: before.at(-1).length + 1 };
}

function offsetsForQuery(source, query, caseSensitive) {
  if (!query) return [];
  const haystack = caseSensitive ? source : source.toLowerCase();
  const needle = caseSensitive ? query : query.toLowerCase();
  const offsets = [];
  let offset = haystack.indexOf(needle);
  while (offset >= 0) {
    offsets.push(offset);
    offset = haystack.indexOf(needle, offset + Math.max(1, needle.length));
  }
  return offsets;
}

export function bindEditorWorkbench({
  store,
  canvasTab,
  tabsContainer,
  canvasView,
  codeView,
  previewView,
  codeContent,
  editorInput,
  renderer,
  breadcrumbKind,
  breadcrumbName,
  chatContextKind,
  chatContextName,
  statusLanguage,
  statusCursor,
  statusIndentation,
  previewModeButton,
  editModeButton,
  saveButton,
  runButton,
  moreButton,
  backButton,
  forwardButton,
  findBar,
  findInput,
  replaceInput,
  findPreviousButton,
  findNextButton,
  replaceButton,
  replaceAllButton,
  findCount,
  findCloseButton,
  onCanvasShow,
  onRun,
  onOpenCommands,
  onActiveChange,
  onSessionChange,
  notify
}) {
  const tabs = [];
  const recentlyClosed = [];
  const navigation = [];
  let navigationIndex = -1;
  let active = { type: "canvas" };
  let loadVersion = 0;
  let findOffsets = [];
  let findIndex = -1;

  function activeTab() {
    return active.type === "file" ? tabs.find((tab) => tab.path === active.path) || null : null;
  }

  function setHash(target) {
    if (target.type === "file") {
      const params = new URLSearchParams({ file: target.path });
      if (target.line > 1) params.set("line", String(target.line));
      if (target.column > 1) params.set("column", String(target.column));
      history.replaceState(null, "", "#" + params);
    } else {
      history.replaceState(null, "", target.type === "preview" ? "#preview" : "#canvas");
    }
  }

  function pushNavigation(target) {
    const previous = navigation[navigationIndex];
    if (previous && previous.type === target.type && previous.path === target.path && previous.line === target.line) return;
    navigation.splice(navigationIndex + 1);
    navigation.push({ ...target });
    navigationIndex = navigation.length - 1;
    updateNavigationButtons();
  }

  function updateNavigationButtons() {
    backButton.disabled = navigationIndex <= 0;
    forwardButton.disabled = navigationIndex < 0 || navigationIndex >= navigation.length - 1;
  }

  function setContext(kind, name, language) {
    breadcrumbKind.textContent = kind;
    breadcrumbName.textContent = name;
    chatContextKind.textContent = kind;
    chatContextName.textContent = name;
    statusLanguage.textContent = language;
  }

  function updateModeControls() {
    const tab = activeTab();
    const enabled = Boolean(tab);
    previewModeButton.disabled = !enabled;
    editModeButton.disabled = !enabled;
    saveButton.disabled = !enabled || !tab.bufferDirty;
    previewModeButton.setAttribute("aria-pressed", String(enabled && tab.mode === "preview"));
    editModeButton.setAttribute("aria-pressed", String(enabled && tab.mode === "edit"));
  }

  function updateCursor() {
    const tab = activeTab();
    if (!tab) {
      statusCursor.textContent = "Line 1, Column 1";
      statusIndentation.textContent = "Spaces: 2";
      return;
    }
    const source = tab.buffer ?? "";
    const position = tab.mode === "edit"
      ? positionFromOffset(source, editorInput.selectionStart)
      : { line: tab.line || 1, column: tab.column || 1 };
    if (tab.mode === "edit") tab.selectionStart = editorInput.selectionStart;
    tab.line = position.line;
    tab.column = position.column;
    statusCursor.textContent = `Line ${position.line}, Column ${position.column}`;
    const indentation = source.match(/\n( +)\S/)?.[1]?.length || 2;
    statusIndentation.textContent = `Spaces: ${indentation}`;
  }

  function createTabElement(tab) {
    const info = tab.type === "preview" ? { kind: "▷" } : getLanguageInfo(tab.path);
    const element = document.createElement("div");
    element.className = "editor-file-tab";
    element.classList.toggle("active", active.type === tab.type && (tab.type !== "file" || active.path === tab.path));
    element.role = "tab";
    element.setAttribute("aria-controls", tab.type === "preview" ? "previewEditorView" : "codeEditorView");
    element.tabIndex = 0;
    element.setAttribute("aria-selected", String(element.classList.contains("active")));
    element.title = tab.type === "preview" ? "Workspace Preview" : tab.path;
    const kind = document.createElement("span");
    kind.className = "file-kind";
    kind.textContent = info.kind;
    const name = document.createElement("span");
    name.className = "editor-file-tab__name";
    name.textContent = tab.type === "preview" ? "Preview" : getFileName(tab.path);
    const state = document.createElement("span");
    state.className = tab.bufferDirty ? "editor-file-tab__dirty" : "editor-file-tab__pin";
    state.textContent = tab.bufferDirty ? "●" : tab.pinned ? "◆" : "";
    state.title = tab.bufferDirty ? "Unsaved buffer" : tab.pinned ? "Pinned tab" : "";
    const pin = document.createElement("button");
    pin.className = "editor-file-tab__close";
    pin.type = "button";
    pin.title = tab.pinned ? "Unpin tab" : "Pin tab";
    pin.setAttribute("aria-label", pin.title);
    pin.textContent = tab.pinned ? "◇" : "♧";
    pin.addEventListener("click", (event) => {
      event.stopPropagation();
      tab.pinned = !tab.pinned;
      renderTabs();
    });
    const close = document.createElement("button");
    close.className = "editor-file-tab__close";
    close.type = "button";
    close.title = "Close tab";
    close.setAttribute("aria-label", `Close ${tab.type === "preview" ? "Preview" : tab.path}`);
    close.textContent = "×";
    close.addEventListener("click", (event) => {
      event.stopPropagation();
      closeTab(tab);
    });
    const activate = () => tab.type === "preview" ? showPreview() : openFile(tab.path, { line: tab.line, column: tab.column });
    element.addEventListener("click", activate);
    element.addEventListener("dblclick", () => { tab.pinned = true; renderTabs(); });
    element.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); activate(); }
    });
    element.append(kind, name, state, pin, close);
    return element;
  }

  function renderTabs() {
    const fragment = document.createDocumentFragment();
    tabs.forEach((tab) => fragment.append(createTabElement(tab)));
    tabsContainer.replaceChildren(fragment);
    canvasTab.classList.toggle("active", active.type === "canvas");
    canvasTab.setAttribute("aria-selected", String(active.type === "canvas"));
    updateModeControls();
    onSessionChange?.();
  }

  function showOnly(view) {
    canvasView.hidden = view !== canvasView;
    codeView.hidden = view !== codeView;
    previewView.hidden = view !== previewView;
  }

  function showCanvas({ recordHistory = true } = {}) {
    loadVersion += 1;
    active = { type: "canvas" };
    showOnly(canvasView);
    setContext("◇", "Infinite Canvas", "{ } Canvas");
    findBar.hidden = true;
    renderTabs();
    updateCursor();
    setHash(active);
    if (recordHistory) pushNavigation(active);
    onActiveChange?.(active);
    onCanvasShow?.();
  }

  function syncEditorFromTab(tab) {
    if (tab.mode === "edit") {
      codeContent.hidden = true;
      editorInput.hidden = false;
      editorInput.value = tab.buffer;
      requestAnimationFrame(() => {
        const offset = Math.min(tab.buffer.length, tab.selectionStart || 0);
        editorInput.setSelectionRange(offset, offset);
        editorInput.focus();
        updateCursor();
      });
    } else {
      editorInput.hidden = true;
      codeContent.hidden = false;
      renderer.setSource(tab.buffer, tab.path, tab.line || 1);
    }
    updateModeControls();
  }

  async function openFile(path, { line = 1, column = 1, edit = false, recordHistory = true } = {}) {
    const request = ++loadVersion;
    let tab = tabs.find((candidate) => candidate.type === "file" && candidate.path === path);
    if (!tab) {
      tab = { type: "file", path, pinned: false, mode: edit ? "edit" : "preview", buffer: null, bufferDirty: false, line, column, selectionStart: 0 };
      const previewIndex = tabs.findIndex((candidate) => candidate.type === "preview");
      if (previewIndex < 0) tabs.push(tab);
      else tabs.splice(previewIndex, 0, tab);
    }
    active = { type: "file", path };
    showOnly(codeView);
    const info = getLanguageInfo(path);
    setContext(info.kind, path, info.label);
    codeContent.setAttribute("aria-busy", "true");
    codeContent.textContent = "Loading…";
    renderTabs();
    try {
      if (tab.buffer === null) tab.buffer = await store.readFile(path);
      if (request !== loadVersion || active.path !== path) return;
      tab.line = Math.max(1, Number(line) || 1);
      tab.column = Math.max(1, Number(column) || 1);
      if (edit) tab.mode = "edit";
      syncEditorFromTab(tab);
      setHash({ type: "file", path, line: tab.line, column: tab.column });
      if (recordHistory) pushNavigation({ type: "file", path, line: tab.line, column: tab.column });
      onActiveChange?.({ type: "file", path, line: tab.line, column: tab.column });
    } catch (error) {
      if (request !== loadVersion) return;
      codeContent.textContent = `Unable to display ${path}.`;
      notify?.(error.message);
    } finally {
      if (request === loadVersion) codeContent.removeAttribute("aria-busy");
    }
  }

  function showPreview({ recordHistory = true } = {}) {
    loadVersion += 1;
    let tab = tabs.find((candidate) => candidate.type === "preview");
    if (!tab) {
      tab = { type: "preview", pinned: true };
      tabs.push(tab);
    }
    active = { type: "preview" };
    showOnly(previewView);
    setContext("▷", "Workspace Preview", "Preview");
    findBar.hidden = true;
    renderTabs();
    updateCursor();
    setHash(active);
    if (recordHistory) pushNavigation(active);
    onActiveChange?.(active);
  }

  function closeTab(tab, { force = false } = {}) {
    if (tab.bufferDirty && !force && !window.confirm(`Close ${tab.path} with unsaved buffer changes?`)) return false;
    const index = tabs.indexOf(tab);
    if (index < 0) return false;
    tabs.splice(index, 1);
    if (tab.type === "file") recentlyClosed.unshift({ path: tab.path, line: tab.line, column: tab.column });
    if (recentlyClosed.length > 20) recentlyClosed.pop();
    const wasActive = active.type === tab.type && (tab.type !== "file" || active.path === tab.path);
    if (wasActive) {
      const next = tabs[Math.min(index, tabs.length - 1)];
      if (next?.type === "file") openFile(next.path);
      else if (next?.type === "preview") showPreview();
      else showCanvas();
    } else renderTabs();
    return true;
  }

  function setMode(mode) {
    const tab = activeTab();
    if (!tab || !["preview", "edit"].includes(mode)) return;
    if (tab.mode === "edit") {
      tab.selectionStart = editorInput.selectionStart;
      tab.buffer = editorInput.value;
    }
    tab.mode = mode;
    syncEditorFromTab(tab);
  }

  function saveActive() {
    const tab = activeTab();
    if (!tab) return false;
    if (tab.mode === "edit") tab.buffer = editorInput.value;
    store.writeFile(tab.path, tab.buffer);
    tab.bufferDirty = false;
    renderTabs();
    updateModeControls();
    notify?.(`Saved ${tab.path} to the browser workspace`);
    return true;
  }

  function updateFind() {
    const tab = activeTab();
    findOffsets = tab ? offsetsForQuery(tab.buffer, findInput.value, false) : [];
    findIndex = findOffsets.length ? Math.min(Math.max(0, findIndex), findOffsets.length - 1) : -1;
    findCount.textContent = findOffsets.length ? `${findIndex + 1} of ${findOffsets.length}` : "0 results";
  }

  function selectFind(direction = 1) {
    const tab = activeTab();
    if (!tab) return;
    updateFind();
    if (!findOffsets.length) return;
    findIndex = (findIndex + direction + findOffsets.length) % findOffsets.length;
    const offset = findOffsets[findIndex];
    tab.mode = "edit";
    syncEditorFromTab(tab);
    editorInput.setSelectionRange(offset, offset + findInput.value.length);
    editorInput.focus();
    findCount.textContent = `${findIndex + 1} of ${findOffsets.length}`;
    updateCursor();
  }

  function openFind() {
    if (!activeTab()) return;
    findBar.hidden = false;
    findInput.focus();
    findInput.select();
    updateFind();
  }

  function replaceCurrent() {
    const tab = activeTab();
    if (!tab || editorInput.selectionStart === editorInput.selectionEnd) return;
    editorInput.setRangeText(replaceInput.value, editorInput.selectionStart, editorInput.selectionEnd, "end");
    editorInput.dispatchEvent(new Event("input", { bubbles: true }));
    updateFind();
  }

  function replaceAllInActive() {
    const tab = activeTab();
    if (!tab || !findInput.value) return;
    const count = offsetsForQuery(tab.buffer, findInput.value, false).length;
    tab.buffer = tab.buffer.replace(new RegExp(findInput.value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), replaceInput.value);
    tab.bufferDirty = true;
    tab.mode = "edit";
    syncEditorFromTab(tab);
    renderTabs();
    updateFind();
    notify?.(`Replaced ${count} matches in ${tab.path}`);
  }

  function navigateTo(target) {
    if (target.type === "file") openFile(target.path, { line: target.line, column: target.column, recordHistory: false });
    else if (target.type === "preview") showPreview({ recordHistory: false });
    else showCanvas({ recordHistory: false });
    updateNavigationButtons();
  }

  function goBack() {
    if (navigationIndex <= 0) return;
    navigationIndex -= 1;
    navigateTo(navigation[navigationIndex]);
  }

  function goForward() {
    if (navigationIndex >= navigation.length - 1) return;
    navigationIndex += 1;
    navigateTo(navigation[navigationIndex]);
  }

  editorInput.addEventListener("input", () => {
    const tab = activeTab();
    if (!tab) return;
    tab.buffer = editorInput.value;
    tab.bufferDirty = true;
    tab.selectionStart = editorInput.selectionStart;
    renderTabs();
    updateCursor();
    updateFind();
  });
  editorInput.addEventListener("keyup", updateCursor);
  editorInput.addEventListener("click", updateCursor);
  editorInput.addEventListener("keydown", (event) => {
    if (event.key === "Tab") {
      event.preventDefault();
      editorInput.setRangeText("  ", editorInput.selectionStart, editorInput.selectionEnd, "end");
      editorInput.dispatchEvent(new Event("input", { bubbles: true }));
    }
  });
  canvasTab.addEventListener("click", () => showCanvas());
  previewModeButton.addEventListener("click", () => setMode("preview"));
  editModeButton.addEventListener("click", () => setMode("edit"));
  saveButton.addEventListener("click", saveActive);
  runButton.addEventListener("click", () => onRun?.());
  moreButton.addEventListener("click", () => onOpenCommands?.());
  backButton.addEventListener("click", goBack);
  forwardButton.addEventListener("click", goForward);
  findInput.addEventListener("input", updateFind);
  findInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") { event.preventDefault(); selectFind(event.shiftKey ? -1 : 1); }
    if (event.key === "Escape") findBar.hidden = true;
  });
  findPreviousButton.addEventListener("click", () => selectFind(-1));
  findNextButton.addEventListener("click", () => selectFind(1));
  replaceButton.addEventListener("click", replaceCurrent);
  replaceAllButton.addEventListener("click", replaceAllInActive);
  findCloseButton.addEventListener("click", () => { findBar.hidden = true; });
  window.addEventListener("keydown", (event) => {
    const modifier = event.ctrlKey || event.metaKey;
    if (modifier && event.key.toLowerCase() === "s") { event.preventDefault(); saveActive(); }
    if (modifier && event.key.toLowerCase() === "f" && active.type === "file") { event.preventDefault(); openFind(); }
    if (modifier && event.shiftKey && event.key.toLowerCase() === "t" && recentlyClosed.length) {
      event.preventDefault();
      const closed = recentlyClosed.shift();
      openFile(closed.path, closed);
    }
  });

  store.subscribe((event) => {
    if (event.type === "rename") {
      const tab = tabs.find((candidate) => candidate.type === "file" && candidate.path === event.from);
      if (tab) {
        tab.path = event.to;
        if (active.type === "file" && active.path === event.from) active.path = event.to;
        renderTabs();
      }
      return;
    }
    if (event.type === "rename-folder") {
      tabs.filter((tab) => tab.type === "file" && tab.path.startsWith(event.from + "/")).forEach((tab) => {
        const previous = tab.path;
        tab.path = event.to + tab.path.slice(event.from.length);
        if (active.type === "file" && active.path === previous) active.path = tab.path;
      });
      renderTabs();
      return;
    }
    if (event.type === "delete") {
      const tab = tabs.find((candidate) => candidate.type === "file" && candidate.path === event.path);
      if (tab) closeTab(tab, { force: true });
      return;
    }
    if (event.type === "delete-folder") {
      const deleted = new Set(event.files || []);
      [...tabs].filter((tab) => tab.type === "file" && deleted.has(tab.path)).forEach((tab) => closeTab(tab, { force: true }));
      return;
    }
    if (["write", "discard"].includes(event.type)) {
      const tab = tabs.find((candidate) => candidate.type === "file" && candidate.path === event.path);
      if (!tab || tab.bufferDirty) return;
      const record = store.getFile(event.path);
      if (!record || record.deleted) {
        closeTab(tab, { force: true });
        return;
      }
      if (record.loaded) {
        tab.buffer = record.content;
        if (active.type === "file" && active.path === tab.path) syncEditorFromTab(tab);
      }
    }
    if (event.type === "discard-all") {
      tabs.filter((tab) => tab.type === "file" && !tab.bufferDirty).forEach((tab) => {
        const record = store.getFile(tab.path);
        if (record?.loaded) tab.buffer = record.content;
      });
      const tab = activeTab();
      if (tab && !tab.bufferDirty) syncEditorFromTab(tab);
    }
  });

  const initial = parseHash(location.hash);
  if (initial.type === "file" && store.getFile(initial.path)) openFile(initial.path, initial);
  else if (initial.type === "preview") showPreview();
  else showCanvas();

  return Object.freeze({
    showCanvas,
    showCode: () => activeTab() && openFile(active.path),
    showPreview,
    openFile,
    closePaths(paths) {
      const targets = new Set(paths);
      [...tabs].filter((tab) => tab.type === "file" && targets.has(tab.path)).forEach((tab) => closeTab(tab, { force: true }));
    },
    renamePath(from, to) {
      const tab = tabs.find((candidate) => candidate.type === "file" && candidate.path === from);
      if (!tab) return;
      tab.path = to;
      if (active.type === "file" && active.path === from) active.path = to;
      renderTabs();
    },
    saveActive,
    setMode,
    openFind,
    goBack,
    goForward,
    getActive: () => ({ ...active }),
    getActiveFile: () => activeTab()?.path || "",
    getActiveBuffer: () => activeTab()?.buffer ?? "",
    getTabs: () => tabs.map((tab) => ({ type: tab.type, path: tab.path, pinned: tab.pinned, dirty: Boolean(tab.bufferDirty) })),
    getSession: () => ({
      format: "creed-editor-session",
      version: 1,
      active: active.type === "file" ? {
        ...active,
        line: activeTab()?.line || 1,
        column: activeTab()?.column || 1
      } : { ...active },
      tabs: tabs.map((tab) => tab.type === "preview" ? {
        type: "preview",
        pinned: tab.pinned === true
      } : {
        type: "file",
        path: tab.path,
        pinned: tab.pinned === true,
        mode: tab.mode,
        line: tab.line || 1,
        column: tab.column || 1,
        selectionStart: tab.selectionStart || 0,
        bufferDirty: tab.bufferDirty === true,
        ...(tab.bufferDirty ? { buffer: tab.buffer } : {})
      }),
      recentlyClosed: recentlyClosed.slice(0, 20).map((item) => ({ ...item }))
    }),
    async restoreSession(session) {
      if (!session || session.format !== "creed-editor-session" || session.version !== 1 || !Array.isArray(session.tabs)) return false;
      tabs.length = 0;
      recentlyClosed.splice(0, recentlyClosed.length, ...(Array.isArray(session.recentlyClosed) ? session.recentlyClosed.slice(0, 20) : []));
      for (const saved of session.tabs.slice(0, 30)) {
        if (saved?.type === "preview") {
          tabs.push({ type: "preview", pinned: saved.pinned !== false });
          continue;
        }
        if (saved?.type !== "file" || typeof saved.path !== "string") continue;
        const record = store.getFile(saved.path);
        if (!record || record.deleted) continue;
        let buffer = null;
        if (saved.bufferDirty && typeof saved.buffer === "string") buffer = saved.buffer;
        else {
          try { buffer = await store.readFile(saved.path); } catch { continue; }
        }
        tabs.push({
          type: "file",
          path: saved.path,
          pinned: saved.pinned === true,
          mode: saved.mode === "edit" ? "edit" : "preview",
          buffer,
          bufferDirty: saved.bufferDirty === true,
          line: Math.max(1, Number(saved.line) || 1),
          column: Math.max(1, Number(saved.column) || 1),
          selectionStart: Math.max(0, Number(saved.selectionStart) || 0)
        });
      }
      const savedActive = session.active || { type: "canvas" };
      if (savedActive.type === "file" && tabs.some((tab) => tab.type === "file" && tab.path === savedActive.path)) {
        await openFile(savedActive.path, { line: savedActive.line, column: savedActive.column, recordHistory: false });
      } else if (savedActive.type === "preview" && tabs.some((tab) => tab.type === "preview")) {
        showPreview({ recordHistory: false });
      } else showCanvas({ recordHistory: false });
      renderTabs();
      return true;
    },
    reopenClosed() {
      const closed = recentlyClosed.shift();
      if (closed) openFile(closed.path, closed);
    }
  });
}
