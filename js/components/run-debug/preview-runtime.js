function relativeWorkspacePath(value) {
  const raw = String(value || "").trim();
  if (!raw || /^(?:[a-z]+:|\/\/|#)/i.test(raw)) return null;
  return raw.replace(/^\.\//, "").split(/[?#]/)[0];
}

function escapeClosingScript(source) {
  return String(source).replace(/<\/script/gi, "<\\/script");
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

async function inlineStyles(html, workspace) {
  const pattern = /<link\b([^>]*?)href=["']([^"']+)["']([^>]*)>/gi;
  const replacements = [];
  for (const match of html.matchAll(pattern)) {
    const attrs = (match[1] + " " + match[3]).toLowerCase();
    if (!/rel=["']?stylesheet/.test(attrs)) continue;
    const path = relativeWorkspacePath(match[2]);
    if (!path || !workspace.hasFile(path)) continue;
    const css = await workspace.readFile(path);
    replacements.push({ start: match.index, end: match.index + match[0].length, value: `<style data-creed-preview-source="${path}">\n${css}\n</style>` });
  }
  return applyReplacements(html, replacements);
}

async function inlineScripts(html, workspace) {
  const pattern = /<script\b([^>]*?)src=["']([^"']+)["']([^>]*)><\/script>/gi;
  const replacements = [];
  for (const match of html.matchAll(pattern)) {
    const path = relativeWorkspacePath(match[2]);
    if (!path || !workspace.hasFile(path)) continue;
    const source = await workspace.readFile(path);
    const typeMatch = (match[1] + " " + match[3]).match(/type=["']([^"']+)["']/i);
    const type = typeMatch?.[1] || "text/javascript";
    replacements.push({
      start: match.index,
      end: match.index + match[0].length,
      value: `<script type="${type}" data-creed-preview-source="${path}">\n${escapeClosingScript(source)}\n//# sourceURL=workspace/${path}\n</script>`
    });
  }
  return applyReplacements(html, replacements);
}

export async function buildPreviewDocument(entry, workspace) {
  if (!workspace.hasFile(entry)) throw new Error("Preview entry not found: " + entry);
  let html = await workspace.readFile(entry);
  html = await inlineStyles(html, workspace);
  html = await inlineScripts(html, workspace);
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
    entryFile = entry;
    const frame = document.createElement("iframe");
    frame.id = "creedPreviewFrame";
    frame.title = "CREED sandbox preview";
    frame.setAttribute("sandbox", "allow-scripts");
    Object.assign(frame.style, { width: "100%", height: "100%", border: "0", background: "white" });
    host.replaceChildren(frame);
    iframe = frame;
    frame.srcdoc = await buildPreviewDocument(entry, workspace);
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
