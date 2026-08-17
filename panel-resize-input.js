import { clamp } from "./state.js";
import {
  clearPanelLayout,
  loadPanelLayout,
  savePanelLayout
} from "./storage.js";

const DEFAULT_PRIMARY_WIDTH = 293;
const DEFAULT_SECONDARY_WIDTH = 290;
const DEFAULT_TERMINAL_HEIGHT = 320;
const MIN_PRIMARY_WIDTH = 180;
const MIN_SECONDARY_WIDTH = 220;
const MIN_TERMINAL_HEIGHT = 120;
const MIN_EDITOR_WIDTH = 320;
const MIN_EDITOR_HEIGHT = 160;
const KEYBOARD_STEP = 10;
const LARGE_KEYBOARD_STEP = 40;

function getActivityWidth(app) {
  const value = Number.parseFloat(getComputedStyle(app).getPropertyValue("--activity-w"));
  return Number.isFinite(value) ? value : 40;
}

function getRenderedSize(element, dimension, fallback) {
  const value = element.getBoundingClientRect()[dimension];
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function setSeparatorValue(handle, value, min, max) {
  handle.setAttribute("aria-valuemin", String(Math.round(min)));
  handle.setAttribute("aria-valuemax", String(Math.round(max)));
  handle.setAttribute("aria-valuenow", String(Math.round(value)));
}

export function bindPanelResize({
  root = document.documentElement,
  app,
  workbench,
  primaryPanel,
  secondaryPanel,
  terminalPanel,
  primaryController,
  secondaryController,
  terminalController,
  primaryHandle,
  secondaryHandle,
  terminalHandle,
  onLayoutChange
}) {
  let layoutState = {
    primaryWidth: getRenderedSize(primaryPanel, "width", DEFAULT_PRIMARY_WIDTH),
    secondaryWidth: getRenderedSize(secondaryPanel, "width", DEFAULT_SECONDARY_WIDTH),
    terminalHeight: getRenderedSize(terminalPanel, "height", DEFAULT_TERMINAL_HEIGHT),
    primaryVisible: primaryController.isVisible(),
    secondaryVisible: secondaryController.isVisible(),
    terminalVisible: terminalController.isVisible(),
    ...loadPanelLayout()
  };

  primaryController.setVisible(layoutState.primaryVisible, false);
  secondaryController.setVisible(layoutState.secondaryVisible, false);
  terminalController.setVisible(layoutState.terminalVisible, false);

  function getHorizontalMaximum(otherPanel) {
    const otherWidth = otherPanel.hidden ? 0 : otherPanel.getBoundingClientRect().width;
    return Math.max(
      MIN_PRIMARY_WIDTH,
      app.clientWidth - getActivityWidth(app) - otherWidth - MIN_EDITOR_WIDTH
    );
  }

  const configurations = [
    {
      handle: primaryHandle,
      axis: "x",
      direction: 1,
      variable: "--sidebar-w",
      storageKey: "primaryWidth",
      minimum: MIN_PRIMARY_WIDTH,
      current: () => primaryPanel.getBoundingClientRect().width,
      maximum: () => getHorizontalMaximum(secondaryPanel)
    },
    {
      handle: secondaryHandle,
      axis: "x",
      direction: -1,
      variable: "--sidebar1-w",
      storageKey: "secondaryWidth",
      minimum: MIN_SECONDARY_WIDTH,
      current: () => secondaryPanel.getBoundingClientRect().width,
      maximum: () => Math.max(
        MIN_SECONDARY_WIDTH,
        app.clientWidth - getActivityWidth(app) -
          (primaryPanel.hidden ? 0 : primaryPanel.getBoundingClientRect().width) -
          MIN_EDITOR_WIDTH
      )
    },
    {
      handle: terminalHandle,
      axis: "y",
      direction: -1,
      variable: "--terminal-h",
      storageKey: "terminalHeight",
      minimum: MIN_TERMINAL_HEIGHT,
      current: () => terminalPanel.getBoundingClientRect().height,
      maximum: () => Math.max(
        MIN_TERMINAL_HEIGHT,
        workbench.clientHeight - MIN_EDITOR_HEIGHT
      )
    }
  ];

  function applySize(configuration, requestedSize, notify = true) {
    const maximum = configuration.maximum();
    const size = Math.round(clamp(requestedSize, configuration.minimum, maximum));
    layoutState[configuration.storageKey] = size;
    root.style.setProperty(configuration.variable, size + "px");
    setSeparatorValue(
      configuration.handle,
      size,
      configuration.minimum,
      maximum
    );
    if (notify) onLayoutChange?.();
    return size;
  }

  function persistLayout() {
    layoutState.primaryVisible = primaryController.isVisible();
    layoutState.secondaryVisible = secondaryController.isVisible();
    layoutState.terminalVisible = terminalController.isVisible();
    savePanelLayout(layoutState);
  }

  function synchronize(configuration) {
    const maximum = configuration.maximum();
    const current = clamp(
      configuration.current(),
      configuration.minimum,
      maximum
    );
    setSeparatorValue(
      configuration.handle,
      current,
      configuration.minimum,
      maximum
    );
  }

  function bindHandle(configuration) {
    const { handle, axis, direction } = configuration;
    let activePointerId = null;
    let startCoordinate = 0;
    let startSize = 0;

    function coordinateFrom(event) {
      return axis === "x" ? event.clientX : event.clientY;
    }

    function finish(event) {
      if (activePointerId === null || event.pointerId !== activePointerId) return;
      if (handle.hasPointerCapture?.(activePointerId)) {
        handle.releasePointerCapture(activePointerId);
      }
      activePointerId = null;
      handle.classList.remove("is-resizing");
      document.body.classList.remove("panel-resizing");
      persistLayout();
      onLayoutChange?.();
    }

    handle.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      activePointerId = event.pointerId;
      startCoordinate = coordinateFrom(event);
      startSize = configuration.current();
      handle.setPointerCapture?.(activePointerId);
      handle.classList.add("is-resizing");
      document.body.classList.add("panel-resizing");
    });

    handle.addEventListener("pointermove", (event) => {
      if (activePointerId === null || event.pointerId !== activePointerId) return;
      const delta = (coordinateFrom(event) - startCoordinate) * direction;
      applySize(configuration, startSize + delta);
    });

    handle.addEventListener("pointerup", finish);
    handle.addEventListener("pointercancel", finish);
    handle.addEventListener("lostpointercapture", finish);

    handle.addEventListener("keydown", (event) => {
      const coordinateDelta = axis === "x"
        ? ({ ArrowLeft: -1, ArrowRight: 1 })[event.key]
        : ({ ArrowUp: -1, ArrowDown: 1 })[event.key];
      if (!coordinateDelta) return;
      event.preventDefault();
      const step = event.shiftKey ? LARGE_KEYBOARD_STEP : KEYBOARD_STEP;
      applySize(
        configuration,
        configuration.current() + coordinateDelta * direction * step
      );
      persistLayout();
    });
  }

  configurations.forEach(bindHandle);
  configurations.forEach((configuration) => {
    applySize(configuration, layoutState[configuration.storageKey], false);
  });
  persistLayout();
  configurations.forEach(synchronize);

  window.addEventListener("resize", () => {
    configurations.forEach((configuration) => {
      if (configuration.current() > 0) {
        applySize(configuration, layoutState[configuration.storageKey], false);
      }
    });
    persistLayout();
    configurations.forEach(synchronize);
  });

  function reset(notify = true) {
    clearPanelLayout();
    configurations.forEach(({ variable }) => root.style.removeProperty(variable));
    layoutState = {
      primaryWidth: getRenderedSize(primaryPanel, "width", DEFAULT_PRIMARY_WIDTH),
      secondaryWidth: getRenderedSize(secondaryPanel, "width", DEFAULT_SECONDARY_WIDTH),
      terminalHeight: getRenderedSize(terminalPanel, "height", DEFAULT_TERMINAL_HEIGHT),
      primaryVisible: primaryController.isVisible(),
      secondaryVisible: secondaryController.isVisible(),
      terminalVisible: terminalController.isVisible()
    };
    configurations.forEach(synchronize);
    if (notify) onLayoutChange?.();
  }

  return Object.freeze({
    persist: persistLayout,
    reset,
    synchronize: () => configurations.forEach(synchronize)
  });
}
