import { clamp } from "./state.js";

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
  primaryHandle,
  secondaryHandle,
  terminalHandle,
  onLayoutChange
}) {
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
      minimum: MIN_PRIMARY_WIDTH,
      current: () => primaryPanel.getBoundingClientRect().width,
      maximum: () => getHorizontalMaximum(secondaryPanel)
    },
    {
      handle: secondaryHandle,
      axis: "x",
      direction: -1,
      variable: "--chat-w",
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
    const size = clamp(requestedSize, configuration.minimum, maximum);
    root.style.setProperty(configuration.variable, Math.round(size) + "px");
    setSeparatorValue(
      configuration.handle,
      size,
      configuration.minimum,
      maximum
    );
    if (notify) onLayoutChange?.();
    return size;
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
    });
  }

  configurations.forEach(bindHandle);
  window.addEventListener("resize", () => {
    configurations.forEach(synchronize);
  });
  configurations.forEach(synchronize);

  function reset(notify = true) {
    configurations.forEach(({ variable }) => root.style.removeProperty(variable));
    requestAnimationFrame(() => configurations.forEach(synchronize));
    if (notify) onLayoutChange?.();
  }

  return Object.freeze({
    reset,
    synchronize: () => configurations.forEach(synchronize)
  });
}
