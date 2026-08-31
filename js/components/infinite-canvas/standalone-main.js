import { state } from "../../core/state.js";
import { loadState } from "../../core/storage.js";
import { createInfiniteCanvasRuntime } from "./infinitecanvas-main.js";
import { createCanvasComponentRegistry } from "./component-registry.js";
import { bindCanvasComponentManager } from "./component-manager.js";
import { registerDefaultCanvasComponents } from "./component-definitions.js";

const canvasPartialUrl = new URL("../../../ui/infinite-canvas.html", import.meta.url);

function requireElement(root, selector) {
  const element = root.querySelector(selector);
  if (!element) throw new Error(`Standalone infinite canvas is missing ${selector}.`);
  return element;
}

function createInertElement(tagName = "div") {
  return document.createElement(tagName);
}

function createStandaloneElements(host) {
  const canvas = requireElement(host, "#canvasViewport");
  const inertButton = () => createInertElement("button");
  const inertPanel = () => createInertElement("section");
  const lodRows = [1, 2, 4, 8].map((order) => {
    const row = createInertElement();
    row.dataset.order = String(order);
    return row;
  });

  return {
    canvas,
    world: requireElement(host, "#canvasWorld"),
    originCard: requireElement(host, "#originCard"),
    jsonComponentCard: requireElement(host, "#jsonComponentCard"),
    grids: Object.fromEntries(
      [...host.querySelectorAll(".infinite-canvas__grid[data-grid-order]")]
        .map((layer) => [Number(layer.dataset.gridOrder), layer])
    ),
    zoomRange: requireElement(host, "#zoomRange"),
    zoomReadout: requireElement(host, "#zoomReadout"),
    lodBadge: requireElement(host, "#lodBadge"),
    zoomInBtn: requireElement(host, "#zoomInBtn"),
    zoomOutBtn: requireElement(host, "#zoomOutBtn"),
    anchorMarker: requireElement(host, "#anchorMarker"),
    toast: requireElement(document, "#toastRegion"),

    canvasMenuBtn: inertButton(),
    infiniteCanvasMenuBtn: inertButton(),
    componentsMenuBtn: inertButton(),
    canvasControlsPanel: inertPanel(),
    componentsPanel: inertPanel(),
    addJsonCardBtn: inertButton(),
    setAnchorBtn: inertButton(),
    goAnchorBtn: inertButton(),
    clearAnchorBtn: inertButton(),
    homeBtn: inertButton(),
    canvasResetBtn: inertButton(),
    infiniteResetBtn: inertButton(),
    xStat: createInertElement("span"),
    yStat: createInertElement("span"),
    zoomStat: createInertElement("span"),
    orderStat: createInertElement("span"),
    lodRows
  };
}

async function mountCanvasPartial(host) {
  const response = await fetch(canvasPartialUrl, { cache: "no-cache" });
  if (!response.ok) throw new Error(`Unable to load infinite canvas partial (${response.status}).`);
  host.innerHTML = await response.text();
}

function showLoadFailure(host, error) {
  console.error(error);
  host.innerHTML = "";
  const message = document.createElement("div");
  message.className = "standalone-canvas-shell__error";
  message.textContent = "Infinite Canvas could not start. Run CREED through its local HTTP server instead of opening this page with file://.";
  host.append(message);
}

async function startStandaloneCanvas() {
  const host = document.getElementById("standaloneCanvasView");
  if (!host) throw new Error("Missing #standaloneCanvasView host.");

  await mountCanvasPartial(host);
  const elements = createStandaloneElements(host);
  const restored = loadState(elements.canvas);
  const infiniteCanvas = createInfiniteCanvasRuntime(elements, { stateAlreadyLoaded: restored });
  const componentRegistry = registerDefaultCanvasComponents(createCanvasComponentRegistry());

  state.canvasComponents = (state.canvasComponents || []).filter((item) => componentRegistry.has(item.type));

  const componentManager = bindCanvasComponentManager({
    canvas: elements.canvas,
    world: elements.world,
    state,
    registry: componentRegistry,
    update: infiniteCanvas.update,
    persist: infiniteCanvas.persist,
    history: infiniteCanvas.history
  });

  const inertPanelController = Object.freeze({ setVisible() {} });
  const inertPanelResize = Object.freeze({ reset() {} });

  infiniteCanvas.persist();
  infiniteCanvas.bind({
    showCanvas() {},
    resetEditorWorkspace() {},
    primarySidebar: inertPanelController,
    secondarySidebar: inertPanelController,
    bottomPanel: inertPanelController,
    panelResize: inertPanelResize,
    onAddJsonCard: () => componentManager.add("json-file"),
    onCanvasReset: () => componentManager.renderAll(),
    onInfiniteReset: () => componentManager.renderAll(),
    componentItemsProvider: componentManager.getRecords
  });

  requestAnimationFrame(() => componentManager.renderAll());
}

startStandaloneCanvas().catch((error) => {
  const host = document.getElementById("standaloneCanvasView");
  if (host) showLoadFailure(host, error);
  else console.error(error);
});
