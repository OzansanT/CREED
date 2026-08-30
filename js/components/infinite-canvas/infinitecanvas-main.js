import { createCommandEngine } from "../../core/command-engine.js";
import { MIN_ZOOM, MAX_ZOOM } from "../../core/config.js";
import { getViewportWorldCenter } from "../../core/coordinates.js";
import { state, clamp } from "../../core/state.js";
import { loadState, saveState } from "../../core/storage.js";
import { createRenderScheduler } from "../../ui/render-scheduler.js";
import { updateUI } from "../../ui/ui.js";
import { showToast } from "../../ui/toast.js";
import { fitCurrentCanvasContent } from "./canvas-navigation.js";
import { setZoomFromCenter, returnToOrigin, preserveCenterOnResize } from "./viewport.js";
import { setAnchor, goToAnchor, clearAnchor } from "./anchors.js";
import { bindPan } from "./pan-input.js";
import { bindWheel } from "./wheel-input.js";
import { bindKeyboard } from "./keyboard.js";
import { bindSidebarMenu } from "./sidebar-input.js";
import { bindResetControls } from "./reset-input.js";
import { bindCardDrag } from "./card-input.js";

export function createInfiniteCanvasRuntime(elements, { stateAlreadyLoaded = state.canvasComponents.length > 0 } = {}) {
  const renderScheduler = createRenderScheduler(() => updateUI(elements, state));
  const update = renderScheduler.schedule;
  const persist = () => saveState(elements.canvas);
  const notify = (message) => showToast(elements.toast, message);
  const history = createCommandEngine({ update, persist });
  let getCanvasComponentItems = () => [];

  function home() {
    returnToOrigin({ state, canvas: elements.canvas, update, persist });
    notify("Returned to origin");
  }

  function fitContent() {
    const fitted = fitCurrentCanvasContent({
      state,
      canvas: elements.canvas,
      originCard: elements.originCard,
      jsonCard: elements.jsonComponentCard,
      componentItems: getCanvasComponentItems(),
      update,
      persist
    });
    if (fitted) notify("Fit canvas content");
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

  function captureView() {
    const center = getViewportWorldCenter(elements.canvas, state);
    return { center: { x: center.x, y: center.y }, zoom: state.zoom };
  }

  function restoreView(view) {
    const center = view?.center;
    if (!center || !Number.isFinite(Number(center.x)) || !Number.isFinite(Number(center.y))) return false;
    state.zoom = clamp(Number(view.zoom) || state.zoom, MIN_ZOOM, MAX_ZOOM);
    state.x = (elements.canvas.clientWidth / 2) - (Number(center.x) * state.zoom);
    state.y = (elements.canvas.clientHeight / 2) - (Number(center.y) * state.zoom);
    update();
    persist();
    return true;
  }

  function focusWorldPoint(worldX, worldY) {
    const x = Number(worldX);
    const y = Number(worldY);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
    state.x = (elements.canvas.clientWidth / 2) - (x * state.zoom);
    state.y = (elements.canvas.clientHeight / 2) - (y * state.zoom);
    update();
    persist();
    return true;
  }

  function initializePosition() {
    const restored = stateAlreadyLoaded || loadState(elements.canvas);
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
    bottomPanel,
    panelResize,
    onAddJsonCard,
    onCanvasReset,
    onInfiniteReset,
    componentItemsProvider
  }) {
    if (bound) return;
    bound = true;
    if (typeof componentItemsProvider === "function") getCanvasComponentItems = componentItemsProvider;

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
      history,
      onAddJsonCard
    });
    bindCardDrag({
      card: elements.originCard,
      state,
      positionKey: "originCard",
      update,
      persist,
      history,
      getSnapPoints: () => state.canvasComponents
    });
    bindKeyboard({
      onHome: home,
      onSetAnchor: saveAnchor,
      onGoAnchor: restoreAnchor,
      onUndo: undo,
      onRedo: redo,
      onFitContent: fitContent
    });

    bindResetControls({
      canvasButton: elements.canvasResetBtn,
      infiniteButton: elements.infiniteResetBtn,
      state,
      canvas: elements.canvas,
      update,
      persist,
      notify,
      onCanvasReset: () => {
        history.clear();
        onCanvasReset?.();
      },
      onInfiniteReset: () => {
        history.clear();
        onInfiniteReset?.();
        resetEditorWorkspace?.();
        primarySidebar.setVisible(true, false);
        bottomPanel.setVisible(true, false);
        panelResize.reset(false);
      }
    });

    window.addEventListener("resize", handleWindowResize);
    requestAnimationFrame(initializePosition);
  }

  return Object.freeze({
    update,
    persist,
    bind,
    history,
    renderScheduler,
    fitContent,
    captureView,
    restoreView,
    focusWorldPoint,
    scheduleViewportCenterPreservation
  });
}
