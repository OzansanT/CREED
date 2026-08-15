import { createWorkspaceStore } from "./workspace-store.js";
import { createVirtualSourceRenderer } from "./source-renderer.js";
import { bindEditorWorkbench } from "./editor-workbench.js";
import { bindExplorer } from "./explorer-input.js";
import { bindQuickOpen } from "./quick-open.js";

export function bindWorkbenchFiles({
  extensionHost,
  fileTree,
  newFileButton,
  newFolderButton,
  refreshExplorerButton,
  moreExplorerButton,
  canvasTab,
  tabsContainer,
  breadcrumbKind,
  breadcrumbName,
  canvasView,
  codeView,
  previewView,
  codeContent,
  editorInput,
  codeMinimap,
  minimapViewport,
  chatContextKind,
  chatContextName,
  statusLanguage,
  statusCursor,
  statusIndentation,
  workspaceDirtyStatus,
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
  quickOpenDialog,
  quickOpenInput,
  quickOpenResults,
  quickOpenCloseButton,
  commandCenterButton,
  commandCenterLabel,
  applicationMenuButton,
  onCanvasShow,
  onError
}) {
  const store = createWorkspaceStore();
  const renderer = createVirtualSourceRenderer({
    scroller: codeView,
    target: codeContent,
    minimap: codeMinimap,
    minimapViewport
  });
  let quickOpen = null;
  let explorer = null;
  let runHandler = null;
  let sessionChangeHandler = null;
  const editor = bindEditorWorkbench({
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
    onRun: () => runHandler?.(),
    onOpenCommands: () => quickOpen?.open({ commands: true }),
    onActiveChange(active) {
      explorer?.select(active.type === "file" ? active.path : "");
      commandCenterLabel.textContent = active.type === "file"
        ? active.path
        : active.type === "preview"
          ? "Workspace Preview"
          : "Search files or run a command (Ctrl+P)";
    },
    onSessionChange: () => sessionChangeHandler?.(),
    notify: onError
  });
  explorer = bindExplorer({
    store,
    fileTree,
    newFileButton,
    newFolderButton,
    refreshButton: refreshExplorerButton,
    moreButton: moreExplorerButton,
    onOpen: editor.openFile,
    onRename: editor.renamePath,
    onDelete: editor.closePaths,
    notify: onError
  });
  quickOpen = bindQuickOpen({
    dialog: quickOpenDialog,
    input: quickOpenInput,
    results: quickOpenResults,
    closeButton: quickOpenCloseButton,
    commandCenterButton,
    applicationMenuButton,
    store,
    extensionHost,
    openFile: editor.openFile,
    notify: onError
  });

  function updateDirtyStatus() {
    const changes = store.listChanges();
    const staged = changes.filter((change) => change.staged).length;
    workspaceDirtyStatus.textContent = changes.length
      ? `${changes.length} changed${staged ? ` · ${staged} staged` : ""}`
      : "Workspace clean";
  }
  store.subscribe(updateDirtyStatus);
  updateDirtyStatus();

  return Object.freeze({
    store,
    editor,
    explorer,
    quickOpen,
    showCanvas: editor.showCanvas,
    showCode: editor.showCode,
    openFile: editor.openFile,
    setRunHandler(handler) { runHandler = handler; },
    setSessionChangeHandler(handler) { sessionChangeHandler = handler; }
  });
}
