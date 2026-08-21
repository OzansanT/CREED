import { getElements } from "./core/elements.js";
import { bindAccessibilityNavigation } from "./ui/accessibility.js";
import { showToast } from "./ui/toast.js";
import { hydrateIcons } from "./ui/icons.js";
import { disableUnavailableControls } from "./ui/unavailable-controls.js";
import { bindPrimarySidebar } from "./components/primary-sidebar/primary-sidebar-main.js";
import { bindWorkspaceSearchView } from "./components/primary-sidebar/workspace-search-view.js";
import { bindSecondarySidebar } from "./components/secondary-sidebar/secondary-sidebar-main.js";
import { bindBottomPanel } from "./components/bottom-panel/bottom-panel-main.js";
import { bindTerminalSessions } from "./components/bottom-panel/terminal-session.js";
import { bindPanelResize } from "./components/panel-resize/panel-resize-input.js";
import { bindEditorPanel } from "./components/editor-panel/editor-panel-main.js";
import { bindQuickOpen } from "./components/editor-panel/quick-open.js";
import { bindSplitEditor } from "./components/editor-panel/split-editor.js";
import { bindRunDebug } from "./components/run-debug/run-debug-main.js";
import { bindSourceControl } from "./components/source-control/source-control-main.js";
import { createInfiniteCanvasRuntime } from "./components/infinite-canvas/infinitecanvas-main.js";
import { bindSystemGraph } from "./components/infinite-canvas/system-graph-view.js";

hydrateIcons();
disableUnavailableControls();

const elements = getElements();
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
  showBottomView: (viewName) => {
    bottomPanel.setVisible(true);
    bottomPanel.setActiveView(viewName);
  },
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

const systemGraph = bindSystemGraph({
  canvas: elements.canvas,
  world: elements.world,
  workspace: editorPanel.workspace,
  openFile: editorPanel.openFile,
  showCanvas: editorPanel.showCanvas,
  focusWorldPoint: infiniteCanvas.focusWorldPoint,
  captureViewport: infiniteCanvas.captureView,
  restoreViewport: infiniteCanvas.restoreView,
  notify
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

bindTerminalSessions({
  view: elements.terminalView,
  newButton: elements.newTerminalBtn,
  splitButton: elements.splitTerminalBtn,
  killButton: elements.killTerminalBtn,
  openFile: editorPanel.openFile,
  workspace: editorPanel.workspace,
  showView: (viewName) => {
    bottomPanel.setVisible(true);
    bottomPanel.setActiveView(viewName);
  },
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
  resetEditorWorkspace: () => {
    runDebug.stop();
    splitEditor.close();
    systemGraph.refresh();
    return editorPanel.resetWorkspace();
  },
  primarySidebar,
  secondarySidebar,
  bottomPanel,
  panelResize
});
