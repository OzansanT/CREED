import { createCommand } from "../../core/command-engine.js";

const MIN_WIDTH = 220;
const MIN_HEIGHT = 140;
const DIRECTIONS = Object.freeze(["n", "ne", "e", "se", "s", "sw", "w", "nw"]);

export function calculateResizedBounds(start, direction, deltaX, deltaY, { minWidth = MIN_WIDTH, minHeight = MIN_HEIGHT } = {}) {
  const horizontal = direction.includes("e") ? 1 : direction.includes("w") ? -1 : 0;
  const vertical = direction.includes("s") ? 1 : direction.includes("n") ? -1 : 0;
  const nextWidth = Math.max(minWidth, start.width + (horizontal * deltaX));
  const nextHeight = Math.max(minHeight, start.height + (vertical * deltaY));
  const widthChange = nextWidth - start.width;
  const heightChange = nextHeight - start.height;
  return {
    worldX: start.worldX + (horizontal * widthChange / 2),
    worldY: start.worldY + (vertical * heightChange / 2),
    width: nextWidth,
    height: nextHeight
  };
}

function setBounds(record, bounds) {
  record.worldX = bounds.worldX;
  record.worldY = bounds.worldY;
  record.width = bounds.width;
  record.height = bounds.height;
}

function cursorFor(direction) {
  return ({ n: "ns-resize", s: "ns-resize", e: "ew-resize", w: "ew-resize", ne: "nesw-resize", sw: "nesw-resize", nw: "nwse-resize", se: "nwse-resize" })[direction];
}

function positionHandle(handle, direction) {
  const edge = "-5px";
  Object.assign(handle.style, {
    position: "absolute",
    zIndex: "5",
    width: direction === "n" || direction === "s" ? "calc(100% - 16px)" : "10px",
    height: direction === "e" || direction === "w" ? "calc(100% - 16px)" : "10px",
    cursor: cursorFor(direction),
    touchAction: "none",
    userSelect: "none"
  });
  if (direction.includes("n")) handle.style.top = edge;
  if (direction.includes("s")) handle.style.bottom = edge;
  if (direction.includes("w")) handle.style.left = edge;
  if (direction.includes("e")) handle.style.right = edge;
  if (direction === "n" || direction === "s") handle.style.left = "8px";
  if (direction === "e" || direction === "w") handle.style.top = "8px";
}

export function bindComponentResize({
  shell,
  record,
  state,
  persist,
  history,
  setPosition,
  applyRecordBounds,
  isResizable = () => true
} = {}) {
  if (!shell || !record || !state || typeof setPosition !== "function") {
    throw new TypeError("Component resize requires shell, record, state and setPosition.");
  }

  const applyById = typeof applyRecordBounds === "function"
    ? applyRecordBounds
    : (_id, bounds) => { setBounds(record, bounds); setPosition(shell, record); persist?.(); };
  const handles = [];

  for (const direction of DIRECTIONS) {
    const handle = document.createElement("div");
    handle.className = `canvas-component__resize-handle canvas-component__resize-handle--${direction}`;
    handle.dataset.resizeDirection = direction;
    handle.setAttribute("aria-hidden", "true");
    positionHandle(handle, direction);
    shell.append(handle);
    handles.push(handle);

    let pointerId = null;
    let startClientX = 0;
    let startClientY = 0;
    let startBounds = null;
    let resized = false;

    handle.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || pointerId !== null || !isResizable()) return;
      event.preventDefault();
      event.stopPropagation();
      pointerId = event.pointerId;
      startClientX = event.clientX;
      startClientY = event.clientY;
      startBounds = { worldX: record.worldX, worldY: record.worldY, width: record.width, height: record.height };
      resized = false;
      shell.classList.add("is-resizing");
      handle.setPointerCapture?.(pointerId);
    });

    handle.addEventListener("pointermove", (event) => {
      if (event.pointerId !== pointerId || !startBounds) return;
      event.preventDefault();
      event.stopPropagation();
      const deltaX = (event.clientX - startClientX) / Math.max(0.01, state.zoom);
      const deltaY = (event.clientY - startClientY) / Math.max(0.01, state.zoom);
      const next = calculateResizedBounds(startBounds, direction, deltaX, deltaY);
      resized ||= next.width !== startBounds.width || next.height !== startBounds.height;
      setBounds(record, next);
      setPosition(shell, record);
    });

    function finish(event) {
      if (pointerId === null || event.pointerId !== pointerId || !startBounds) return;
      event.stopPropagation?.();
      const activePointerId = pointerId;
      pointerId = null;
      shell.classList.remove("is-resizing");
      if (handle.hasPointerCapture?.(activePointerId)) handle.releasePointerCapture(activePointerId);
      if (!resized) return;
      const before = { ...startBounds };
      const after = { worldX: record.worldX, worldY: record.worldY, width: record.width, height: record.height };
      persist?.();
      history?.record(createCommand({
        label: `Resize ${record.type} component`,
        redo: () => applyById(record.id, after),
        undo: () => applyById(record.id, before),
        isNoop: () => before.worldX === after.worldX && before.worldY === after.worldY && before.width === after.width && before.height === after.height
      }));
    }

    handle.addEventListener("pointerup", finish);
    handle.addEventListener("pointercancel", finish);
    handle.addEventListener("lostpointercapture", (event) => {
      if (pointerId !== null) finish({ pointerId, stopPropagation: () => event.stopPropagation?.() });
    });
  }

  return () => handles.forEach((handle) => handle.remove());
}
