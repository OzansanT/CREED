import { extractSourceSymbols } from "../editor-panel/workspace-symbols.js";

const JS_EXTENSIONS = new Set(["js", "mjs", "cjs"]);
const GRAPHABLE_EXTENSIONS = new Set(["html", "htm", "css", "js", "mjs", "cjs", "json", "md"]);

function extensionOf(path) {
  const name = String(path || "");
  const index = name.lastIndexOf(".");
  return index < 0 ? "" : name.slice(index + 1).toLowerCase();
}

function dirname(path) {
  const index = path.lastIndexOf("/");
  return index < 0 ? "" : path.slice(0, index);
}

function normalizeSegments(path) {
  const output = [];
  for (const segment of String(path || "").split("/")) {
    if (!segment || segment === ".") continue;
    if (segment === "..") output.pop();
    else output.push(segment);
  }
  return output.join("/");
}

function candidatePaths(specifier, importer) {
  if (!specifier || (!specifier.startsWith(".") && !specifier.startsWith("/"))) return [];
  const relative = specifier.startsWith("/")
    ? specifier.slice(1)
    : [dirname(importer), specifier].filter(Boolean).join("/");
  const base = normalizeSegments(relative).replace(/[?#].*$/, "");
  const candidates = [base];
  if (!extensionOf(base)) {
    candidates.push(`${base}.js`, `${base}.mjs`, `${base}.json`, `${base}.css`, `${base}.html`);
    candidates.push(`${base}/index.js`, `${base}/index.mjs`);
  }
  return candidates;
}

export function resolveWorkspaceDependency(specifier, importer, files) {
  const fileSet = files instanceof Set ? files : new Set(files || []);
  return candidatePaths(specifier, importer).find((candidate) => fileSet.has(candidate)) || "";
}

function collectJsDependencies(source) {
  const dependencies = new Set();
  const patterns = [
    /\b(?:import|export)\s+(?:[^"']*?\s+from\s+)?["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g
  ];
  for (const pattern of patterns) {
    for (const match of String(source || "").matchAll(pattern)) dependencies.add(match[1]);
  }
  return [...dependencies];
}

function collectCssDependencies(source) {
  const dependencies = new Set();
  for (const match of String(source || "").matchAll(/@import\s+(?:url\(\s*)?["']([^"']+)["']/g)) dependencies.add(match[1]);
  return [...dependencies];
}

function parseDomIds(fileName, source) {
  const nodes = [];
  const edges = [];
  const stack = [];
  const pattern = /<\/?([A-Za-z][\w:-]*)\b([^>]*)>/g;
  for (const match of String(source || "").matchAll(pattern)) {
    const raw = match[0];
    const tag = match[1].toLowerCase();
    const closing = raw.startsWith("</");
    const selfClosing = /\/\s*>$/.test(raw) || ["meta", "link", "img", "input", "br", "hr"].includes(tag);
    if (closing) {
      while (stack.length && stack.at(-1).tag !== tag) stack.pop();
      if (stack.length) stack.pop();
      continue;
    }
    const idMatch = match[2].match(/\bid=["']([^"']+)["']/i);
    const parent = [...stack].reverse().find((entry) => entry.id);
    if (idMatch) {
      const id = idMatch[1];
      const nodeId = `dom:${fileName}#${id}`;
      nodes.push({ id: nodeId, type: "dom", category: "dom", fileName, domId: id, label: `#${id}`, tag });
      edges.push({ id: `contains:${fileName}:${id}`, from: `file:${fileName}`, to: nodeId, type: "contains" });
      if (parent?.id) edges.push({ id: `dom:${fileName}:${parent.id}>${id}`, from: `dom:${fileName}#${parent.id}`, to: nodeId, type: "dom" });
    }
    if (!selfClosing) stack.push({ tag, id: idMatch?.[1] || "" });
  }
  return { nodes, edges };
}

function fileCategory(fileName) {
  const extension = extensionOf(fileName);
  if (["html", "htm"].includes(extension)) return "html";
  if (extension === "css") return "css";
  if (JS_EXTENSIONS.has(extension)) return "js";
  return "component";
}

export async function buildSystemGraph({ workspace } = {}) {
  if (!workspace?.listFiles || !workspace?.readFile) throw new TypeError("System graph requires a workspace file-system.");
  const files = workspace.listFiles();
  const fileSet = new Set(files);
  const sources = new Map();
  await Promise.all(files.map(async (fileName) => {
    try { sources.set(fileName, await workspace.readFile(fileName)); }
    catch { sources.set(fileName, ""); }
  }));

  const nodes = [];
  const edges = [];
  const symbols = [];
  const nodeIds = new Set();
  const pushNode = (node) => {
    if (nodeIds.has(node.id)) return;
    nodeIds.add(node.id);
    nodes.push(node);
  };

  for (const fileName of files) {
    const extension = extensionOf(fileName);
    if (!GRAPHABLE_EXTENSIONS.has(extension)) continue;
    pushNode({ id: `file:${fileName}`, type: "file", category: fileCategory(fileName), fileName, label: fileName.split("/").at(-1), extension });
    const source = sources.get(fileName) || "";
    for (const symbol of extractSourceSymbols(fileName, source)) symbols.push({ ...symbol, nodeId: `file:${fileName}` });

    const dependencies = JS_EXTENSIONS.has(extension)
      ? collectJsDependencies(source)
      : extension === "css" ? collectCssDependencies(source) : [];
    for (const specifier of dependencies) {
      const target = resolveWorkspaceDependency(specifier, fileName, fileSet);
      if (!target || !GRAPHABLE_EXTENSIONS.has(extensionOf(target))) continue;
      edges.push({
        id: `dependency:${fileName}->${target}:${specifier}`,
        from: `file:${fileName}`,
        to: `file:${target}`,
        type: extension === "css" ? "css-import" : "import",
        label: specifier
      });
    }

    if (["html", "htm"].includes(extension)) {
      const dom = parseDomIds(fileName, source);
      dom.nodes.forEach(pushNode);
      edges.push(...dom.edges);
    }
  }

  const jsFiles = files.filter((fileName) => JS_EXTENSIONS.has(extensionOf(fileName)));
  for (const node of nodes.filter((candidate) => candidate.type === "dom")) {
    for (const fileName of jsFiles) {
      const source = sources.get(fileName) || "";
      const escaped = node.domId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const ownershipPattern = new RegExp(`(?:getElementById\\(\\s*["']${escaped}["']|querySelector\\(\\s*["']#${escaped}["']|["']${escaped}["'])`);
      if (!ownershipPattern.test(source)) continue;
      edges.push({ id: `owner:${node.id}->${fileName}`, from: node.id, to: `file:${fileName}`, type: "owner" });
    }
  }

  return Object.freeze({
    nodes: nodes.filter((node) => node.type !== "file" || nodeIds.has(node.id)),
    edges: edges.filter((edge) => nodeIds.has(edge.from) && nodeIds.has(edge.to)),
    symbols,
    files: [...files],
    sources
  });
}

export function layoutSystemGraph(graph, { horizontalGap = 250, verticalGap = 110 } = {}) {
  const groups = new Map();
  const order = ["html", "css", "js", "component", "dom"];
  for (const node of graph?.nodes || []) {
    const key = node.category || node.type || "component";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(node);
  }
  const positions = new Map();
  let column = 0;
  for (const category of [...order, ...[...groups.keys()].filter((key) => !order.includes(key))]) {
    const items = groups.get(category);
    if (!items?.length) continue;
    items.sort((a, b) => (a.fileName || a.label).localeCompare(b.fileName || b.label) || a.label.localeCompare(b.label));
    const offset = -((items.length - 1) * verticalGap) / 2;
    items.forEach((node, index) => positions.set(node.id, { x: column * horizontalGap + 260, y: offset + index * verticalGap }));
    column += 1;
  }
  return positions;
}

export function filterSystemGraph(graph, categories) {
  const allowed = new Set(categories || []);
  const nodes = allowed.size ? graph.nodes.filter((node) => allowed.has(node.category || node.type)) : [...graph.nodes];
  const ids = new Set(nodes.map((node) => node.id));
  return { ...graph, nodes, edges: graph.edges.filter((edge) => ids.has(edge.from) && ids.has(edge.to)) };
}
