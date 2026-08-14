import { state } from "./state.js";
import { getElements } from "./elements.js";
import { loadState, saveState, clearStoredState } from "./storage.js";
import { updateUI } from "./ui.js";
import { showToast } from "./toast.js";
import { setZoomFromCenter, returnToOrigin, preserveCenterOnResize } from "./viewport.js";
import { setAnchor, goToAnchor, clearAnchor } from "./anchors.js";
import { bindPan } from "./pan-input.js";
import { bindWheel } from "./wheel-input.js";
import { bindKeyboard } from "./keyboard.js";
import { bindSidebarMenu } from "./sidebar-input.js";
import { bindCardDrag } from "./card-input.js";
import { bindJsonFileButton } from "./json-file.js";
import { bindWorkbenchFiles } from "./workbench-input.js";

const elements = getElements();
const update = () => updateUI(elements, state);
const persist = () => saveState();

function home() { returnToOrigin({ state, canvas: elements.canvas, update, persist }); showToast(elements.toast, "Returned to origin"); }
function saveAnchor() { setAnchor({ state, canvas: elements.canvas, update, persist }); showToast(elements.toast, "Anchor saved at current view"); }
function restoreAnchor() { const moved = goToAnchor({ state, canvas: elements.canvas, update, persist }); if (moved) showToast(elements.toast, "Returned to anchor"); }
function removeAnchor() { clearAnchor({ state, update, persist }); showToast(elements.toast, "Anchor cleared"); }
function factoryReset() { const confirmed = confirm("Factory reset will restore the default pan, zoom, sidebar menu, card positions and remove the saved canvas location. Continue?"); if (!confirmed) return; clearStoredState(); state.anchor = null; state.sidebarView = "canvas"; state.originCard = { worldX: 0, worldY: 0 }; state.jsonCard = { visible: false, worldX: 0, worldY: 0 }; returnToOrigin({ state, canvas: elements.canvas, update, persist }); showToast(elements.toast, "Factory settings restored"); }
function initializePosition() { const restored = loadState(); if (!restored) { const center = { x: elements.canvas.clientWidth/2, y: elements.canvas.clientHeight/2 }; state.x = center.x; state.y = center.y; state.zoom = 1; } update(); }

elements.zoomRange.addEventListener("input", () => setZoomFromCenter({ state, canvas: elements.canvas, nextZoom: Number(elements.zoomRange.value)/100, update, persist }));
elements.zoomInBtn.addEventListener("click", () => setZoomFromCenter({ state, canvas: elements.canvas, nextZoom: state.zoom + .10, update, persist }));
elements.zoomOutBtn.addEventListener("click", () => setZoomFromCenter({ state, canvas: elements.canvas, nextZoom: state.zoom - .10, update, persist }));
elements.setAnchorBtn.addEventListener("click", saveAnchor);
elements.goAnchorBtn.addEventListener("click", restoreAnchor);
elements.clearAnchorBtn.addEventListener("click", removeAnchor);
elements.homeBtn.addEventListener("click", home);
elements.resetBtn.addEventListener("click", factoryReset);
bindPan({ canvas: elements.canvas, state, update, persist });
bindWheel({ canvas: elements.canvas, state, update, persist });
const workbench = bindWorkbenchFiles({
  fileButtons: elements.workspaceFileButtons,
  canvasTab: elements.workspaceCanvasTab,
  codeTab: elements.workspaceCodeTab,
  codeTabKind: elements.workspaceCodeTabKind,
  codeTabName: elements.workspaceCodeTabName,
  breadcrumbKind: elements.workspaceBreadcrumbKind,
  breadcrumbName: elements.workspaceBreadcrumbName,
  canvasView: elements.canvasEditorView,
  codeView: elements.codeEditorView,
  codeContent: elements.sourceCode,
  onCanvasShow: update,
  onError: (message) => showToast(elements.toast, message)
});
bindSidebarMenu({ canvasButton: elements.canvasMenuBtn, infiniteCanvasButton: elements.infiniteCanvasMenuBtn, componentsButton: elements.componentsMenuBtn, addJsonCardButton: elements.addJsonCardBtn, canvas: elements.canvas, jsonCard: elements.jsonComponentCard, showCanvas: workbench.showCanvas, state, update, persist });
bindCardDrag({ card: elements.originCard, state, positionKey: "originCard", update, persist });
bindCardDrag({ card: elements.jsonComponentCard, state, positionKey: "jsonCard", update, persist });
bindJsonFileButton({ button: elements.openJsonFileBtn });
bindKeyboard({ onHome: home, onSetAnchor: saveAnchor, onGoAnchor: restoreAnchor });
let lastSize = { w: elements.canvas.clientWidth, h: elements.canvas.clientHeight };
window.addEventListener("resize", () => { lastSize = preserveCenterOnResize({ state, canvas: elements.canvas, oldSize: lastSize, update, persist }); });
requestAnimationFrame(initializePosition);
