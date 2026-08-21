import { buildSystemGraph, filterSystemGraph, layoutSystemGraph } from "./system-graph-model.js";

export const SYSTEM_GRAPH_VIEWS_STORAGE_KEY = "creedSystemGraphViews.v1";
const CATEGORY_LABELS = Object.freeze({ html: "HTML", css: "CSS", js: "JavaScript", component: "Components", dom: "DOM IDs" });
const NODE_WIDTH = 190;
const NODE_HEIGHT = 62;

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

function loadViews(storage) {
  try {
    const parsed = JSON.parse(storage.getItem(SYSTEM_GRAPH_VIEWS_STORAGE_KEY));
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.views)) return [];
    return parsed.views.filter((view) => view && typeof view.name === "string" && view.viewport);
  } catch {
    return [];
  }
}

function persistViews(storage, views) {
  storage.setItem(SYSTEM_GRAPH_VIEWS_STORAGE_KEY, JSON.stringify({ version: 1, views }));
}

function style(element, values) {
  Object.assign(element.style, values);
  return element;
}

export function bindSystemGraph({
  canvas,
  world,
  workspace,
  openFile,
  showCanvas,
  focusWorldPoint,
  captureViewport,
  restoreViewport,
  notify,
  storage = safeStorage()
} = {}) {
  if (!canvas || !world || !workspace) throw new TypeError("System graph requires canvas, world, and workspace.");

  const layer = style(document.createElement("section"), { position: "absolute", inset: "0", overflow: "visible", pointerEvents: "none" });
  layer.id = "systemGraphLayer";
  layer.setAttribute("aria-label", "CREED system graph");
  const edgesSvg = style(document.createElementNS("http://www.w3.org/2000/svg", "svg"), { position: "absolute", left: "0", top: "0", width: "1px", height: "1px", overflow: "visible", pointerEvents: "none" });
  edgesSvg.setAttribute("aria-hidden", "true");
  const nodeHost = style(document.createElement("div"), { position: "absolute", inset: "0", overflow: "visible", pointerEvents: "none" });
  layer.append(edgesSvg, nodeHost);
  world.append(layer);

  const toolbar = style(document.createElement("section"), {
    position: "absolute", left: "12px", top: "12px", zIndex: "8", width: "min(520px, calc(100% - 24px))",
    padding: "8px", border: "1px solid var(--border, #c8c8c8)", background: "var(--panel-bg, rgba(248,248,252,.96))",
    boxShadow: "0 3px 12px rgba(0,0,0,.10)", fontSize: "12px", display: "grid", gap: "6px"
  });
  toolbar.id = "systemGraphToolbar";
  toolbar.setAttribute("aria-label", "System graph controls");

  const topRow = style(document.createElement("div"), { display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" });
  const refreshButton = button("Refresh Graph");
  refreshButton.id = "refreshSystemGraphBtn";
  const layoutButton = button("Auto Layout");
  layoutButton.id = "layoutSystemGraphBtn";
  const status = document.createElement("span");
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
  symbolInput.placeholder = "Find symbol on canvas";
  symbolInput.setAttribute("aria-label", "Find symbol on canvas");
  style(symbolInput, { flex: "1 1 180px", minWidth: "100px" });
  const symbolButton = button("Locate Symbol");
  symbolButton.id = "locateSystemGraphSymbolBtn";
  symbolRow.append(symbolInput, symbolButton);

  const viewRow = style(document.createElement("div"), { display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" });
  const viewName = document.createElement("input");
  viewName.id = "systemGraphViewName";
  viewName.placeholder = "Named view";
  viewName.setAttribute("aria-label", "Named graph view");
  const saveViewButton = button("Save View");
  const viewSelect = document.createElement("select");
  viewSelect.id = "systemGraphSavedViews";
  viewSelect.setAttribute("aria-label", "Saved graph views");
  const loadViewButton = button("Load View");
  const deleteViewButton = button("Delete View");
  viewRow.append(viewName, saveViewButton, viewSelect, loadViewButton, deleteViewButton);
  toolbar.append(topRow, filterRow, symbolRow, viewRow);
  canvas.append(toolbar);

  let graph = { nodes: [], edges: [], symbols: [] };
  let positions = new Map();
  let views = loadViews(storage);
  let refreshTimer = 0;
  let generation = 0;

  function activeCategories() {
    return [...categoryInputs].filter(([, input]) => input.checked).map(([category]) => category);
  }

  function nodeById(nodeId) {
    return graph.nodes.find((node) => node.id === nodeId) || null;
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
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", String(from.x + NODE_WIDTH));
      line.setAttribute("y1", String(from.y + NODE_HEIGHT / 2));
      line.setAttribute("x2", String(to.x));
      line.setAttribute("y2", String(to.y + NODE_HEIGHT / 2));
      line.setAttribute("stroke", edge.type === "owner" ? "#8b5cf6" : edge.type === "dom" ? "#64748b" : edge.type === "css-import" ? "#2563eb" : "#059669");
      line.setAttribute("stroke-width", edge.type === "contains" ? "1" : "1.5");
      line.setAttribute("stroke-dasharray", edge.type === "owner" ? "5 4" : edge.type === "contains" ? "2 4" : "");
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
      const nodeButton = style(button(""), {
        position: "absolute", left: `${position.x}px`, top: `${position.y}px`, width: `${NODE_WIDTH}px`, minHeight: `${NODE_HEIGHT}px`,
        padding: "7px 9px", textAlign: "left", pointerEvents: "auto", border: "1px solid #9ca3af", borderRadius: "6px",
        background: node.type === "dom" ? "#f8fafc" : "#ffffff", color: "#111827", boxShadow: "0 2px 7px rgba(0,0,0,.10)"
      });
      nodeButton.className = "system-graph-node";
      nodeButton.dataset.nodeId = node.id;
      nodeButton.dataset.nodeCategory = node.category || node.type;
      nodeButton.dataset.fileName = node.fileName || "";
      const kind = document.createElement("small");
      kind.textContent = node.type === "dom" ? `${node.tag || "DOM"} · ${node.fileName}` : (CATEGORY_LABELS[node.category] || node.category || node.type);
      style(kind, { display: "block", opacity: ".65", marginBottom: "3px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" });
      const label = document.createElement("strong");
      label.textContent = node.label;
      style(label, { display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" });
      nodeButton.append(kind, label);
      nodeButton.addEventListener("click", () => {
        focusNode(node.id, { revealCanvas: false });
        if (node.fileName) openFile?.(node.fileName);
      });
      fragment.append(nodeButton);
    }
    nodeHost.replaceChildren(fragment);
  }

  function render() {
    const filtered = filterSystemGraph(graph, activeCategories());
    drawEdges(filtered);
    renderNodes(filtered);
    status.textContent = `${filtered.nodes.length} nodes · ${filtered.edges.length} edges`;
  }

  function autoLayout() {
    positions = layoutSystemGraph(graph);
    render();
    return positions;
  }

  function focusNode(nodeId, { revealCanvas = true } = {}) {
    const position = positions.get(nodeId);
    if (!position) return false;
    if (revealCanvas) showCanvas?.();
    focusWorldPoint?.(position.x + NODE_WIDTH / 2, position.y + NODE_HEIGHT / 2);
    const target = nodeHost.querySelector(`[data-node-id="${CSS.escape(nodeId)}"]`);
    target?.focus({ preventScroll: true });
    return true;
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
    const focused = focusNode(symbol.nodeId);
    if (focused) notify?.(`Located ${symbol.name} in ${symbol.fileName}`);
    return focused;
  }

  async function refresh() {
    const token = ++generation;
    status.textContent = "Indexing system graph…";
    const next = await buildSystemGraph({ workspace });
    if (token !== generation) return false;
    graph = next;
    autoLayout();
    return true;
  }

  function scheduleRefresh() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => refresh().catch((error) => notify?.(error instanceof Error ? error.message : String(error))), 160);
  }

  function saveNamedView(rawName = viewName.value) {
    const name = String(rawName || "").trim();
    if (!name) {
      notify?.("Enter a graph view name.");
      return false;
    }
    const record = { name, categories: activeCategories(), viewport: captureViewport?.() || null };
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
    showCanvas?.();
    if (record.viewport) restoreViewport?.(record.viewport);
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
  workspace.subscribe(scheduleRefresh);
  renderViews();
  refresh().catch((error) => notify?.(error instanceof Error ? error.message : String(error)));

  return Object.freeze({
    layer,
    toolbar,
    refresh,
    autoLayout,
    focusNode,
    focusSymbol,
    saveNamedView,
    loadNamedView,
    deleteNamedView,
    getGraph: () => graph,
    getPositions: () => new Map(positions)
  });
}
