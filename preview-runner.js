function rewriteModuleSpecifiers(source) {
  return String(source)
    .replace(/(from\s*["'])\.\/([^"']+)(["'])/g, "$1creed:$2$3")
    .replace(/(import\s*["'])\.\/([^"']+)(["'])/g, "$1creed:$2$3")
    .replace(/(import\s*\(\s*["'])\.\/([^"']+)(["']\s*\))/g, "$1creed:$2$3");
}

function escapeJsonForHtml(value) {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}

export async function buildWorkspacePreview(store, { baseUrl = location.href } = {}) {
  await store.ensureAllLoaded();
  const indexRecord = store.getFile("index.html");
  if (!indexRecord || indexRecord.deleted) throw new Error("index.html is required to run the workspace preview.");
  const objectUrls = [];
  const imports = {};
  store.listFiles().filter((file) => file.path.endsWith(".js")).forEach((file) => {
    const record = store.getFile(file.path);
    imports["creed:" + file.path] = "data:text/javascript;charset=utf-8," + encodeURIComponent(rewriteModuleSpecifiers(record.content));
  });
  let html = indexRecord.content;
  html = html.replace(/<meta\b[^>]*http-equiv=["']Content-Security-Policy["'][^>]*>/gi, "");
  html = html.replace(/<link\b[^>]*rel=["']stylesheet["'][^>]*href=["']\.\/([^"']+)["'][^>]*>/gi, (tag, path) => {
    const record = store.getFile(path);
    return record && !record.deleted ? `<style data-workspace-file="${path}">\n${record.content}\n</style>` : tag;
  });
  html = html.replace(/<link\b[^>]*href=["']\.\/([^"']+)["'][^>]*rel=["']stylesheet["'][^>]*>/gi, (tag, path) => {
    const record = store.getFile(path);
    return record && !record.deleted ? `<style data-workspace-file="${path}">\n${record.content}\n</style>` : tag;
  });
  html = html.replace(/<script\b[^>]*type=["']module["'][^>]*src=["']\.\/main\.js["'][^>]*>\s*<\/script>/i, "");
  const base = new URL("./", baseUrl).href;
  const bootstrap = [
    `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src data: 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: https:; font-src data:; frame-src data: blob:; object-src 'none'; form-action 'none'">`,
    `<base href="${base}">`,
    `<script type="importmap">${escapeJsonForHtml({ imports })}</script>`,
    `<script type="module" src="creed:main.js"></script>`
  ].join("\n");
  html = html.includes("</head>") ? html.replace("</head>", bootstrap + "\n</head>") : bootstrap + html;
  return { html, objectUrls };
}

export function bindPreviewRunner({
  store,
  frame,
  status,
  refreshButton,
  openButton,
  showPreview,
  notify,
  logOutput
}) {
  let current = null;
  let running = false;

  function release(build) {
    build?.objectUrls.forEach((url) => URL.revokeObjectURL(url));
  }

  async function run() {
    if (running) return;
    running = true;
    status.textContent = "Building…";
    showPreview();
    try {
      const next = await buildWorkspacePreview(store);
      const previous = current;
      current = next;
      frame.srcdoc = next.html;
      frame.addEventListener("load", () => {
        status.textContent = `Running ${new Date().toLocaleTimeString()}`;
        release(previous);
      }, { once: true });
      logOutput?.(`Preview built from ${store.listFiles().length} workspace files.`);
    } catch (error) {
      status.textContent = "Build failed";
      notify?.(error.message);
      logOutput?.(`Preview error: ${error.message}`, "error");
    } finally {
      running = false;
    }
  }

  function openWindow() {
    if (!current) { run(); return; }
    const previewUrl = "data:text/html;charset=utf-8," + encodeURIComponent(current.html);
    const outer = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; frame-src data:; object-src 'none'"><title>CREED Preview</title><style>html,body,iframe{box-sizing:border-box;width:100%;height:100%;margin:0;border:0;background:#fff}</style></head><body><iframe sandbox="allow-scripts allow-forms allow-modals" title="CREED sandboxed workspace preview" src="${previewUrl.replaceAll("&", "&amp;").replaceAll('"', "&quot;")}"></iframe></body></html>`;
    const url = URL.createObjectURL(new Blob([outer], { type: "text/html" }));
    const opened = window.open(url, "_blank", "noopener,noreferrer");
    if (!opened) notify?.("The browser blocked the preview window.");
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  refreshButton.addEventListener("click", run);
  openButton.addEventListener("click", openWindow);
  window.addEventListener("beforeunload", () => release(current), { once: true });
  return Object.freeze({ run, openWindow, getBuild: () => current });
}
