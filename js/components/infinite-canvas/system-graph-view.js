import { filterSystemGraph, layoutSystemGraph } from "./system-graph-model.js";

export const SYSTEM_GRAPH_VIEWS_STORAGE_KEY = "creedSystemGraphViews.v1";
const CATEGORY_LABELS = Object.freeze({ html: "HTML", css: "CSS", js: "JavaScript", component: "Components", dom: "DOM IDs" });
const NODE_WIDTH = 300;
const NODE_HEIGHT = 118;
const GRAPH_GAP = 84;

function safeStorage() {
  if (typeof localStorage !== "undefined") return localStorage;
  const values = new Map();
  return { getItem: (key) => values.get(key) || null, setItem: (key, value) => values.set(key, String(value)), removeItem: (key) => values.delete(key) };
}

function button(label, title = label) {
  const element = document.createElement("button");
  element.type = "button";
  element.textContent = label;
  element.title = title;
  return element;
}

function style(element, values) {
  Object.assign(element.style, values);
  return element;
}

function loadViews(storage) {
  try {
    const parsed = JSON.parse(storage.getItem(SYSTEM_GRAPH_VIEWS_STORAGE_KEY));
    if (!parsed || parsed.version !== 2 || !Array.isArray(parsed.views)) return [];
    return parsed.views.filter((view) => view && typeof view.name === "string");
  } catch {
    return [];
  }
}

function persistViews(storage, views) {
  storage.setItem(SYSTEM_GRAPH_VIEWS_STORAGE_KEY, JSON.stringify({ version: 2, views }));
}

function normalizePositions(graph) {
  const raw = layoutSystemGraph(graph);
  if (!raw.size) return { positions: raw, width: 640, height: 420 };
  const values = [...raw.values()];
  const minX = Math.min(...values.map((point) => point.x));
  const minY = Math.min(...values.map((point) => point.y));
  const maxX = Math.max(...values.map((point) => point.x));
  const maxY = Math.max(...values.map((point) => point.y));
  const positions = new Map();
  for (const [id, point] of raw) {
    positions.set(id, {
      x: point.x - minX + (NODE_WIDTH / 2) + 40,
      y: point.y - minY + (NODE_HEIGHT / 2) + 40
    });
  }
  return {
    positions,
    width: Math.max(640, maxX - minX + NODE_WIDTH + 80),
    height: Math.max(420, maxY - minY + NODE_HEIGHT + 80)
  };
}

function graphNodeDescription(node) {
  if (node.type === "dom") return `${node.tag || "DOM"} · ${node.fileName || "workspace"}`;
  if (node.fileName) return `${CATEGORY_LABELS[node.category] || node.category || node.type} · ${node.fileName}`;
  return CATEGORY_LABELS[node.category] || node.category || node.type || "System node";
}

export function bindSystemGraph({
  host,
  controlsHost = host,
  anchorRecord = null,
  anchorElement = null,
  service,
  openFile,
  notify,
  storage = safeStorage()
} = {}) {
  if (!host || !controlsHost || !service?.getGraph || !service?.refresh) {
    throw new TypeError("System Graph requires a canvas host, controls host and graph service.");
  }

  style(controlsHost, { display: "grid", gap: "8px", minHeight: "0", overflow: "visible" });
  const toolbar = style(document.createElement("section"), {
    display: "grid", gap: "7px", fontSize: "12px", background: "transparent"
  });
  toolbar.id = "systemGraphToolbar";
  toolbar.setAttribute("aria-label", "System graph controls");
  toolbar.addEventListener("pointerdown", (event) => event.stopPropagation());

  const topRow = style(document.createElement("div"), { display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" });
  const refreshButton = button("Refresh Graph");
  refreshButton.id = "refreshSystemGraphBtn";
  const layoutButton = button("Auto Layout");
  layoutButton.id = "layoutSystemGraphBtn";
  const status = style(document.createElement("span"), { opacity: ".68" });
  status.id = "systemGraphStatus";
  topRow.append(refreshButton, layoutButton, status);

  const filterRow = style(document.createElement("div"), { display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" });
  const categoryInputs = new Map();
  for (const [category, label] of Object.entries(CATEGORY_LABELS)) {
    const wrapper = style(document.createElement("label"), { display: "inline-flex", gap: "3px", alignItems: "center" });
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = true;
    input.value = category;
    input.dataset.graphCategory = category;
    wrapper.append(input, document.createTextNode(label));
    filterRow.append(wrapper);
    categoryInputs.set(category, input);
  }

  const symbolRow = style(document.createElement("div"), { display: "flex", gap: "6px" });
  const symbolInput = document.createElement("input");
  symbolInput.id = "systemGraphSymbolInput";
  symbolInput.type = "search";
  symbolInput.placeholder = "Find symbol";
  symbolInput.setAttribute("aria-label", "Find symbol in system graph");
  style(symbolInput, { flex: "1 1 160px", minWidth: "100px" });
  const symbolButton = button("Locate");
  symbolButton.id = "locateSystemGraphSymbolBtn";
  symbolRow.append(symbolInput, symbolButton);

  const viewRow = style(document.createElement("div"), { display: "grid", gridTemplateColumns: "1fr auto", gap: "6px", alignItems: "center" });
  const viewName = document.createElement("input");
  viewName.id = "systemGraphViewName";
  viewName.placeholder = "Named view";
  const saveViewButton = button("Save");
  const viewSelect = document.createElement("select");
  viewSelect.id = "systemGraphSavedViews";
  const viewActions = style(document.createElement("div"), { display: "flex", gap: "6px" });
  const loadViewButton = button("Load");
  const deleteViewButton = button("Delete");
  viewActions.append(loadViewButton, deleteViewButton);
  viewRow.append(viewName, saveViewButton, viewSelect, viewActions);
  toolbar.append(topRow, filterRow, symbolRow, viewRow);
  controlsHost.append(toolbar);

  const stage = style(document.createElement("section"), {
    position: "absolute", left: "0", top: "0", width: "640px", height: "420px",
    overflow: "visible", pointerEvents: "none", zIndex: "1"
  });
  stage.id = "systemGraphLayer";
  stage.dataset.canvasGraph = "system-graph";
  stage.setAttribute("aria-label", "CREED system graph connections");

  const edgesSvg = style(document.createElementNS("http://www.w3.org/2000/svg", "svg"), {
    position: "absolute", inset: "0", pointerEvents: "none", overflow: "visible", zIndex: "0"
  });
  edgesSvg.setAttribute("aria-hidden", "true");
  const nodeHost = style(document.createElement("div"), { position: "absolute", inset: "0", pointerEvents: "none", zIndex: "1" });
  stage.append(edgesSvg, nodeHost);
  host.append(stage);

  let graph = service.getGraph() || { nodes: [], edges: [], symbols: [] };
  let positions = new Map();
  let views = loadViews(storage);
  let currentLayout = { positions, width: 640, height: 420 };

  function activeCategories() {
    return [...categoryInputs].filter(([, input]) => input.checked).map(([category]) => category);
  }

  function positionStage() {
    const width = Number(anchorRecord?.width) || 300;
    const worldX = Number(anchorRecord?.worldX) || 0;
    const worldY = Number(anchorRecord?.worldY) || 0;
    const anchorHalfWidth = Math.min(width, 380) / 2;
    stage.style.left = `${worldX + anchorHalfWidth + GRAPH_GAP}px`;
    stage.style.top = `${worldY - (currentLayout.height / 2)}px`;
    stage.style.width = `${currentLayout.width}px`;
    stage.style.height = `${currentLayout.height}px`;
  }

  function renderViews() {
    const selected = viewSelect.value;
    const fragment = document.createDocumentFragment();
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = views.length ? "Saved views…" : "No saved views";
    fragment.append(placeholder);
    for (const item of views) {
      const option = document.createElement("option");
      option.value = item.name;
      option.textContent = item.name;
      fragment.append(option);
    }
    viewSelect.replaceChildren(fragment);
    if (views.some((item) => item.name === selected)) viewSelect.value = selected;
  }

  function drawEdges(filtered) {
    const fragment = document.createDocumentFragment();
    for (const edge of filtered.edges) {
      const from = positions.get(edge.from);
      const to = positions.get(edge.to);
      if (!from || !to) continue;
      const forward = from.x <= to.x;
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", String(from.x + (forward ? NODE_WIDTH / 2 : -NODE_WIDTH / 2)));
      line.setAttribute("y1", String(from.y));
      line.setAttribute("x2", String(to.x + (forward ? -NODE_WIDTH / 2 : NODE_WIDTH / 2)));
      line.setAttribute("y2", String(to.y));
      line.setAttribute("stroke", edge.type === "owner" ? "#8b5cf6" : edge.type === "dom" ? "#64748b" : edge.type === "css-import" ? "#2563eb" : "#059669");
      line.setAttribute("stroke-width", edge.type === "contains" ? "1" : "1.5");
      line.setAttribute("stroke-dasharray", edge.type === "owner" ? "5 4" : edge.type === "contains" ? "2 4" : "");
      line.setAttribute("vector-effect", "non-scaling-stroke");
      line.dataset.edgeType = edge.type;
      fragment.append(line);
    }
    edgesSvg.replaceChildren(fragment);
  }

  function renderNodes(filtered) {
    const fragment = document.createDocumentFragment();
    for (const node of filtered.nodes) {
      const position = positions.get(node.id);
      if (!position) continue;
      const nodeCard = document.createElement("section");
      nodeCard.className = "canvas-card canvas-card--origin system-graph-node";
      nodeCard.tabIndex = 0;
      nodeCard.setAttribute("role", "button");
      nodeCard.dataset.nodeId = node.id;
      nodeCard.dataset.nodeCategory = node.category || node.type;
      nodeCard.dataset.fileName = node.fileName || "";
      nodeCard.setAttribute("aria-label", `${node.label} system graph node`);
      Object.assign(nodeCard.style, {
        left: `${position.x}px`, top: `${position.y}px`, width: `${NODE_WIDTH}px`, minHeight: `${NODE_HEIGHT}px`,
        boxSizing: "border-box", pointerEvents: "auto", cursor: node.fileName ? "pointer" : "default", zIndex: "1"
      });

      const kind = document.createElement("small");
      kind.textContent = `● ${node.type === "dom" ? "DOM" : (CATEGORY_LABELS[node.category] || node.category || node.type || "SYSTEM")}`;
      const label = document.createElement("h1");
      label.textContent = node.label;
      const description = document.createElement("p");
      description.textContent = graphNodeDescription(node);
      nodeCard.append(kind, label, description);

      function activate() {
        nodeCard.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
        if (node.fileName) openFile?.(node.fileName);
      }
      nodeCard.addEventListener("click", activate);
      nodeCard.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        activate();
      });
      fragment.append(nodeCard);
    }
    nodeHost.replaceChildren(fragment);
  }

  function render() {
    const filtered = filterSystemGraph(graph, activeCategories());
    currentLayout = normalizePositions(filtered);
    positions = currentLayout.positions;
    edgesSvg.setAttribute("width", String(currentLayout.width));
    edgesSvg.setAttribute("height", String(currentLayout.height));
    positionStage();
    drawEdges(filtered);
    renderNodes(filtered);
    status.textContent = `${filtered.nodes.length} nodes · ${filtered.edges.length} edges`;
  }

  function autoLayout() {
    render();
    return positions;
  }

  function focusSymbol(symbolName) {
    const needle = String(symbolName || "").trim().toLowerCase();
    if (!needle) return false;
    const symbol = graph.symbols.find((item) => item.name.toLowerCase() === needle)
      || graph.symbols.find((item) => item.name.toLowerCase().includes(needle));
    if (!symbol) {
      notify?.(`Symbol not found: ${symbolName}`);
      return false;
    }
    const target = nodeHost.querySelector(`[data-node-id="${CSS.escape(symbol.nodeId)}"]`);
    target?.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
    target?.focus({ preventScroll: true });
    if (symbol.fileName) openFile?.(symbol.fileName);
    notify?.(`Located ${symbol.name} in ${symbol.fileName}`);
    return Boolean(target);
  }

  async function refresh() {
    status.textContent = "Indexing system graph…";
    graph = await service.refresh();
    render();
    return true;
  }

  function saveNamedView(rawName = viewName.value) {
    const name = String(rawName || "").trim();
    if (!name) return false;
    const record = { name, categories: activeCategories() };
    const existing = views.findIndex((item) => item.name === name);
    if (existing >= 0) views[existing] = record;
    else views.push(record);
    views.sort((a, b) => a.name.localeCompare(b.name));
    persistViews(storage, views);
    renderViews();
    viewSelect.value = name;
    notify?.(`Saved graph view: ${name}`);
    return true;
  }

  function loadNamedView(name = viewSelect.value) {
    const record = views.find((item) => item.name === name);
    if (!record) return false;
    for (const [category, input] of categoryInputs) input.checked = record.categories?.includes(category) ?? true;
    render();
    notify?.(`Loaded graph view: ${record.name}`);
    return true;
  }

  function deleteNamedView(name = viewSelect.value) {
    const next = views.filter((item) => item.name !== name);
    if (next.length === views.length) return false;
    views = next;
    persistViews(storage, views);
    renderViews();
    notify?.(`Deleted graph view: ${name}`);
    return true;
  }

  refreshButton.addEventListener("click", () => refresh().catch((error) => notify?.(error instanceof Error ? error.message : String(error))));
  layoutButton.addEventListener("click", autoLayout);
  categoryInputs.forEach((input) => input.addEventListener("change", render));
  symbolButton.addEventListener("click", () => focusSymbol(symbolInput.value));
  symbolInput.addEventListener("keydown", (event) => { if (event.key === "Enter") { event.preventDefault(); focusSymbol(symbolInput.value); } });
  saveViewButton.addEventListener("click", () => saveNamedView());
  loadViewButton.addEventListener("click", () => loadNamedView());
  deleteViewButton.addEventListener("click", () => deleteNamedView());

  const unsubscribe = service.subscribe((nextGraph) => { graph = nextGraph; render(); });
  const anchorObserver = anchorElement && typeof MutationObserver !== "undefined"
    ? new MutationObserver(positionStage)
    : null;
  anchorObserver?.observe(anchorElement, { attributes: true, attributeFilter: ["style", "data-window-state"] });

  graph = service.getGraph();
  renderViews();
  render();
  if (!graph.nodes?.length) refresh().catch(() => {});

  return Object.freeze({
    layer: stage,
    toolbar,
    refresh,
    autoLayout,
    focusSymbol,
    saveNamedView,
    loadNamedView,
    deleteNamedView,
    getGraph: () => graph,
    destroy() {
      unsubscribe?.();
      anchorObserver?.disconnect();
      toolbar.remove();
      stage.remove();
    }
  });
}
