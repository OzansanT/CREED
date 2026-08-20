import { createCommandEngine } from "../../core/command-engine.js";
import { state } from "../../core/state.js";
import { loadState, saveState } from "../../core/storage.js";
import { updateUI } from "../../ui/ui.js";
import { showToast } from "../../ui/toast.js";
import { setZoomFromCenter, returnToOrigin, preserveCenterOnResize } from "./viewport.js";
import { setAnchor, goToAnchor, clearAnchor } from "./anchors.js";
import { bindPan } from "./pan-input.js";
import { bindWheel } from "./wheel-input.js";
import { bindKeyboard } from "./keyboard.js";
import { bindSidebarMenu } from "./sidebar-input.js";
import { bindResetControls } from "./reset-input.js";
import { bindCardDrag } from "./card-input.js";
import { bindJsonFileButton } from "./json-file.js";

export function createInfiniteCanvasRuntime(elements) {
  let renderFrame = 0;

  const update = () => {
    if (renderFrame) return;
    renderFrame = requestAnimationFrame(() => {
      renderFrame = 0;
      updateUI(elements, state);
    });
  };

  const persist = () => saveState(elements.canvas);
  const notify = (message) => showToast(elements.toast, message);
  const history = createCommandEngine({ update, persist });

  function home() {
    returnToOrigin({ state, canvas: elements.canvas, update, persist });
    notify("Returned to origin");
  }

  function saveAnchor() {
    setAnchor({ state, canvas: elements.canvas, update, persist });
    notify("Anchor saved at current view");
  }

  function restoreAnchor() {
    const moved = goToAnchor({ state, canvas: elements.canvas, update, persist });
    if (moved) notify("Returned to anchor");
  }

  function removeAnchor() {
    clearAnchor({ state, update, persist });
    notify("Anchor cleared");
  }

  function undo() {
    if (history.undo()) notify("Undo");
  }

  function redo() {
    if (history.redo()) notify("Redo");
  }

  function initializePosition() {
    const restored = loadState(elements.canvas);
    if (!restored) {
      const center = {
        x: elements.canvas.clientWidth / 2,
        y: elements.canvas.clientHeight / 2
      };
      state.x = center.x;
      state.y = center.y;
      state.zoom = 1;
    }
    history.clear();
    update();
  }

  let lastSize = {
    w: elements.canvas.clientWidth,
    h: elements.canvas.clientHeight
  };
  let sidebarLayoutFrame = 0;
  let bound = false;

  function scheduleViewportCenterPreservation() {
    if (!bound) return;
    cancelAnimationFrame(sidebarLayoutFrame);
    sidebarLayoutFrame = requestAnimationFrame(() => {
      lastSize = preserveCenterOnResize({
        state,
        canvas: elements.canvas,
        oldSize: lastSize,
        update,
        persist
      });
    });
  }

  function handleWindowResize() {
    lastSize = preserveCenterOnResize({
      state,
      canvas: elements.canvas,
      oldSize: lastSize,
      update,
      persist
    });
  }

  function bind({
    showCanvas,
    resetEditorWorkspace,
    primarySidebar,
    secondarySidebar,
    bottomPanel,
    panelResize
  }) {
    if (bound) return;
    bound = true;

    elements.zoomRange.addEventListener("input", () => setZoomFromCenter({
      state,
      canvas: elements.canvas,
      nextZoom: Number(elements.zoomRange.value) / 100,
      update,
      persist
    }));
    elements.zoomInBtn.addEventListener("click", () => setZoomFromCenter({
      state,
      canvas: elements.canvas,
      nextZoom: state.zoom + .10,
      update,
      persist
    }));
    elements.zoomOutBtn.addEventListener("click", () => setZoomFromCenter({
      state,
      canvas: elements.canvas,
      nextZoom: state.zoom - .10,
      update,
      persist
    }));

    elements.setAnchorBtn.addEventListener("click", saveAnchor);
    elements.goAnchorBtn.addEventListener("click", restoreAnchor);
    elements.clearAnchorBtn.addEventListener("click", removeAnchor);
    elements.homeBtn.addEventListener("click", home);

    bindPan({ canvas: elements.canvas, state, update, persist });
    bindWheel({ canvas: elements.canvas, state, update, persist });
    bindSidebarMenu({
      canvasButton: elements.canvasMenuBtn,
      infiniteCanvasButton: elements.infiniteCanvasMenuBtn,
      componentsButton: elements.componentsMenuBtn,
      addJsonCardButton: elements.addJsonCardBtn,
      canvas: elements.canvas,
      jsonCard: elements.jsonComponentCard,
      showCanvas,
      state,
      update,
      persist,
      history
    });
    bindCardDrag({
      card: elements.originCard,
      state,
      positionKey: "originCard",
      update,
      persist,
      history
    });
    bindCardDrag({
      card: elements.jsonComponentCard,
      state,
      positionKey: "jsonCard",
      update,
      persist,
      history
    });
    bindJsonFileButton({ button: elements.openJsonFileBtn });
    bindKeyboard({
      onHome: home,
      onSetAnchor: saveAnchor,
      onGoAnchor: restoreAnchor,
      onUndo: undo,
      onRedo: redo
    });

    bindResetControls({
      canvasButton: elements.canvasResetBtn,
      infiniteButton: elements.infiniteResetBtn,
      state,
      canvas: elements.canvas,
      update,
      persist,
      notify,
      onCanvasReset: () => history.clear(),
      onInfiniteReset: () => {
        history.clear();
        resetEditorWorkspace?.();
        primarySidebar.setVisible(true, false);
        secondarySidebar.setVisible(true, false);
        bottomPanel.setVisible(true, false);
        panelResize.reset(false);
      }
    });

    window.addEventListener("resize", handleWindowResize);
    requestAnimationFrame(initializePosition);
  }

  return Object.freeze({
    update,
    bind,
    history,
    scheduleViewportCenterPreservation
  });
}
