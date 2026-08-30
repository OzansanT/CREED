const JS_EXTENSIONS = new Set(["js", "mjs", "cjs"]);

function extensionOf(path) {
  const index = String(path || "").lastIndexOf(".");
  return index < 0 ? "" : String(path).slice(index + 1).toLowerCase();
}

function dirname(path) {
  const index = String(path || "").lastIndexOf("/");
  return index < 0 ? "" : String(path).slice(0, index);
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

function resolveWorkspaceDependency(specifier, importer, files) {
  const fileSet = files instanceof Set ? files : new Set(files || []);
  return candidatePaths(specifier, importer).find((candidate) => fileSet.has(candidate)) || "";
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

export async function buildDependencyModel(workspace) {
  if (!workspace?.listFiles || !workspace?.readFile) throw new TypeError("Dependency analysis requires a workspace.");
  const files = workspace.listFiles();
  const fileSet = new Set(files);
  const nodes = [];
  const edges = [];

  for (const fileName of files) {
    const extension = extensionOf(fileName);
    if (!(JS_EXTENSIONS.has(extension) || extension === "css")) continue;
    nodes.push({
      id: `file:${fileName}`,
      type: "file",
      category: JS_EXTENSIONS.has(extension) ? "js" : "css",
      fileName
    });
    let source = "";
    try { source = await workspace.readFile(fileName); } catch { continue; }
    for (const specifier of collectRelativeImports(source, extension)) {
      const target = resolveWorkspaceDependency(specifier, fileName, fileSet);
      if (!target) continue;
      const targetExtension = extensionOf(target);
      if (!(JS_EXTENSIONS.has(targetExtension) || targetExtension === "css")) continue;
      edges.push({
        from: `file:${fileName}`,
        to: `file:${target}`,
        type: extension === "css" ? "css-import" : "import"
      });
    }
  }

  return Object.freeze({ nodes, edges });
}

export function findDependencyCycles(model) {
  const adjacency = new Map();
  for (const edge of model?.edges || []) {
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

export function findOrphanModules(model) {
  const jsNodes = (model?.nodes || []).filter((node) => node.type === "file" && node.category === "js");
  const incoming = new Map(jsNodes.map((node) => [node.id, 0]));
  for (const edge of model?.edges || []) {
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

export async function runWorkspaceDiagnostics({ workspace, dependencies = null } = {}) {
  if (!workspace) throw new TypeError("Workspace diagnostics require a workspace.");
  const resolvedDependencies = dependencies || await buildDependencyModel(workspace);
  const architecture = await findArchitectureViolations(workspace);
  const cycles = findDependencyCycles(resolvedDependencies);
  const orphans = findOrphanModules(resolvedDependencies);
  return Object.freeze({
    dependencies: resolvedDependencies,
    architecture,
    cycles,
    orphans,
    problems: [...architecture, ...cycles, ...orphans]
  });
}
