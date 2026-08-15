import { updateGridLOD } from "./grid-lod.js";
import { getViewportWorldCenter } from "./coordinates.js";
import { getActiveSavedView } from "./anchors.js";
import { worldToLocal } from "./coordinates.js";
import { syncConnectors } from "./connectors.js";
import { syncSelectionBounds } from "./selection-transform.js";

function cleanCoordinate(value) {
  const rounded = Math.round(value);
  return Object.is(rounded, -0) ? 0 : rounded;
}

export function updateUI(elements, state, featureUI = {}) {
  updateGridLOD(elements, state);

  const sidebarView = ["canvas", "infiniteCanvas", "components", "layers", "inspector"].includes(state.ui.sidebarView)
    ? state.ui.sidebarView
    : "canvas";
  elements.canvasMenuBtn.classList.toggle("active", sidebarView === "canvas");
  elements.infiniteCanvasMenuBtn.classList.toggle("active", sidebarView === "infiniteCanvas");
  elements.componentsMenuBtn.classList.toggle("active", sidebarView === "components");
  elements.layersMenuBtn.classList.toggle("active", sidebarView === "layers");
  elements.inspectorMenuBtn.classList.toggle("active", sidebarView === "inspector");
  elements.canvasMenuBtn.setAttribute("aria-selected", String(sidebarView === "canvas"));
  elements.infiniteCanvasMenuBtn.setAttribute("aria-selected", String(sidebarView === "infiniteCanvas"));
  elements.componentsMenuBtn.setAttribute("aria-selected", String(sidebarView === "components"));
  elements.layersMenuBtn.setAttribute("aria-selected", String(sidebarView === "layers"));
  elements.inspectorMenuBtn.setAttribute("aria-selected", String(sidebarView === "inspector"));
  elements.canvasControlsPanel.hidden = sidebarView !== "canvas";
  elements.componentsPanel.hidden = sidebarView !== "components";
  elements.layersPanel.hidden = sidebarView !== "layers";
  elements.inspectorPanel.hidden = sidebarView !== "inspector";

  const { x, y, zoom } = state.viewport;
  elements.world.style.transform = `translate(${x}px, ${y}px) scale(${zoom})`;
  elements.canvas.dataset.previewBreakpoint = state.ui.previewBreakpoint;
  featureUI.componentRenderer?.sync();
  syncConnectors(elements.connectorLayer, state);
  syncSelectionBounds(elements.selectionBounds, state);
  featureUI.layers?.sync();
  featureUI.inspector?.sync();
  featureUI.designTokens?.sync();
  featureUI.savedViews?.sync();
  featureUI.minimap?.sync();

  const percent = Math.round(zoom * 100);
  elements.zoomRange.value = percent;
  elements.zoomReadout.textContent = `${percent}%`;
  elements.zoomStat.textContent = `${percent}%`;

  // Display the world coordinate under the center of the viewport,
  // not the internal screen-translation offsets.
  const cameraPosition = getViewportWorldCenter(elements.canvas, state);
  elements.xStat.textContent = cleanCoordinate(cameraPosition.x);
  elements.yStat.textContent = cleanCoordinate(cameraPosition.y);

  const activeSavedView = getActiveSavedView(state);
  const hasAnchor = Boolean(activeSavedView);
  elements.goAnchorBtn.disabled = !hasAnchor;
  elements.clearAnchorBtn.disabled = !hasAnchor;

  if (hasAnchor) {
    const marker = worldToLocal(
      { x: activeSavedView.worldX, y: activeSavedView.worldY },
      state
    );
    elements.anchorMarker.style.left = `${marker.x}px`;
    elements.anchorMarker.style.top = `${marker.y}px`;
    elements.anchorMarker.querySelector(".anchor-label").textContent = activeSavedView.name;
    elements.anchorMarker.classList.add("visible");
  } else {
    elements.anchorMarker.classList.remove("visible");
  }
}
