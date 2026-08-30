import { clamp } from "../../core/state.js";
import {
  clearPanelLayout,
  loadPanelLayout,
  savePanelLayout
} from "../../core/storage.js";

const DEFAULT_PRIMARY_WIDTH = 293;
const DEFAULT_SECONDARY_WIDTH = 290;
const DEFAULT_BOTTOM_PANEL_HEIGHT = 320;
const MIN_PRIMARY_WIDTH = 180;
const MIN_SECONDARY_WIDTH = 220;
const MIN_BOTTOM_PANEL_HEIGHT = 120;
const MIN_EDITOR_WIDTH = 320;
const MIN_EDITOR_HEIGHT = 160;
const KEYBOARD_STEP = 10;
const LARGE_KEYBOARD_STEP = 40;
const COMPACT_LAYOUT_WIDTH = 1500;
const NARROW_LAYOUT_WIDTH = 820;
const HIDDEN_SECONDARY_WIDTH = 1180;
const COMPACT_PRIMARY_MAX = 270;
const NARROW_PRIMARY_MAX = 230;
const COMPACT_SECONDARY_MAX = 250;

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

function getResponsiveMaximum(storageKey) {
  if (storageKey === "primaryWidth") {
    if (window.innerWidth <= NARROW_LAYOUT_WIDTH) return NARROW_PRIMARY_MAX;
    if (window.innerWidth <= COMPACT_LAYOUT_WIDTH) return COMPACT_PRIMARY_MAX;
  }

  if (storageKey === "secondaryWidth") {
    if (window.innerWidth <= HIDDEN_SECONDARY_WIDTH) return 0;
    if (window.innerWidth <= COMPACT_LAYOUT_WIDTH) return COMPACT_SECONDARY_MAX;
  }

  return Number.POSITIVE_INFINITY;
}

export function bindPanelResize({
  root = document.documentElement,
  app,
  workbench,
  primaryPanel,
  secondaryPanel,
  bottomPanel,
  primaryController,
  secondaryController,
  bottomController,
  primaryHandle,
  secondaryHandle,
  bottomHandle,
  onLayoutChange
}) {
  let layoutState = {
    primaryWidth: getRenderedSize(primaryPanel, "width", DEFAULT_PRIMARY_WIDTH),
    secondaryWidth: getRenderedSize(secondaryPanel, "width", DEFAULT_SECONDARY_WIDTH),
    bottomPanelHeight: getRenderedSize(bottomPanel, "height", DEFAULT_BOTTOM_PANEL_HEIGHT),
    primaryVisible: primaryController.isVisible(),
    secondaryVisible: secondaryController.isVisible(),
    bottomPanelVisible: bottomController.isVisible(),
    ...loadPanelLayout()
  };

  primaryController.setVisible(layoutState.primaryVisible, false);
  secondaryController.setVisible(layoutState.secondaryVisible, false);
  bottomController.setVisible(layoutState.bottomPanelVisible, false);

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
      variable: "--primary-sidebar-w",
      storageKey: "primaryWidth",
      minimum: MIN_PRIMARY_WIDTH,
      current: () => primaryPanel.getBoundingClientRect().width,
      maximum: () => getHorizontalMaximum(secondaryPanel)
    },
    {
      handle: secondaryHandle,
      axis: "x",
      direction: -1,
      variable: "--secondary-sidebar-w",
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
      handle: bottomHandle,
      axis: "y",
      direction: -1,
      variable: "--bottom-panel-h",
      storageKey: "bottomPanelHeight",
      minimum: MIN_BOTTOM_PANEL_HEIGHT,
      current: () => bottomPanel.getBoundingClientRect().height,
      maximum: () => Math.max(
        MIN_BOTTOM_PANEL_HEIGHT,
        workbench.clientHeight - MIN_EDITOR_HEIGHT
      )
    }
  ];

  function applySize(configuration, requestedSize, notify = true) {
    const maximum = configuration.maximum();
    const preferredSize = Math.round(clamp(requestedSize, configuration.minimum, maximum));
    const responsiveMaximum = getResponsiveMaximum(configuration.storageKey);
    const renderedSize = Math.min(preferredSize, responsiveMaximum);

    layoutState[configuration.storageKey] = preferredSize;
    root.style.setProperty(configuration.variable, renderedSize + "px");
    setSeparatorValue(
      configuration.handle,
      renderedSize,
      responsiveMaximum === 0 ? 0 : Math.min(configuration.minimum, responsiveMaximum),
      Math.min(maximum, responsiveMaximum)
    );
    if (notify) onLayoutChange?.();
    return renderedSize;
  }

  function persistLayout() {
    layoutState.primaryVisible = primaryController.isVisible();
    layoutState.secondaryVisible = secondaryController.isVisible();
    layoutState.bottomPanelVisible = bottomController.isVisible();
    savePanelLayout(layoutState);
  }

  function synchronize(configuration) {
    const maximum = configuration.maximum();
    const responsiveMaximum = getResponsiveMaximum(configuration.storageKey);
    const current = Math.min(
      clamp(configuration.current(), 0, maximum),
      responsiveMaximum
    );
    setSeparatorValue(
      configuration.handle,
      current,
      responsiveMaximum === 0 ? 0 : Math.min(configuration.minimum, responsiveMaximum),
      Math.min(maximum, responsiveMaximum)
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
      startSize = layoutState[configuration.storageKey];
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
        layoutState[configuration.storageKey] + coordinateDelta * direction * step
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
      applySize(configuration, layoutState[configuration.storageKey], false);
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
      bottomPanelHeight: getRenderedSize(bottomPanel, "height", DEFAULT_BOTTOM_PANEL_HEIGHT),
      primaryVisible: primaryController.isVisible(),
      secondaryVisible: secondaryController.isVisible(),
      bottomPanelVisible: bottomController.isVisible()
    };
    configurations.forEach((configuration) => {
      applySize(configuration, layoutState[configuration.storageKey], false);
    });
    configurations.forEach(synchronize);
    if (notify) onLayoutChange?.();
  }

  return Object.freeze({
    persist: persistLayout,
    reset,
    synchronize: () => configurations.forEach(synchronize)
  });
}
