import {
  STORAGE_KEY,
  PANEL_LAYOUT_STORAGE_KEY,
  LEGACY_PANEL_LAYOUT_STORAGE_KEY,
  EDITOR_WORKSPACE_STORAGE_KEY,
  WORKSPACE_FS_STORAGE_KEY,
  EDITOR_BUFFER_STORAGE_KEY,
  TERMINAL_SESSIONS_STORAGE_KEY,
  GIT_WORKSPACE_STORAGE_KEY
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
import { bindSecondarySidebar } from "./components/secondary-sidebar/secondary-sidebar-main.js";
import { bindSecondarySidebarViews } from "./components/secondary-sidebar/secondary-sidebar-view-controller.js";
import { bindBottomPanel } from "./components/bottom-panel/bottom-panel-main.js";
import { bindTerminalSessions } from "./components/bottom-panel/terminal-session.js";
import { bindPanelResize } from "./components/panel-resize/panel-resize-input.js";
import { bindEditorPanel } from "./components/editor-panel/editor-panel-main.js";
import { bindQuickOpen } from "./components/editor-panel/quick-open.js";
import { bindSplitEditor } from "./components/editor-panel/split-editor.js";
import { bindRunDebug } from "./components/run-debug/run-debug-main.js";
import { bindSourceControl } from "./components/source-control/source-control-main.js";
import { createInfiniteCanvasRuntime } from "./components/infinite-canvas/infinitecanvas-main.js";
import { createCanvasComponentRegistry } from "./components/infinite-canvas/component-registry.js";
import { bindCanvasComponentManager } from "./components/infinite-canvas/component-manager.js";
import { registerDefaultCanvasComponents } from "./components/infinite-canvas/component-definitions.js";
import { createSystemGraphService } from "./components/infinite-canvas/system-graph-service.js";
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
    TERMINAL_SESSIONS_STORAGE_KEY,
    GIT_WORKSPACE_STORAGE_KEY,
    "creedSystemGraphViews.v1"
  ]
});
unifiedWorkspaceState.restoreMissing();

hydrateIcons();
disableUnavailableControls();

const elements = getElements();
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
  chatContextKind: elements.chatContextKind,
  chatContextName: elements.chatContextName,
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
  breadcrumbName: elements.editorBreadcrumbName,
  sourceContent: elements.sourceContent,
  sourceScroller: elements.sourceScroller,
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

function openFileAt(fileName, line = 1, column = 1) {
  if (!editorPanel.openFile(fileName)) return false;
  const targetLine = Math.max(1, Math.trunc(Number(line) || 1));
  const targetColumn = Math.max(1, Math.trunc(Number(column) || 1));
  let attempts = 0;

  function revealLocation() {
    attempts += 1;
    if (editorPanel.getActiveFile() !== fileName) return;
    const lineCount = Number(elements.sourceContent.dataset.lineCount || 0);
    if (!lineCount) {
      if (attempts < 120) requestAnimationFrame(revealLocation);
      return;
    }
    const lineHeight = Number.parseFloat(getComputedStyle(elements.sourceContent).lineHeight) || 19;
    const safeLine = Math.min(lineCount, targetLine);
    elements.sourceScroller.scrollTop = Math.max(0, ((safeLine - 1) * lineHeight) - (elements.sourceScroller.clientHeight * 0.45));
    elements.sourceScroller.scrollLeft = Math.max(0, ((targetColumn - 1) * 7.2) - 80);
    elements.sourceContent.dataset.runtimeTargetLine = String(safeLine);
    elements.sourceContent.dataset.runtimeTargetColumn = String(targetColumn);
  }

  requestAnimationFrame(revealLocation);
  return true;
}

const runDebug = bindRunDebug({
  sidebar: elements.primarySidebar,
  editorViewport: elements.editorViewport,
  workspace: editorPanel.workspace,
  outputView: elements.outputView,
  debugConsoleView: elements.debugConsoleView,
  showBottomView,
  openFileAt,
  notify
});

elements.activityRunBtn?.setAttribute("aria-controls", runDebug.view.id);

const sourceControl = bindSourceControl({
  sidebar: elements.primarySidebar,
  workspace: editorPanel.workspace,
  openFile: editorPanel.openFile,
  notify
});

elements.activitySourceControlBtn?.setAttribute("aria-controls", sourceControl.view.id);

const systemGraph = createSystemGraphService({
  workspace: editorPanel.workspace,
  notify
});

let diagnostics = null;
const diagnosticGraph = Object.freeze({
  getGraph: systemGraph.getGraph,
  setDiagnostics(problems = []) {
    const counts = new Map();
    for (const problem of problems) {
      if (!problem.fileName) continue;
      counts.set(problem.fileName, (counts.get(problem.fileName) || 0) + 1);
    }
    elements.world.querySelectorAll(".system-graph-node").forEach((node) => {
      const count = counts.get(node.dataset.fileName) || 0;
      node.style.outline = count ? "2px solid #dc2626" : "";
      node.style.outlineOffset = count ? "2px" : "";
      if (count) node.title = `${count} diagnostic problem(s) · ${node.dataset.fileName}`;
      else node.removeAttribute("title");
    });
  }
});

const componentRegistry = registerDefaultCanvasComponents(createCanvasComponentRegistry());
const componentManager = bindCanvasComponentManager({
  canvas: elements.canvas,
  world: elements.world,
  state,
  registry: componentRegistry,
  update: infiniteCanvas.update,
  persist: infiniteCanvas.persist,
  history: infiniteCanvas.history,
  notify,
  context: {
    systemGraphService: systemGraph,
    openFile: editorPanel.openFile,
    onSystemGraphMounted: () => requestAnimationFrame(() => diagnosticGraph.setDiagnostics(diagnostics?.model.list() || [])),
    onSystemGraphUnmounted: () => {}
  }
});

diagnostics = bindDiagnostics({
  problemsView: elements.problemsView,
  workspace: editorPanel.workspace,
  systemGraph: diagnosticGraph,
  openFile: editorPanel.openFile,
  showBottomView,
  notify
});

const diagnosticGraphObserver = new MutationObserver(() => {
  diagnosticGraph.setDiagnostics(diagnostics.model.list());
});
diagnosticGraphObserver.observe(elements.world, { childList: true, subtree: true });

const aiWorkbench = bindAIWorkbench({
  elements,
  editorPanel,
  diagnostics,
  systemGraph,
  sourceControl,
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
  sourceControlButton: elements.activitySourceControlBtn,
  runButton: elements.activityRunBtn,
  explorerView: elements.explorerView,
  searchView: workspaceSearch.view,
  sourceControlView: sourceControl.view,
  runView: runDebug.view,
  onViewChange: (viewName) => {
    if (viewName === "search") workspaceSearch.refreshOutline();
    if (viewName === "sourceControl") sourceControl.refresh();
    if (viewName === "run") runDebug.refreshConfiguration();
  },
  onLayoutChange: handlePanelVisibilityChange
});

const secondarySidebar = bindSecondarySidebar({
  app: elements.app,
  panel: elements.secondarySidebar,
  layoutButton: elements.toggleSecondarySidebarBtn,
  maximizeButton: elements.maximizeSecondarySidebarBtn,
  closeButton: elements.closeSecondarySidebarBtn,
  onLayoutChange: handlePanelVisibilityChange
});

const secondarySidebarViews = bindSecondarySidebarViews({
  panel: elements.secondarySidebar,
  state,
  registry: componentRegistry,
  componentManager,
  persist: infiniteCanvas.persist
});

bindTerminalSessions({
  view: elements.terminalView,
  newButton: elements.newTerminalBtn,
  splitButton: elements.splitTerminalBtn,
  killButton: elements.killTerminalBtn,
  openFile: editorPanel.openFile,
  workspace: editorPanel.workspace,
  showView: showBottomView,
  notify
});

function synchronizeTerminalBranch() {
  const branch = sourceControl.provider.getCurrentBranch();
  const branchLabel = elements.terminalView.querySelector(".terminal-prompt__branch");
  if (branchLabel) branchLabel.textContent = `(${branch})`;
}
sourceControl.provider.subscribe(synchronizeTerminalBranch);
synchronizeTerminalBranch();

bindDiagnosticsTerminalCommand({
  terminalView: elements.terminalView,
  runChecks: diagnostics.runChecks,
  notify
});

panelResize = bindPanelResize({
  app: elements.app,
  workbench: elements.workbench,
  primaryPanel: elements.primarySidebar,
  secondaryPanel: elements.secondarySidebar,
  bottomPanel: elements.bottomPanel,
  primaryController: primarySidebar,
  secondaryController: secondarySidebar,
  bottomController: bottomPanel,
  primaryHandle: elements.primarySidebarResizeHandle,
  secondaryHandle: elements.secondarySidebarResizeHandle,
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
    secondarySidebarViews.setView("chat", false);
  },
  resetEditorWorkspace: () => {
    runDebug.stop();
    splitEditor.close();
    const reset = editorPanel.resetWorkspace();
    secondarySidebar.setMaximized(false, false);
    bottomPanel.setMaximized(false, false);
    systemGraph.refresh();
    aiWorkbench.refreshIndex();
    diagnostics.runChecks({ reveal: false }).catch(() => {});
    return reset;
  },
  primarySidebar,
  secondarySidebar,
  bottomPanel,
  panelResize
});

requestAnimationFrame(() => componentManager.renderAll());
systemGraph.refresh()
  .then(() => diagnostics.runChecks({ reveal: false }))
  .catch(() => {});
unifiedWorkspaceState.bindLifecycle();
unifiedWorkspaceState.snapshot();
