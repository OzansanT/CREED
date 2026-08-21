import { buildSystemGraph, resolveWorkspaceDependency } from "../infinite-canvas/system-graph-model.js";

const JS_EXTENSIONS = new Set(["js", "mjs", "cjs"]);

function extensionOf(path) {
  const index = String(path || "").lastIndexOf(".");
  return index < 0 ? "" : String(path).slice(index + 1).toLowerCase();
}

function normalizeDiagnostic(value, source = "workspace") {
  const severity = ["error", "warning", "info"].includes(value?.severity) ? value.severity : "warning";
  return Object.freeze({
    id: String(value?.id || `${source}:${value?.fileName || "workspace"}:${value?.line || 0}:${value?.code || value?.message || "diagnostic"}`),
    source: String(value?.source || source),
    severity,
    code: String(value?.code || "CREED"),
    message: String(value?.message || "Diagnostic"),
    fileName: String(value?.fileName || ""),
    line: Math.max(0, Math.trunc(Number(value?.line) || 0)),
    column: Math.max(0, Math.trunc(Number(value?.column) || 0)),
    related: Array.isArray(value?.related) ? value.related.map(String) : []
  });
}

export function createProblemsModel() {
  const bySource = new Map();
  const listeners = new Set();

  function list() {
    return [...bySource.values()].flat().sort((a, b) => {
      const rank = { error: 0, warning: 1, info: 2 };
      return rank[a.severity] - rank[b.severity]
        || a.fileName.localeCompare(b.fileName)
        || a.line - b.line
        || a.message.localeCompare(b.message);
    });
  }

  function emit(reason = "changed") {
    const snapshot = Object.freeze({ reason, problems: list(), counts: counts() });
    listeners.forEach((listener) => listener(snapshot));
    return snapshot;
  }

  function setSource(source, diagnostics = []) {
    bySource.set(String(source), diagnostics.map((item) => normalizeDiagnostic(item, source)));
    emit("source-set");
    return list();
  }

  function clearSource(source) {
    const changed = bySource.delete(String(source));
    if (changed) emit("source-cleared");
    return changed;
  }

  function clear() {
    bySource.clear();
    emit("cleared");
  }

  function counts() {
    return list().reduce((result, item) => {
      result[item.severity] += 1;
      return result;
    }, { error: 0, warning: 0, info: 0 });
  }

  return Object.freeze({
    list,
    counts,
    setSource,
    clearSource,
    clear,
    subscribe(listener) {
      if (typeof listener !== "function") throw new TypeError("Problems listener must be a function.");
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  });
}

export function parseCheckOutput(text, { source = "npm-check" } = {}) {
  const diagnostics = [];
  const lines = String(text || "").replace(/\r\n?/g, "\n").split("\n");
  lines.forEach((lineText, index) => {
    const location = lineText.match(/^(.+?):(\d+)(?::(\d+))?\s*[-:]\s*(.+)$/);
    if (location) {
      diagnostics.push(normalizeDiagnostic({
        source,
        severity: /\b(error|failed|assert)/i.test(location[4]) ? "error" : "warning",
        code: "CHECK",
        fileName: location[1],
        line: Math.max(0, Number(location[2]) - 1),
        column: Math.max(0, Number(location[3] || 1) - 1),
        message: location[4]
      }, source));
      return;
    }
    if (/AssertionError|SyntaxError|TypeError|ReferenceError|Architecture check failed|Process completed with exit code/i.test(lineText)) {
      diagnostics.push(normalizeDiagnostic({ source, severity: "error", code: "CHECK", message: lineText.trim(), line: index }, source));
    }
  });
  return diagnostics;
}

export function findDependencyCycles(graph) {
  const adjacency = new Map();
  for (const edge of graph?.edges || []) {
    if (!["import", "css-import"].includes(edge.type)) continue;
    if (!adjacency.has(edge.from)) adjacency.set(edge.from, []);
    adjacency.get(edge.from).push(edge.to);
  }
  const visited = new Set();
  const active = new Set();
  const stack = [];
  const seenCycles = new Set();
  const diagnostics = [];

  function visit(nodeId) {
    if (active.has(nodeId)) {
      const start = stack.indexOf(nodeId);
      const cycle = [...stack.slice(start), nodeId];
      const canonical = [...new Set(cycle)].sort().join("|");
      if (!seenCycles.has(canonical)) {
        seenCycles.add(canonical);
        const fileName = nodeId.replace(/^file:/, "");
        diagnostics.push(normalizeDiagnostic({
          source: "dependency-cycles",
          severity: "error",
          code: "CYCLE",
          fileName,
          message: `Dependency cycle: ${cycle.map((id) => id.replace(/^file:/, "")).join(" → ")}`,
          related: cycle.map((id) => id.replace(/^file:/, ""))
        }, "dependency-cycles"));
      }
      return;
    }
    if (visited.has(nodeId)) return;
    visited.add(nodeId);
    active.add(nodeId);
    stack.push(nodeId);
    for (const target of adjacency.get(nodeId) || []) visit(target);
    stack.pop();
    active.delete(nodeId);
  }

  for (const nodeId of adjacency.keys()) visit(nodeId);
  return diagnostics;
}

export function findOrphanModules(graph) {
  const jsNodes = (graph?.nodes || []).filter((node) => node.type === "file" && node.category === "js");
  const incoming = new Map(jsNodes.map((node) => [node.id, 0]));
  for (const edge of graph?.edges || []) {
    if (edge.type === "import" && incoming.has(edge.to)) incoming.set(edge.to, incoming.get(edge.to) + 1);
  }
  const entryPatterns = [/(^|\/)main\.js$/, /worker\.js$/, /-worker\.js$/, /service-worker\.js$/];
  return jsNodes
    .filter((node) => (incoming.get(node.id) || 0) === 0 && !entryPatterns.some((pattern) => pattern.test(node.fileName)))
    .map((node) => normalizeDiagnostic({
      source: "orphan-modules",
      severity: "warning",
      code: "ORPHAN",
      fileName: node.fileName,
      message: "JavaScript module has no incoming workspace import edge."
    }, "orphan-modules"));
}

function collectRelativeImports(source, extension) {
  const values = [];
  const patterns = extension === "css"
    ? [/@import\s+(?:url\(\s*)?["']([^"']+)["']/g]
    : [
      /\b(?:import|export)\s+(?:[^"']*?\s+from\s+)?["']([^"']+)["']/g,
      /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g
    ];
  for (const pattern of patterns) {
    for (const match of String(source || "").matchAll(pattern)) if (match[1]?.startsWith(".")) values.push(match[1]);
  }
  return values;
}

export async function findArchitectureViolations(workspace) {
  const diagnostics = [];
  const files = workspace.listFiles();
  const fileSet = new Set(files);
  for (const fileName of files) {
    if (/(?:-|_)(?:v\d+|fix|fixed|new|copy)\.[^.]+$/i.test(fileName)) {
      diagnostics.push(normalizeDiagnostic({
        source: "architecture",
        severity: "error",
        code: "DUPLICATE-SUFFIX",
        fileName,
        message: "Feature duplicate suffix violates the one-owner file rule."
      }, "architecture"));
    }
    const extension = extensionOf(fileName);
    if (!(JS_EXTENSIONS.has(extension) || extension === "css")) continue;
    let source = "";
    try { source = await workspace.readFile(fileName); } catch { continue; }
    for (const specifier of collectRelativeImports(source, extension)) {
      if (resolveWorkspaceDependency(specifier, fileName, fileSet)) continue;
      diagnostics.push(normalizeDiagnostic({
        source: "architecture",
        severity: "error",
        code: "UNRESOLVED-IMPORT",
        fileName,
        message: `Unresolved local dependency: ${specifier}`
      }, "architecture"));
    }
  }
  return diagnostics;
}

export async function runWorkspaceDiagnostics({ workspace, graph = null } = {}) {
  if (!workspace) throw new TypeError("Workspace diagnostics require a workspace.");
  const resolvedGraph = graph || await buildSystemGraph({ workspace });
  const architecture = await findArchitectureViolations(workspace);
  const cycles = findDependencyCycles(resolvedGraph);
  const orphans = findOrphanModules(resolvedGraph);
  return Object.freeze({
    graph: resolvedGraph,
    architecture,
    cycles,
    orphans,
    problems: [...architecture, ...cycles, ...orphans]
  });
}
