import { state } from "./state.js";
import { getElements } from "./elements.js";
import { loadState, saveState } from "./storage.js";
import { updateUI } from "./ui.js";
import { showToast } from "./toast.js";
import { setZoomFromCenter, returnToOrigin, preserveCenterOnResize } from "./viewport.js";
import { setAnchor, goToAnchor, clearAnchor } from "./anchors.js";
import { bindPan } from "./pan-input.js";
import { bindWheel } from "./wheel-input.js";
import { bindKeyboard } from "./keyboard.js";
import { bindSidebarMenu } from "./sidebar-input.js";
import { bindPrimarySidebar } from "./primary-sidebar-input.js";
import { bindSecondarySidebar } from "./secondary-sidebar-input.js";
import { bindTerminalPanel } from "./terminal-panel-input.js";
import { bindPanelResize } from "./panel-resize-input.js";
import { bindResetControls } from "./reset-input.js";
import { bindCardDrag } from "./card-input.js";
import { bindJsonFileButton } from "./json-file.js";
import { hydrateIcons } from "./icons.js?v=20260815-3";
import { bindWorkbenchFiles } from "./workbench-input.js?v=20260815-3";

hydrateIcons();
const elements = getElements();
const update = () => updateUI(elements, state);
const persist = () => saveState();

function home() { returnToOrigin({ state, canvas: elements.canvas, update, persist }); showToast(elements.toast, "Returned to origin"); }
function saveAnchor() { setAnchor({ state, canvas: elements.canvas, update, persist }); showToast(elements.toast, "Anchor saved at current view"); }
function restoreAnchor() { const moved = goToAnchor({ state, canvas: elements.canvas, update, persist }); if (moved) showToast(elements.toast, "Returned to anchor"); }
function removeAnchor() { clearAnchor({ state, update, persist }); showToast(elements.toast, "Anchor cleared"); }
function initializePosition() { const restored = loadState(); if (!restored) { const center = { x: elements.canvas.clientWidth/2, y: elements.canvas.clientHeight/2 }; state.x = center.x; state.y = center.y; state.zoom = 1; } update(); }

elements.zoomRange.addEventListener("input", () => setZoomFromCenter({ state, canvas: elements.canvas, nextZoom: Number(elements.zoomRange.value)/100, update, persist }));
elements.zoomInBtn.addEventListener("click", () => setZoomFromCenter({ state, canvas: elements.canvas, nextZoom: state.zoom + .10, update, persist }));
elements.zoomOutBtn.addEventListener("click", () => setZoomFromCenter({ state, canvas: elements.canvas, nextZoom: state.zoom - .10, update, persist }));
elements.setAnchorBtn.addEventListener("click", saveAnchor);
elements.goAnchorBtn.addEventListener("click", restoreAnchor);
elements.clearAnchorBtn.addEventListener("click", removeAnchor);
elements.homeBtn.addEventListener("click", home);
bindPan({ canvas: elements.canvas, state, update, persist });
bindWheel({ canvas: elements.canvas, state, update, persist });
const workbench = bindWorkbenchFiles({
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
  chatContextKind: elements.chatContextKind,
  chatContextName: elements.chatContextName,
  statusLanguage: elements.statusLanguage,
  onCanvasShow: update,
  onError: (message) => showToast(elements.toast, message)
});
bindSidebarMenu({ canvasButton: elements.canvasMenuBtn, infiniteCanvasButton: elements.infiniteCanvasMenuBtn, componentsButton: elements.componentsMenuBtn, addJsonCardButton: elements.addJsonCardBtn, canvas: elements.canvas, jsonCard: elements.jsonComponentCard, showCanvas: workbench.showCanvas, state, update, persist });
bindCardDrag({ card: elements.originCard, state, positionKey: "originCard", update, persist });
bindCardDrag({ card: elements.jsonComponentCard, state, positionKey: "jsonCard", update, persist });
bindJsonFileButton({ button: elements.openJsonFileBtn });
bindKeyboard({ onHome: home, onSetAnchor: saveAnchor, onGoAnchor: restoreAnchor });
let lastSize = { w: elements.canvas.clientWidth, h: elements.canvas.clientHeight };
let sidebarLayoutFrame = 0;

function scheduleViewportCenterPreservation() {
  cancelAnimationFrame(sidebarLayoutFrame);
  sidebarLayoutFrame = requestAnimationFrame(() => {
    lastSize = preserveCenterOnResize({ state, canvas: elements.canvas, oldSize: lastSize, update, persist });
  });
}

let panelResize = null;

function handlePanelVisibilityChange() {
  scheduleViewportCenterPreservation();
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
  panel: elements.chatPanel,
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
  secondaryPanel: elements.chatPanel,
  terminalPanel: elements.terminalPanel,
  primaryController: primarySidebar,
  secondaryController: secondarySidebar,
  terminalController: terminalPanel,
  primaryHandle: elements.primarySidebarResizeHandle,
  secondaryHandle: elements.secondarySidebarResizeHandle,
  terminalHandle: elements.terminalPanelResizeHandle,
  onLayoutChange: scheduleViewportCenterPreservation
});
bindResetControls({
  canvasButton: elements.canvasResetBtn,
  infiniteButton: elements.infiniteResetBtn,
  state,
  canvas: elements.canvas,
  update,
  persist,
  notify: (message) => showToast(elements.toast, message),
  onInfiniteReset: () => {
    primarySidebar.setVisible(true, false);
    secondarySidebar.setVisible(true, false);
    terminalPanel.setVisible(true, false);
    panelResize.reset(false);
  }
});
window.addEventListener("resize", () => { lastSize = preserveCenterOnResize({ state, canvas: elements.canvas, oldSize: lastSize, update, persist }); });
requestAnimationFrame(initializePosition);
