const WORKSPACE_MODULE_PREFIX = "creed-workspace/";

function normalizeWorkspacePath(value) {
  const raw = String(value || "").trim().replace(/\\/g, "/");
  if (!raw || /^(?:[a-z]+:|\/\/|#)/i.test(raw) || raw.startsWith("/")) return null;
  const parts = [];
  for (const part of raw.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") {
      if (!parts.length) return null;
      parts.pop();
      continue;
    }
    parts.push(part);
  }
  return parts.join("/") || null;
}

function dirname(path) {
  const index = path.lastIndexOf("/");
  return index < 0 ? "" : path.slice(0, index);
}

function resolveWorkspaceModule(importer, specifier) {
  const value = String(specifier || "");
  if (!value.startsWith("./") && !value.startsWith("../")) return null;
  const base = dirname(importer);
  return normalizeWorkspacePath(base ? `${base}/${value}` : value);
}

function moduleAlias(path) {
  return WORKSPACE_MODULE_PREFIX + path;
}

function rewriteModuleSpecifiers(source, importer, onDependency) {
  const rewrite = (specifier) => {
    const resolved = resolveWorkspaceModule(importer, specifier);
    if (!resolved) return specifier;
    onDependency(resolved);
    return moduleAlias(resolved);
  };

  let output = String(source).replace(
    /(\b(?:import|export)\s+(?:[^"'`]*?\s+from\s*)?)(["'])([^"']+)\2/g,
    (match, prefix, quote, specifier) => `${prefix}${quote}${rewrite(specifier)}${quote}`
  );
  output = output.replace(
    /(\bimport\s*\(\s*)(["'])([^"']+)\2(\s*\))/g,
    (match, prefix, quote, specifier, suffix) => `${prefix}${quote}${rewrite(specifier)}${quote}${suffix}`
  );
  return output;
}

function moduleDataUrl(path, source) {
  const withSourceUrl = `${source}\n//# sourceURL=workspace/${path}`;
  return `data:text/javascript;charset=utf-8,${encodeURIComponent(withSourceUrl)}`;
}

function escapeClosingScript(source) {
  return String(source).replace(/<\/script/gi, "<\\/script");
}

export async function buildWorkspaceModuleGraph(entry, workspace) {
  const normalizedEntry = normalizeWorkspacePath(entry);
  if (!normalizedEntry || !workspace?.hasFile?.(normalizedEntry)) {
    throw new Error("JavaScript entry not found: " + entry);
  }

  const modules = new Map();
  const visiting = new Set();

  async function visit(path) {
    if (modules.has(path) || visiting.has(path)) return;
    if (!workspace.hasFile(path)) throw new Error(`JavaScript dependency not found: ${path}`);
    visiting.add(path);
    const source = String(await workspace.readFile(path));
    const dependencies = [];
    const rewritten = rewriteModuleSpecifiers(source, path, (dependency) => dependencies.push(dependency));
    modules.set(path, rewritten);
    for (const dependency of dependencies) await visit(dependency);
    visiting.delete(path);
  }

  await visit(normalizedEntry);
  return Object.freeze({ entry: normalizedEntry, modules });
}

export async function buildModuleExecutionDocument(entry, workspace) {
  const graph = await buildWorkspaceModuleGraph(entry, workspace);
  const imports = {};
  for (const [path, source] of graph.modules) {
    imports[moduleAlias(path)] = moduleDataUrl(path, source);
  }

  const importMap = JSON.stringify({ imports }).replace(/</g, "\\u003c");
  const entryAlias = JSON.stringify(moduleAlias(graph.entry));
  const bridge = `(() => {
    const send = (type, payload) => parent.postMessage({ source: "creed-worker", type, payload }, "*");
    const serialize = (value) => { try { return typeof value === "string" ? value : JSON.stringify(value); } catch { return String(value); } };
    ["log", "info", "warn", "error"].forEach((level) => {
      const original = console[level]?.bind(console);
      console[level] = (...args) => {
        send("console", { level, args: args.map(serialize) });
        original?.(...args);
      };
    });
    addEventListener("error", (event) => send("runtime-error", {
      message: event.message || "Runtime error",
      stack: event.error?.stack || "",
      line: event.lineno || 0,
      column: event.colno || 0
    }));
    addEventListener("unhandledrejection", (event) => send("runtime-error", {
      message: serialize(event.reason),
      stack: event.reason?.stack || "",
      line: 0,
      column: 0
    }));
  })();`;
  const runner = `import(${entryAlias}).then(() => {
    parent.postMessage({ source: "creed-worker", type: "complete", payload: { fileName: ${JSON.stringify(graph.entry)} } }, "*");
  }).catch((error) => {
    parent.postMessage({ source: "creed-worker", type: "runtime-error", payload: {
      message: error?.message || String(error),
      stack: error?.stack || "",
      line: 0,
      column: 0
    } }, "*");
  });`;

  return `<!doctype html><meta charset="utf-8"><script>${escapeClosingScript(bridge)}</script><script type="importmap">${importMap}</script><script type="module">${escapeClosingScript(runner)}</script>`;
}

export function parseWorkerRuntimeLocation(payload = {}) {
  const match = String(payload.stack || "").match(/workspace\/([^\s:)]+)(?::(\d+))?(?::(\d+))?/);
  if (!match) return null;
  return {
    fileName: decodeURIComponent(match[1]),
    line: Math.max(1, Number(match[2] || payload.line) || 1),
    column: Math.max(1, Number(match[3] || payload.column) || 1)
  };
}

export function createWorkerRuntime({ workspace, onConsole, onError, onComplete } = {}) {
  let frame = null;
  let entryFile = "";
  let running = false;

  function releaseFrame({ clearEntry = true } = {}) {
    frame?.remove();
    frame = null;
    running = false;
    if (clearEntry) entryFile = "";
  }

  function stop() {
    releaseFrame();
    return true;
  }

  async function run(entry) {
    stop();
    const documentSource = await buildModuleExecutionDocument(entry, workspace);
    entryFile = normalizeWorkspacePath(entry) || String(entry || "");
    const nextFrame = document.createElement("iframe");
    nextFrame.hidden = true;
    nextFrame.title = "CREED JavaScript module runtime";
    nextFrame.setAttribute("sandbox", "allow-scripts");
    document.body.append(nextFrame);
    frame = nextFrame;
    running = true;
    nextFrame.srcdoc = documentSource;
    return true;
  }

  function handleMessage(event) {
    if (!frame || event.source !== frame.contentWindow || event.data?.source !== "creed-worker") return;
    if (event.data.type === "console") {
      onConsole?.(event.data.payload);
      return;
    }
    if (event.data.type === "runtime-error") {
      const payload = event.data.payload || {};
      onError?.(payload, parseWorkerRuntimeLocation(payload));
      releaseFrame({ clearEntry: false });
      return;
    }
    if (event.data.type === "complete") {
      const payload = event.data.payload;
      releaseFrame({ clearEntry: false });
      onComplete?.(payload);
    }
  }

  window.addEventListener("message", handleMessage);

  return Object.freeze({
    run,
    stop,
    restart: () => entryFile ? run(entryFile) : false,
    isRunning: () => running,
    getEntry: () => entryFile
  });
}
