import { getElements } from "./elements.js";
import { showToast } from "./toast.js";
import { bindPrimarySidebar } from "./primary-sidebar-input.js";
import { bindSecondarySidebar } from "./secondary-sidebar-main.js";
import { bindBottomPanel } from "./bottom-panel-main.js";
import { bindPanelResize } from "./panel-resize-input.js";
import { hydrateIcons } from "./icons.js";
import { bindEditorPanel } from "./editor-panel-main.js";
import { createInfiniteCanvasRuntime } from "./infinitecanvas-main.js";

function disableUnavailableControls() {
  const selectors = [
    ".navigation-controls__button",
    "#activityMenuBtn",
    "#activitySearchBtn",
    "#activitySourceControlBtn",
    "#activityRunBtn",
    "#activityExtensionsBtn",
    "#activityGitHubBtn",
    "#activityAccountBtn",
    "#activitySettingsBtn",
    "#newFileBtn",
    "#newFolderBtn",
    "#refreshExplorerBtn",
    "button[aria-label='More Explorer actions']",
    "#splitEditorBtn",
    "#editorActionsBtn",
    "#newTerminalBtn",
    "#splitTerminalBtn",
    "#killTerminalBtn",
    "button[aria-label='More terminal actions']",
    "#newChatBtn",
    "#chatSettingsBtn",
    "button[aria-label='More chat actions']",
    "#chatPromptInput",
    "#sendChatMessageBtn"
  ];

  document.querySelectorAll(selectors.join(",")).forEach((control) => {
    if (!(control instanceof HTMLButtonElement || control instanceof HTMLTextAreaElement)) return;
    control.disabled = true;
    control.setAttribute("aria-disabled", "true");
    if (control.title) control.title += " — not implemented yet";
  });
}

hydrateIcons();
disableUnavailableControls();

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
  onCanvasShow: infiniteCanvas.scheduleViewportCenterPreservation,
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
