import { buildWorkspaceModuleGraph } from "./worker-runtime.js";

const WORKSPACE_MODULE_PREFIX = "creed-workspace/";

function normalizeWorkspacePath(value) {
  const raw = String(value || "").trim().replace(/\\/g, "/").split(/[?#]/)[0];
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

function resolveWorkspacePath(ownerFile, reference) {
  const value = String(reference || "").trim().replace(/\\/g, "/").split(/[?#]/)[0];
  if (!value || /^(?:[a-z]+:|\/\/|#)/i.test(value) || value.startsWith("/")) return null;
  const owner = normalizeWorkspacePath(ownerFile);
  if (!owner) return null;
  const base = dirname(owner);
  return normalizeWorkspacePath(base ? `${base}/${value}` : value);
}

function escapeClosingScript(source) {
  return String(source).replace(/<\/script/gi, "<\\/script");
}

function escapeAttribute(value) {
  return String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function moduleAlias(path) {
  return WORKSPACE_MODULE_PREFIX + path;
}

function moduleDataUrl(path, source) {
  const withSourceUrl = `${source}\n//# sourceURL=workspace/${path}`;
  return `data:text/javascript;charset=utf-8,${encodeURIComponent(withSourceUrl)}`;
}

export function createPreviewBridgeSource() {
  return `(() => {
    const send = (type, payload) => parent.postMessage({ source: "creed-preview", type, payload }, "*");
    const serialize = (value) => {
      try { return typeof value === "string" ? value : JSON.stringify(value); }
      catch { return String(value); }
    };
    ["log", "info", "warn", "error"].forEach((level) => {
      const original = console[level]?.bind(console);
      console[level] = (...args) => {
        send("console", { level, args: args.map(serialize) });
        original?.(...args);
      };
    });
    addEventListener("error", (event) => send("runtime-error", {
      message: event.message || "Runtime error",
      fileName: event.filename || "",
      line: event.lineno || 0,
      column: event.colno || 0,
      stack: event.error?.stack || ""
    }));
    addEventListener("unhandledrejection", (event) => send("runtime-error", {
      message: serialize(event.reason),
      fileName: "",
      line: 0,
      column: 0,
      stack: event.reason?.stack || ""
    }));
    send("ready", { href: location.href });
  })();`;
}

function applyReplacements(source, replacements) {
  let output = source;
  for (const replacement of [...replacements].sort((a, b) => b.start - a.start)) {
    output = output.slice(0, replacement.start) + replacement.value + output.slice(replacement.end);
  }
  return output;
}

async function inlineStyleSheet(path, workspace, ancestors = new Set()) {
  if (!workspace.hasFile(path)) throw new Error("Stylesheet not found: " + path);
  if (ancestors.has(path)) throw new Error("Circular stylesheet import: " + [...ancestors, path].join(" -> "));
  const lineage = new Set(ancestors);
  lineage.add(path);
  const css = String(await workspace.readFile(path));
  const pattern = /@import\s+(?:url\(\s*)?["']([^"']+)["']\s*\)?\s*([^;]*);/gi;
  const replacements = [];
  for (const match of css.matchAll(pattern)) {
    const importedPath = resolveWorkspacePath(path, match[1]);
    if (!importedPath || !workspace.hasFile(importedPath)) continue;
    const imported = await inlineStyleSheet(importedPath, workspace, lineage);
    const media = String(match[2] || "").trim();
    replacements.push({
      start: match.index,
      end: match.index + match[0].length,
      value: media ? `@media ${media} {\n${imported}\n}` : imported
    });
  }
  return applyReplacements(css, replacements);
}

async function inlineStyles(html, workspace, entryFile) {
  const pattern = /<link\b([^>]*?)href=["']([^"']+)["']([^>]*)>/gi;
  const replacements = [];
  for (const match of html.matchAll(pattern)) {
    const attrs = (match[1] + " " + match[3]).toLowerCase();
    if (!/rel=["']?stylesheet/.test(attrs)) continue;
    const path = resolveWorkspacePath(entryFile, match[2]);
    if (!path || !workspace.hasFile(path)) continue;
    const css = await inlineStyleSheet(path, workspace);
    replacements.push({
      start: match.index,
      end: match.index + match[0].length,
      value: `<style data-creed-preview-source="${escapeAttribute(path)}">\n${css}\n</style>`
    });
  }
  return applyReplacements(html, replacements);
}

function injectImportMap(html, imports) {
  const entries = Object.keys(imports);
  if (!entries.length) return html;
  const importMap = `<script type="importmap" data-creed-preview-importmap>\n${JSON.stringify({ imports }).replace(/</g, "\\u003c")}\n</script>`;
  const headMatch = html.match(/<head\b[^>]*>/i);
  if (headMatch) {
    const insertion = headMatch.index + headMatch[0].length;
    return html.slice(0, insertion) + "\n" + importMap + html.slice(insertion);
  }
  const doctypeMatch = html.match(/^\s*<!doctype\s+html[^>]*>/i);
  if (doctypeMatch) {
    const insertion = doctypeMatch.index + doctypeMatch[0].length;
    return html.slice(0, insertion) + "\n" + importMap + html.slice(insertion);
  }
  return importMap + "\n" + html;
}

async function inlineScripts(html, workspace, entryFile) {
  const pattern = /<script\b([^>]*?)src=["']([^"']+)["']([^>]*)><\/script>/gi;
  const replacements = [];
  const moduleImports = {};
  for (const match of html.matchAll(pattern)) {
    const path = resolveWorkspacePath(entryFile, match[2]);
    if (!path || !workspace.hasFile(path)) continue;
    const attrs = match[1] + " " + match[3];
    const typeMatch = attrs.match(/type=["']([^"']+)["']/i);
    const type = typeMatch?.[1] || "text/javascript";
    if (type.trim().toLowerCase() === "module") {
      const graph = await buildWorkspaceModuleGraph(path, workspace);
      for (const [modulePath, source] of graph.modules) {
        moduleImports[moduleAlias(modulePath)] = moduleDataUrl(modulePath, source);
      }
      replacements.push({
        start: match.index,
        end: match.index + match[0].length,
        value: `<script type="module" data-creed-preview-source="${escapeAttribute(path)}">\nimport ${JSON.stringify(moduleAlias(graph.entry))};\n</script>`
      });
      continue;
    }
    const source = await workspace.readFile(path);
    replacements.push({
      start: match.index,
      end: match.index + match[0].length,
      value: `<script type="${escapeAttribute(type)}" data-creed-preview-source="${escapeAttribute(path)}">\n${escapeClosingScript(source)}\n//# sourceURL=workspace/${path}\n</script>`
    });
  }
  return injectImportMap(applyReplacements(html, replacements), moduleImports);
}

export async function buildPreviewDocument(entry, workspace) {
  const normalizedEntry = normalizeWorkspacePath(entry);
  if (!normalizedEntry || !workspace.hasFile(normalizedEntry)) throw new Error("Preview entry not found: " + entry);
  let html = await workspace.readFile(normalizedEntry);
  html = await inlineStyles(html, workspace, normalizedEntry);
  html = await inlineScripts(html, workspace, normalizedEntry);
  const bridge = `<script data-creed-preview-bridge>\n${escapeClosingScript(createPreviewBridgeSource())}\n</script>`;
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, bridge + "\n</body>");
  return html + "\n" + bridge;
}

export function parsePreviewRuntimeLocation(payload = {}) {
  const source = String(payload.fileName || payload.stack || "");
  const match = source.match(/workspace\/([^\s:)]+)(?::(\d+))?(?::(\d+))?/);
  if (!match) return null;
  return {
    fileName: decodeURIComponent(match[1]),
    line: Math.max(1, Number(match[2] || payload.line) || 1),
    column: Math.max(1, Number(match[3] || payload.column) || 1)
  };
}

export function createPreviewRuntime({ host, workspace, onConsole, onError, onReady } = {}) {
  let iframe = null;
  let entryFile = "";

  function stop() {
    iframe?.remove();
    iframe = null;
    entryFile = "";
    return true;
  }

  async function run(entry) {
    stop();
    entryFile = normalizeWorkspacePath(entry) || String(entry || "");
    const frame = document.createElement("iframe");
    frame.id = "creedPreviewFrame";
    frame.title = "CREED sandbox preview";
    frame.setAttribute("sandbox", "allow-scripts");
    Object.assign(frame.style, { width: "100%", height: "100%", border: "0", background: "white" });
    host.replaceChildren(frame);
    iframe = frame;
    frame.srcdoc = await buildPreviewDocument(entryFile, workspace);
    return frame;
  }

  function handleMessage(event) {
    if (!iframe || event.source !== iframe.contentWindow || event.data?.source !== "creed-preview") return;
    const { type, payload } = event.data;
    if (type === "console") onConsole?.(payload);
    else if (type === "runtime-error") onError?.(payload, parsePreviewRuntimeLocation(payload));
    else if (type === "ready") onReady?.(payload);
  }

  window.addEventListener("message", handleMessage);

  return Object.freeze({
    run,
    stop,
    restart: () => entryFile ? run(entryFile) : false,
    isRunning: () => Boolean(iframe),
    getEntry: () => entryFile
  });
}
