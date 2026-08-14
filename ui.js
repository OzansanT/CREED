import { updateGridLOD } from "./grid-lod.js";
import { getViewportWorldCenter } from "./coordinates.js";

function cleanCoordinate(value) {
  const rounded = Math.round(value);
  return Object.is(rounded, -0) ? 0 : rounded;
}

export function updateUI(elements, state) {
  updateGridLOD(elements, state);

  const sidebarView = ["canvas", "infiniteCanvas", "components"].includes(state.sidebarView)
    ? state.sidebarView
    : "canvas";
  elements.canvasMenuBtn.classList.toggle("active", sidebarView === "canvas");
  elements.infiniteCanvasMenuBtn.classList.toggle("active", sidebarView === "infiniteCanvas");
  elements.componentsMenuBtn.classList.toggle("active", sidebarView === "components");
  elements.canvasMenuBtn.setAttribute("aria-selected", String(sidebarView === "canvas"));
  elements.infiniteCanvasMenuBtn.setAttribute("aria-selected", String(sidebarView === "infiniteCanvas"));
  elements.componentsMenuBtn.setAttribute("aria-selected", String(sidebarView === "components"));
  elements.canvasControlsPanel.hidden = sidebarView !== "canvas";
  elements.infiniteCanvasPanel.hidden = sidebarView !== "infiniteCanvas";
  elements.componentsPanel.hidden = sidebarView !== "components";

  elements.world.style.transform =
    `translate(${state.x}px, ${state.y}px) scale(${state.zoom})`;
  elements.originCard.style.left = `${state.originCard.worldX}px`;
  elements.originCard.style.top = `${state.originCard.worldY}px`;
  elements.jsonComponentCard.hidden = !state.jsonCard.visible;
  elements.jsonComponentCard.style.left = `${state.jsonCard.worldX}px`;
  elements.jsonComponentCard.style.top = `${state.jsonCard.worldY}px`;

  const percent = Math.round(state.zoom * 100);
  elements.zoomRange.value = percent;
  elements.zoomReadout.textContent = `${percent}%`;
  elements.zoomStat.textContent = `${percent}%`;

  // Display the world coordinate under the center of the viewport,
  // not the internal screen-translation offsets.
  const cameraPosition = getViewportWorldCenter(elements.canvas, state);
  elements.xStat.textContent = cleanCoordinate(cameraPosition.x);
  elements.yStat.textContent = cleanCoordinate(cameraPosition.y);

  const hasAnchor = Boolean(state.anchor);
  elements.goAnchorBtn.disabled = !hasAnchor;
  elements.clearAnchorBtn.disabled = !hasAnchor;

  if (hasAnchor) {
    elements.anchorMarker.style.left = `${state.anchor.worldX}px`;
    elements.anchorMarker.style.top = `${state.anchor.worldY}px`;
    elements.anchorMarker.classList.add("visible");
  } else {
    elements.anchorMarker.classList.remove("visible");
  }
}
