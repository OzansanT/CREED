import { getElements } from "./elements.js";
import { showToast } from "./toast.js";
import { bindPrimarySidebar } from "./primary-sidebar-input.js";
import { bindSecondarySidebar } from "./secondary-sidebar-main.js?v=20260818-1";
import { bindBottomPanel } from "./bottom-panel-main.js?v=20260818-1";
import { bindPanelResize } from "./panel-resize-input.js";
import { hydrateIcons } from "./icons.js?v=20260818-1";
import { bindEditorPanel } from "./editor-panel-main.js?v=20260818-1";
import { createInfiniteCanvasRuntime } from "./infinitecanvas-main.js?v=20260818-1";

hydrateIcons();

const elements = getElements();
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
  onCanvasShow: infiniteCanvas.update,
  onError: (message) => showToast(elements.toast, message)
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
  primarySidebar,
  secondarySidebar,
  bottomPanel,
  panelResize
});
