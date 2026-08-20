import { getElements } from "./core/elements.js";
import { bindAccessibilityNavigation } from "./ui/accessibility.js";
import { showToast } from "./ui/toast.js";
import { hydrateIcons } from "./ui/icons.js";
import { disableUnavailableControls } from "./ui/unavailable-controls.js";
import { bindPrimarySidebar } from "./components/primary-sidebar/primary-sidebar-main.js";
import { bindSecondarySidebar } from "./components/secondary-sidebar/secondary-sidebar-main.js";
import { bindBottomPanel } from "./components/bottom-panel/bottom-panel-main.js";
import { bindTerminalSessions } from "./components/bottom-panel/terminal-session.js";
import { bindPanelResize } from "./components/panel-resize/panel-resize-input.js";
import { bindEditorPanel } from "./components/editor-panel/editor-panel-main.js";
import { bindQuickOpen } from "./components/editor-panel/quick-open.js";
import { createInfiniteCanvasRuntime } from "./components/infinite-canvas/infinitecanvas-main.js";

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

const editorPanel = bindEditorPanel({
  rootToggle: elements.workspaceDisclosureBtn,
  fileTree: elements.workspaceTree,
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
  onError: (message) => showToast(elements.toast, message)
});

bindQuickOpen({
  openFile: editorPanel.openFile,
  notify: (message) => showToast(elements.toast, message)
});

let panelResize = null;

function handlePanelVisibilityChange() {
  infiniteCanvas.scheduleViewportCenterPreservation();
  panelResize?.persist();
}

const primarySidebar = bindPrimarySidebar({
  app: elements.app,
  sidebar: elements.primarySidebar,
  layoutButton: elements.togglePrimarySidebarBtn,
  explorerButton: elements.activityExplorerBtn,
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

bindTerminalSessions({
  view: elements.terminalView,
  newButton: elements.newTerminalBtn,
  splitButton: elements.splitTerminalBtn,
  killButton: elements.killTerminalBtn,
  openFile: editorPanel.openFile,
  showView: (viewName) => {
    bottomPanel.setVisible(true);
    bottomPanel.setActiveView(viewName);
  },
  notify: (message) => showToast(elements.toast, message)
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
  resetEditorWorkspace: editorPanel.resetWorkspace,
  primarySidebar,
  secondarySidebar,
  bottomPanel,
  panelResize
});
