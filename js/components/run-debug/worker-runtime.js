function workerWrapper(source, fileName) {
  const safeSource = String(source).replace(/<\/script/gi, "<\\/script");
  return `
const send = (type, payload) => postMessage({ source: "creed-worker", type, payload });
const serialize = (value) => { try { return typeof value === "string" ? value : JSON.stringify(value); } catch { return String(value); } };
["log", "info", "warn", "error"].forEach((level) => {
  console[level] = (...args) => send("console", { level, args: args.map(serialize) });
});
self.addEventListener("unhandledrejection", (event) => send("runtime-error", { message: serialize(event.reason), stack: event.reason?.stack || "" }));
try {
${safeSource}
//# sourceURL=workspace/${fileName}
  send("complete", { fileName: ${JSON.stringify(fileName)} });
} catch (error) {
  send("runtime-error", { message: error?.message || String(error), stack: error?.stack || "" });
}
`;
}

export function parseWorkerRuntimeLocation(payload = {}) {
  const match = String(payload.stack || "").match(/workspace\/([^\s:)]+)(?::(\d+))?(?::(\d+))?/);
  if (!match) return null;
  return {
    fileName: match[1],
    line: Math.max(1, Number(match[2]) || 1),
    column: Math.max(1, Number(match[3]) || 1)
  };
}

export function createWorkerRuntime({ workspace, onConsole, onError, onComplete } = {}) {
  let worker = null;
  let objectUrl = "";
  let entryFile = "";

  function stop() {
    worker?.terminate();
    worker = null;
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = "";
    entryFile = "";
    return true;
  }

  async function run(entry) {
    stop();
    if (!workspace.hasFile(entry)) throw new Error("JavaScript entry not found: " + entry);
    const source = await workspace.readFile(entry);
    entryFile = entry;
    const blob = new Blob([workerWrapper(source, entry)], { type: "text/javascript" });
    objectUrl = URL.createObjectURL(blob);
    worker = new Worker(objectUrl, { name: "CREED: " + entry });
    worker.addEventListener("message", (event) => {
      if (event.data?.source !== "creed-worker") return;
      if (event.data.type === "console") onConsole?.(event.data.payload);
      else if (event.data.type === "runtime-error") onError?.(event.data.payload, parseWorkerRuntimeLocation(event.data.payload));
      else if (event.data.type === "complete") onComplete?.(event.data.payload);
    });
    worker.addEventListener("error", (event) => {
      const payload = { message: event.message, stack: "", line: event.lineno, column: event.colno };
      onError?.(payload, { fileName: entry, line: event.lineno || 1, column: event.colno || 1 });
    });
    return true;
  }

  return Object.freeze({
    run,
    stop,
    restart: () => entryFile ? run(entryFile) : false,
    isRunning: () => Boolean(worker),
    getEntry: () => entryFile
  });
}
