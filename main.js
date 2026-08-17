import { getElements } from "./elements.js";
import { showToast } from "./toast.js";
import { bindPrimarySidebar } from "./primary-sidebar-input.js";
import { bindSecondarySidebar } from "./secondary-sidebar-input.js";
import { bindTerminalPanel } from "./terminal-panel-main.js?v=20260817-2";
import { bindPanelResize } from "./panel-resize-input.js";
import { hydrateIcons } from "./icons.js?v=20260815-3";
import { bindEditorPanel } from "./editor-panel-main.js?v=20260817-2";
import { createInfiniteCanvasRuntime } from "./infinitecanvas-main.js?v=20260817-3";

hydrateIcons();

const elements = getElements();
const infiniteCanvas = createInfiniteCanvasRuntime(elements);

const editorPanel = bindEditorPanel({
  rootToggle: elements.workspaceRootToggle,
  fileTree: elements.workspaceFileTree,
  fileTabs: elements.workspaceFileTabs,
  canvasTab: elements.workspaceCanvasTab,
  breadcrumbKind: elements.workspaceBreadcrumbKind,
  breadcrumbName: elements.workspaceBreadcrumbName,
  canvasView: elements.canvasEditorView,
  codeView: elements.codeEditorView,
  sourceScroller: elements.sourceScroller,
  codeContent: elements.sourceCode,
  codeMinimap: elements.sourceMinimap,
  sidebar1ContextKind: elements.sidebar1ContextKind,
  sidebar1ContextName: elements.sidebar1ContextName,
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
  sidebar: elements.sidebar,
  layoutButton: elements.primarySidebarLayoutBtn,
  explorerButton: elements.explorerActivityBtn,
  onLayoutChange: handlePanelVisibilityChange
});

const secondarySidebar = bindSecondarySidebar({
  app: elements.app,
  panel: elements.sidebar1,
  layoutButton: elements.secondarySidebarLayoutBtn,
  onLayoutChange: handlePanelVisibilityChange
});

const terminalPanel = bindTerminalPanel({
  workbench: elements.workbench,
  panel: elements.terminalPanel,
  layoutButton: elements.panelLayoutBtn,
  onLayoutChange: handlePanelVisibilityChange
});

panelResize = bindPanelResize({
  app: elements.app,
  workbench: elements.workbench,
  primaryPanel: elements.sidebar,
  secondaryPanel: elements.sidebar1,
  terminalPanel: elements.terminalPanel,
  primaryController: primarySidebar,
  secondaryController: secondarySidebar,
  terminalController: terminalPanel,
  primaryHandle: elements.primarySidebarResizeHandle,
  secondaryHandle: elements.secondarySidebarResizeHandle,
  terminalHandle: elements.terminalPanelResizeHandle,
  onLayoutChange: infiniteCanvas.scheduleViewportCenterPreservation
});

infiniteCanvas.bind({
  showCanvas: editorPanel.showCanvas,
  primarySidebar,
  secondarySidebar,
  terminalPanel,
  panelResize
});
