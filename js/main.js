import {
  STORAGE_KEY,
  PANEL_LAYOUT_STORAGE_KEY,
  LEGACY_PANEL_LAYOUT_STORAGE_KEY,
  EDITOR_WORKSPACE_STORAGE_KEY,
  WORKSPACE_FS_STORAGE_KEY,
  EDITOR_BUFFER_STORAGE_KEY,
  TERMINAL_SESSIONS_STORAGE_KEY
} from "./core/config.js";
import { getElements } from "./core/elements.js";
import { state } from "./core/state.js";
import { loadState } from "./core/storage.js";
import { createUnifiedWorkspaceState } from "./core/workspace-state.js";
import { bindAccessibilityNavigation } from "./ui/accessibility.js";
import { showToast } from "./ui/toast.js";
import { hydrateIcons } from "./ui/icons.js";
import { disableUnavailableControls } from "./ui/unavailable-controls.js";
import { bindPrimarySidebar } from "./components/primary-sidebar/primary-sidebar-main.js";
import { bindWorkspaceSearchView } from "./components/primary-sidebar/workspace-search-view.js";
import { bindBottomPanel } from "./components/bottom-panel/bottom-panel-main.js";
import { bindTerminalSessions } from "./components/bottom-panel/terminal-session.js";
import { bindPanelResize } from "./components/panel-resize/panel-resize-input.js";
import { bindEditorPanel } from "./components/editor-panel/editor-panel-main.js";
import { bindQuickOpen } from "./components/editor-panel/quick-open.js";
import { bindSplitEditor } from "./components/editor-panel/split-editor.js";
import { createInfiniteCanvasRuntime } from "./components/infinite-canvas/infinitecanvas-main.js";
import { createCanvasComponentRegistry } from "./components/infinite-canvas/component-registry.js";
import { bindCanvasComponentManager } from "./components/infinite-canvas/component-manager.js";
import { registerDefaultCanvasComponents } from "./components/infinite-canvas/component-definitions.js";
import { bindDiagnostics } from "./components/diagnostics/diagnostics-main.js";
import { bindDiagnosticsTerminalCommand } from "./components/diagnostics/diagnostics-terminal.js";
import { bindAIWorkbench } from "./components/ai/ai-main.js";

const unifiedWorkspaceState = createUnifiedWorkspaceState({
  keys: [
    STORAGE_KEY,
    PANEL_LAYOUT_STORAGE_KEY,
    LEGACY_PANEL_LAYOUT_STORAGE_KEY,
    EDITOR_WORKSPACE_STORAGE_KEY,
    WORKSPACE_FS_STORAGE_KEY,
    EDITOR_BUFFER_STORAGE_KEY,
    TERMINAL_SESSIONS_STORAGE_KEY
  ]
});
unifiedWorkspaceState.restoreMissing();

hydrateIcons();
disableUnavailableControls();

const elements = getElements();
const detachedFileContextKind = document.createElement("span");
const detachedFileContextName = document.createElement("span");
loadState(elements.canvas);
bindAccessibilityNavigation({
  activityBar: elements.activityBar,
  sidebarTabs: elements.explorerSectionTabs,
  editorTabs: elements.editorTabs,
  bottomTabs: elements.bottomPanelTabsRoot
});

const infiniteCanvas = createInfiniteCanvasRuntime(elements);
const notify = (message) => showToast(elements.toast, message);

const editorPanel = bindEditorPanel({
  rootToggle: elements.workspaceDisclosureBtn,
  fileTree: elements.workspaceTree,
  newFileButton: elements.newFileBtn,
  newFolderButton: elements.newFolderBtn,
  refreshExplorerButton: elements.refreshExplorerBtn,
  fileTabs: elements.fileTabs,
  canvasTab: elements.canvasTab,
  breadcrumbKind: elements.editorBreadcrumbKind,
  breadcrumbName: elements.editorBreadcrumbName,
  canvasView: elements.canvasView,
  codeView: elements.sourceEditorView,
  sourceScroller: elements.sourceScroller,
  codeContent: elements.sourceContent,
  codeMinimap: elements.sourceMinimap,
  chatContextKind: detachedFileContextKind,
  chatContextName: detachedFileContextName,
  statusLanguage: elements.statusLanguage,
  onCanvasShow: infiniteCanvas.scheduleViewportCenterPreservation,
  onError: notify,
  onNotify: notify
});

bindQuickOpen({
  openFile: editorPanel.openFile,
  notify
});

const splitEditor = bindSplitEditor({
  editorViewport: elements.editorViewport,
  canvasView: elements.canvasView,
  sourceView: elements.sourceEditorView,
  splitButton: elements.splitEditorBtn,
  workspace: editorPanel.workspace,
  getPrimaryActiveFile: editorPanel.getActiveFile,
  notify
});

const workspaceSearch = bindWorkspaceSearchView({
  sidebar: elements.primarySidebar,
  explorerView: elements.explorerView,
  workspace: editorPanel.workspace,
  openFile: editorPanel.openFile,
  openFileAt: editorPanel.openFileAt,
  breadcrumbName: elements.editorBreadcrumbName,
  notify
});

let panelResize = null;

function handlePanelVisibilityChange() {
  infiniteCanvas.scheduleViewportCenterPreservation();
  panelResize?.persist();
}

const bottomPanel = bindBottomPanel({
  workbench: elements.workbench,
  panel: elements.bottomPanel,
  layoutButton: elements.toggleBottomPanelBtn,
  tabs: elements.bottomPanelTabs,
  views: elements.bottomPanelViews,
  maximizeButton: elements.maximizeBottomPanelBtn,
  closeButton: elements.closeBottomPanelBtn,
  onLayoutChange: handlePanelVisibilityChange
});

function showBottomView(viewName) {
  bottomPanel.setVisible(true);
  return bottomPanel.setActiveView(viewName);
}

const componentRegistry = registerDefaultCanvasComponents(createCanvasComponentRegistry());
state.canvasComponents = (state.canvasComponents || []).filter((item) => componentRegistry.has(item.type));
const componentManager = bindCanvasComponentManager({
  canvas: elements.canvas,
  world: elements.world,
  state,
  registry: componentRegistry,
  update: infiniteCanvas.update,
  persist: infiniteCanvas.persist,
  history: infiniteCanvas.history,
  notify
});
infiniteCanvas.persist();

const diagnostics = bindDiagnostics({
  problemsView: elements.problemsView,
  workspace: editorPanel.workspace,
  openFile: editorPanel.openFile,
  openFileAt: editorPanel.openFileAt,
  showBottomView,
  notify
});

const aiWorkbench = bindAIWorkbench({
  editorPanel,
  diagnostics,
  notify
});

globalThis.CREED_AI = Object.freeze({
  registerProvider: aiWorkbench.providers.register,
  setProvider: aiWorkbench.providers.setActive,
  listProviders: aiWorkbench.providers.list,
  refreshIndex: aiWorkbench.refreshIndex
});

const primarySidebar = bindPrimarySidebar({
  app: elements.app,
  sidebar: elements.primarySidebar,
  layoutButton: elements.togglePrimarySidebarBtn,
  explorerButton: elements.activityExplorerBtn,
  searchButton: elements.activitySearchBtn,
  explorerView: elements.explorerView,
  searchView: workspaceSearch.view,
  onViewChange: (viewName) => {
    if (viewName === "search") workspaceSearch.refreshOutline();
  },
  onLayoutChange: handlePanelVisibilityChange
});

bindTerminalSessions({
  view: elements.terminalView,
  newButton: elements.newTerminalBtn,
  splitButton: elements.splitTerminalBtn,
  killButton: elements.killTerminalBtn,
  openFile: editorPanel.openFile,
  openFileAt: editorPanel.openFileAt,
  workspace: editorPanel.workspace,
  showView: showBottomView,
  notify
});

bindDiagnosticsTerminalCommand({
  terminalView: elements.terminalView,
  runChecks: diagnostics.runChecks,
  notify
});

panelResize = bindPanelResize({
  app: elements.app,
  workbench: elements.workbench,
  primaryPanel: elements.primarySidebar,
  bottomPanel: elements.bottomPanel,
  primaryController: primarySidebar,
  bottomController: bottomPanel,
  primaryHandle: elements.primarySidebarResizeHandle,
  bottomHandle: elements.bottomPanelResizeHandle,
  onLayoutChange: infiniteCanvas.scheduleViewportCenterPreservation
});

infiniteCanvas.bind({
  showCanvas: editorPanel.showCanvas,
  onAddJsonCard: () => componentManager.add("json-file"),
  componentItemsProvider: componentManager.getRecords,
  onCanvasReset: () => componentManager.renderAll(),
  onInfiniteReset: () => {
    componentManager.renderAll();
  },
  resetEditorWorkspace: () => {
    splitEditor.close();
    const reset = editorPanel.resetWorkspace();
    bottomPanel.setMaximized(false, false);
    aiWorkbench.refreshIndex();
    diagnostics.runChecks({ reveal: false }).catch(() => {});
    return reset;
  },
  primarySidebar,
  bottomPanel,
  panelResize
});

requestAnimationFrame(() => componentManager.renderAll());
diagnostics.runChecks({ reveal: false }).catch(() => {});
unifiedWorkspaceState.bindLifecycle();
unifiedWorkspaceState.snapshot();
