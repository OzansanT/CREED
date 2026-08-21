import { createEditorBufferStore } from "./editor-buffer-store.js";
import { bindEditorEditing } from "./editor-editing.js";
import { createEditorSessionStore } from "./editor-session-state.js";
import {
  clearEditorWorkspace,
  loadEditorWorkspace,
  saveEditorWorkspace
} from "./editor-workspace-storage.js";
import { createEditorTabs } from "./editor-tabs.js";
import { createExplorerController } from "./explorer-controller.js";
import { bindExplorerFileActions } from "./explorer-file-actions.js";
import { getFileKind, getLanguageLabel } from "./file-metadata.js";
import { createMinimapController } from "./minimap-controller.js";
import { createSourceLoader } from "./source-loader.js";
import { bindSourceNavigation } from "./source-navigation.js";
import { createSourceViewport } from "./source-viewport.js";
import { createWorkspaceFileSystem } from "./workspace-fs.js";

const EDITOR_WORKSPACE_PERSIST_DELAY_MS = 180;

export function bindWorkbenchFiles({
  rootToggle,
  fileTree,
  newFileButton,
  newFolderButton,
  refreshExplorerButton,
  fileTabs,
  canvasTab,
  breadcrumbKind,
  breadcrumbName,
  canvasView,
  codeView,
  sourceScroller,
  codeContent,
  codeMinimap,
  chatContextKind,
  chatContextName,
  statusLanguage,
  onCanvasShow,
  onError,
  onNotify
}) {
  let activeFile = "";
  let baseStatusLanguage = "{ } Canvas";
  let tabs = null;
  let persistTimer = 0;
  let restoringWorkspace = true;

  const workspace = createWorkspaceFileSystem();
  const buffers = createEditorBufferStore();

  function setNavigationStatus(status) {
    statusLanguage.textContent = status ? baseStatusLanguage + " · " + status : baseStatusLanguage;
  }

  function setFileContext(kind, name, language) {
    baseStatusLanguage = language;
    breadcrumbKind.textContent = kind;
    breadcrumbName.textContent = name;
    chatContextKind.textContent = kind;
    chatContextName.textContent = name;
    setNavigationStatus("");
  }

  const minimap = createMinimapController({ minimap: codeMinimap, scroller: sourceScroller });
  const sourceViewport = createSourceViewport({ target: codeContent, minimap: codeMinimap, scroller: sourceScroller });
  const sourceNavigation = bindSourceNavigation({
    host: sourceScroller.parentElement,
    viewport: sourceViewport,
    isSourceActive: () => Boolean(activeFile) && !codeView.hidden,
    getActiveFile: () => activeFile,
    onStatus: setNavigationStatus
  });
  const sessions = createEditorSessionStore();
  const explorer = createExplorerController({
    rootToggle,
    fileTree,
    getFiles: workspace.listFiles,
    getDirectories: workspace.listDirectories,
    onOpen: (fileName) => tabs?.open(fileName, getFileKind(fileName))
  });

  function captureActiveSession() {
    if (!activeFile) return null;
    return sessions.save(activeFile, {
      viewport: {
        scrollTop: sourceScroller.scrollTop,
        scrollLeft: sourceScroller.scrollLeft
      },
      navigation: sourceNavigation.getSessionState()
    });
  }

  function persistenceOptions() {
    return { validFiles: workspace.listFiles() };
  }

  function persistEditorWorkspace() {
    if (!tabs) return false;
    captureActiveSession();
    const openFiles = tabs.getOpenFiles();
    const sessionSnapshot = Object.fromEntries(openFiles.map((fileName) => [
      fileName,
      sessions.get(fileName) || {}
    ]));
    return saveEditorWorkspace({
      openFiles,
      activeFile: tabs.getActiveFile(),
      sessions: sessionSnapshot
    }, persistenceOptions());
  }

  function flushEditorWorkspace() {
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = 0;
    editing.flush();
    if (restoringWorkspace) return false;
    return persistEditorWorkspace();
  }

  function scheduleEditorWorkspacePersist() {
    if (restoringWorkspace || !tabs) return;
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = window.setTimeout(() => {
      persistTimer = 0;
      persistEditorWorkspace();
    }, EDITOR_WORKSPACE_PERSIST_DELAY_MS);
  }

  async function restoreFileSession(fileName) {
    const session = sessions.get(fileName);
    if (!session) {
      sourceScroller.scrollTop = 0;
      sourceScroller.scrollLeft = 0;
      return true;
    }

    await sourceNavigation.restoreSessionState(session.navigation);
    if (activeFile !== fileName) return false;
    sourceScroller.scrollTop = session.viewport.scrollTop;
    sourceScroller.scrollLeft = session.viewport.scrollLeft;
    sourceViewport.refresh();
    return true;
  }

  function showCanvasPanel() {
    captureActiveSession();
    editing.setActiveFile("");
    sourceNavigation.reset();
    activeFile = "";
    sourceViewport.clear();
    codeContent.removeAttribute("aria-busy");
    canvasView.hidden = false;
    codeView.hidden = true;
    explorer.setSelected("");
    setFileContext("◇", "Infinite Canvas", "{ } Canvas");
    onCanvasShow?.();
    scheduleEditorWorkspacePersist();
  }

  async function renderLoadedFile(fileName, source) {
    if (activeFile !== fileName) return;
    codeContent.setAttribute("aria-busy", "true");
    codeContent.textContent = "Indexing…";
    sourceScroller.scrollTop = 0;
    sourceScroller.scrollLeft = 0;
    try {
      await editing.hydrate(fileName, source);
      if (activeFile !== fileName) return;
      const restored = await restoreFileSession(fileName);
      if (!restored || activeFile !== fileName) return;
      codeContent.removeAttribute("aria-busy");
      requestAnimationFrame(() => {
        sourceViewport.refresh();
        minimap.updateViewport();
      });
      scheduleEditorWorkspacePersist();
    } catch (error) {
      if (activeFile !== fileName) return;
      sourceNavigation.reset();
      sourceViewport.clear();
      codeContent.removeAttribute("aria-busy");
      codeContent.textContent = "Unable to index " + fileName + ".";
      onError?.(error instanceof Error ? error.message : String(error));
    }
  }

  const sourceLoader = createSourceLoader({
    readFile: workspace.readFile,
    onLoading: (fileName) => {
      if (activeFile !== fileName) return;
      sourceNavigation.reset();
      sourceViewport.clear();
      sourceScroller.scrollTop = 0;
      sourceScroller.scrollLeft = 0;
      codeContent.setAttribute("aria-busy", "true");
      codeContent.textContent = "Loading…";
    },
    onLoaded: renderLoadedFile,
    onError: (fileName, message) => {
      if (activeFile === fileName) {
        sourceNavigation.reset();
        sourceViewport.clear();
        codeContent.removeAttribute("aria-busy");
        codeContent.textContent = "Unable to display " + fileName + ".";
      }
      onError?.(message);
    }
  });

  const editing = bindEditorEditing({
    sourceContent: codeContent,
    sourceScroller,
    sourceViewport,
    workspace,
    buffers,
    onDirtyChange: (fileName, dirty) => tabs?.setDirty(fileName, dirty),
    onSaved: (fileName, text) => {
      sourceLoader.set(fileName, text);
      scheduleEditorWorkspacePersist();
      onNotify?.("Saved " + fileName);
    },
    onStatus: setNavigationStatus,
    onError
  });

  function showFilePanel(fileName) {
    if (!workspace.hasFile(fileName)) {
      onError?.("Workspace file not found: " + fileName);
      return;
    }
    if (activeFile === fileName && !codeView.hidden) return;
    captureActiveSession();
    editing.setActiveFile(fileName);
    sourceNavigation.reset();
    activeFile = fileName;
    sourceViewport.clear();
    sourceScroller.scrollTop = 0;
    sourceScroller.scrollLeft = 0;
    canvasView.hidden = true;
    codeView.hidden = false;
    explorer.setSelected(fileName, "file");
    setFileContext(getFileKind(fileName), fileName, getLanguageLabel(fileName));
    if (sourceLoader.has(fileName)) renderLoadedFile(fileName, sourceLoader.get(fileName));
    else sourceLoader.load(fileName);
    scheduleEditorWorkspacePersist();
  }

  tabs = createEditorTabs({
    container: fileTabs,
    canvasTab,
    codeView,
    onActivate: (fileName) => fileName ? showFilePanel(fileName) : showCanvasPanel(),
    onClose: (fileName) => {
      if (activeFile === fileName) {
        sourceNavigation.reset();
        editing.setActiveFile("");
        activeFile = "";
        sourceViewport.clear();
        codeContent.removeAttribute("aria-busy");
      }
      sessions.remove(fileName);
      sourceLoader.release(fileName);
      sourceViewport.release(fileName);
      buffers.remove(fileName);
      scheduleEditorWorkspacePersist();
    }
  });

  function openFile(fileName) {
    if (typeof fileName !== "string" || !workspace.hasFile(fileName)) return false;
    tabs.open(fileName, getFileKind(fileName));
    return true;
  }

  function renameSingleOpenFile(oldName, newName) {
    const session = sessions.get(oldName);
    if (session) {
      sessions.remove(oldName);
      sessions.save(newName, session);
    }
    buffers.rename(oldName, newName);
    sourceLoader.rename(oldName, newName);
    sourceViewport.release(oldName);
    const renamed = tabs.rename(oldName, newName, getFileKind(newName));
    if (activeFile === oldName) {
      activeFile = newName;
      editing.renameFile(oldName, newName);
      setFileContext(getFileKind(newName), newName, getLanguageLabel(newName));
      explorer.setSelected(newName, "file");
    }
    return renamed;
  }

  function renameOpenFile(oldPath, newPath, kind) {
    if (kind === "file") return renameSingleOpenFile(oldPath, newPath);
    const prefix = oldPath + "/";
    const openFiles = tabs.getOpenFiles().filter((fileName) => fileName.startsWith(prefix));
    for (const fileName of openFiles) {
      renameSingleOpenFile(fileName, newPath + fileName.slice(oldPath.length));
    }
    scheduleEditorWorkspacePersist();
    return openFiles.length > 0;
  }

  function closeDeletedFiles(path, kind) {
    const files = kind === "directory"
      ? tabs.getOpenFiles().filter((fileName) => fileName.startsWith(path + "/"))
      : [path];
    for (const fileName of files) {
      tabs.close(fileName, { focus: false });
      buffers.remove(fileName, { discardDirty: true });
    }
    scheduleEditorWorkspacePersist();
  }

  bindExplorerFileActions({
    fileTree,
    newFileButton,
    newFolderButton,
    refreshButton: refreshExplorerButton,
    workspace,
    explorer,
    openFile,
    renameOpenFile,
    closeDeletedFiles,
    notify: onNotify || onError
  });

  function restorePersistedWorkspace() {
    const workspaceState = loadEditorWorkspace(persistenceOptions());
    if (!workspaceState) {
      showCanvasPanel();
      return;
    }

    for (const fileName of workspaceState.openFiles) {
      sessions.save(fileName, workspaceState.sessions[fileName]);
      tabs.open(fileName, getFileKind(fileName), { activate: false });
      tabs.setDirty(fileName, buffers.isDirty(fileName));
    }

    if (workspaceState.activeFile) tabs.activate(workspaceState.activeFile);
    else showCanvasPanel();
  }

  function resetEditorWorkspace() {
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = 0;
    restoringWorkspace = true;
    tabs.clear();
    sessions.clear();
    buffers.clear();
    clearEditorWorkspace();
    restoringWorkspace = false;
    return true;
  }

  const sourceEditorHost = sourceScroller.parentElement;
  sourceScroller.addEventListener("scroll", scheduleEditorWorkspacePersist, { passive: true });
  sourceEditorHost?.addEventListener("input", scheduleEditorWorkspacePersist);
  sourceEditorHost?.addEventListener("click", scheduleEditorWorkspacePersist);
  document.addEventListener("keydown", (event) => {
    if (!activeFile) return;
    const key = event.key.toLowerCase();
    const commandKey = event.ctrlKey || event.metaKey;
    const affectsNavigation = event.key === "F3"
      || event.key === "Escape"
      || (event.altKey && ["c", "w", "r"].includes(key))
      || (commandKey && ["f", "g"].includes(key));
    if (affectsNavigation) scheduleEditorWorkspacePersist();
  });
  window.addEventListener("pagehide", flushEditorWorkspace);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushEditorWorkspace();
  });

  restorePersistedWorkspace();
  restoringWorkspace = false;
  persistEditorWorkspace();

  return Object.freeze({
    showCanvas: tabs.showCanvas,
    showCode: () => {
      const fileName = tabs.getActiveFile();
      if (fileName) tabs.activate(fileName);
    },
    openFile,
    saveFile: editing.saveActive,
    saveAll: editing.saveAll,
    revertFile: editing.revertActive,
    persistWorkspace: flushEditorWorkspace,
    resetWorkspace: resetEditorWorkspace,
    workspace
  });
}
