const MAX_LINES = 2000;

function createStream(view, emptyMessage) {
  const lines = [];

  function render() {
    if (!view) return;
    const fragment = document.createDocumentFragment();
    if (!lines.length) {
      const row = document.createElement("div");
      row.textContent = emptyMessage;
      fragment.append(row);
    } else {
      for (const line of lines) {
        const row = document.createElement("div");
        row.textContent = line.text;
        row.dataset.kind = line.kind;
        if (line.kind === "error") row.setAttribute("role", "alert");
        fragment.append(row);
      }
    }
    view.replaceChildren(fragment);
    view.scrollTop = view.scrollHeight;
  }

  function write(value, kind = "output") {
    String(value ?? "").split("\n").forEach((text) => lines.push({ text, kind }));
    if (lines.length > MAX_LINES) lines.splice(0, lines.length - MAX_LINES);
    render();
    return lines.length;
  }

  function clear() {
    lines.length = 0;
    render();
  }

  render();
  return Object.freeze({ write, clear, getLines: () => lines.map((line) => ({ ...line })) });
}

export function bindRunOutputConsoles({ outputView, debugConsoleView, showView } = {}) {
  const output = createStream(outputView, "No output yet.");
  const debug = createStream(debugConsoleView, "No debug session started.");

  return Object.freeze({
    output,
    debug,
    writeOutput(value, kind = "output", { reveal = false } = {}) {
      output.write(value, kind);
      if (reveal) showView?.("output");
    },
    writeDebug(value, kind = "output", { reveal = false } = {}) {
      debug.write(value, kind);
      if (reveal) showView?.("debug");
    },
    clear() {
      output.clear();
      debug.clear();
    }
  });
}
