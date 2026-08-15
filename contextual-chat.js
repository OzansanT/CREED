function summarizeSource(path, source) {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const imports = [...source.matchAll(/\bimport\b[^"']*["']([^"']+)["']/g)].map((match) => match[1]);
  const exports = [...source.matchAll(/\bexport\s+(?:default\s+)?(?:function|class|const|let|var)?\s*([\w$]*)/g)].map((match) => match[1]).filter(Boolean);
  const headings = path.endsWith(".md") ? lines.filter((line) => /^#{1,6}\s/.test(line)).slice(0, 8) : [];
  return [
    `${path} has ${lines.length} lines and ${source.length} characters.`,
    imports.length ? `Imports: ${imports.slice(0, 12).join(", ")}${imports.length > 12 ? "…" : ""}.` : "No static imports detected.",
    exports.length ? `Exports: ${exports.slice(0, 12).join(", ")}${exports.length > 12 ? "…" : ""}.` : "No named exports detected.",
    headings.length ? `Headings: ${headings.join(" · ")}.` : ""
  ].filter(Boolean).join("\n");
}

export function createLocalWorkspaceAssistant({ store, getActiveFile, openFile }) {
  return Object.freeze({
    async respond(messageValue) {
      const message = String(messageValue || "").trim();
      const lower = message.toLowerCase();
      const activePath = getActiveFile();
      if (!message) return "Ask a question about the active file or browser workspace.";
      if (lower === "help" || lower.includes("what can you do")) {
        return "I can summarize the active file, list or search files, report changes and diagnostics, explain a line, and open a file. Try: summarize, changes, diagnostics, find <text>, explain line 20, open README.md.";
      }
      if (lower === "changes" || lower.includes("changed files")) {
        const changes = store.listChanges();
        return changes.length
          ? changes.map((change) => `${change.staged ? "staged" : "unstaged"} ${change.status}: ${change.path}`).join("\n")
          : "The browser workspace is clean.";
      }
      if (lower === "diagnostics" || lower.includes("problems")) {
        const diagnostics = store.getDiagnostics();
        return diagnostics.length
          ? diagnostics.map((item) => `${item.path}:${item.line} ${item.severity} — ${item.message}`).join("\n")
          : "No workspace diagnostics are currently reported.";
      }
      const findMatch = message.match(/^find\s+(.+)/i);
      if (findMatch) {
        const matches = await store.search(findMatch[1], { limit: 12 });
        return matches.length
          ? matches.map((match) => `${match.path}:${match.line}:${match.column} ${match.preview.trim()}`).join("\n")
          : `No matches found for “${findMatch[1]}”.`;
      }
      const openMatch = message.match(/^open\s+(.+?)(?:\s+(\d+))?$/i);
      if (openMatch) {
        const path = openMatch[1].trim();
        if (!store.getFile(path)) return `${path} is not in the workspace.`;
        await openFile(path, { line: Number(openMatch[2]) || 1 });
        return `Opened ${path}${openMatch[2] ? ` at line ${openMatch[2]}` : ""}.`;
      }
      if (lower.includes("list files") || lower === "files") {
        const files = store.listFiles();
        const groups = new Map();
        files.forEach((file) => {
          const extension = file.path.includes(".") ? file.path.split(".").pop() : "other";
          groups.set(extension, (groups.get(extension) || 0) + 1);
        });
        return `${files.length} files: ${[...groups].sort().map(([extension, count]) => `${count} .${extension}`).join(", ")}.`;
      }
      if (!activePath) return "Open a source file first, or ask about files, changes, diagnostics, or search.";
      const source = await store.readFile(activePath);
      const lineMatch = message.match(/(?:explain|show)\s+line\s+(\d+)/i);
      if (lineMatch) {
        const lineNumber = Number(lineMatch[1]);
        const lines = source.replace(/\r\n/g, "\n").split("\n");
        if (lineNumber < 1 || lineNumber > lines.length) return `${activePath} has ${lines.length} lines.`;
        const start = Math.max(0, lineNumber - 3);
        const end = Math.min(lines.length, lineNumber + 2);
        return `${activePath}, lines ${start + 1}–${end}:\n${lines.slice(start, end).map((line, index) => `${start + index + 1}: ${line}`).join("\n")}`;
      }
      if (lower.includes("summar") || lower.includes("active file") || lower.includes("what is this")) {
        return summarizeSource(activePath, source);
      }
      return `Context: ${activePath}.\n${summarizeSource(activePath, source)}\n\nFor a targeted result, ask “find …”, “explain line …”, “changes”, or “diagnostics”.`;
    }
  });
}

export function bindContextualChat({
  messages,
  form,
  input,
  newButton,
  clearButton,
  closeButton,
  assistant,
  closePanel,
  notify
}) {
  let conversationId = 1;
  let busy = false;

  function addMessage(role, text) {
    const message = document.createElement("div");
    message.className = `chat-message chat-message--${role}`;
    message.textContent = text;
    messages.append(message);
    messages.scrollTop = messages.scrollHeight;
  }

  function reset() {
    conversationId += 1;
    messages.replaceChildren();
    addMessage("assistant", "Workspace assistant ready. Ask “help” to see supported contextual actions.");
    input.focus();
  }

  async function send() {
    const text = input.value.trim();
    if (!text || busy) return;
    const requestConversation = conversationId;
    input.value = "";
    addMessage("user", text);
    busy = true;
    input.disabled = true;
    try {
      const response = await assistant.respond(text);
      if (requestConversation === conversationId) addMessage("assistant", response);
    } catch (error) {
      if (requestConversation === conversationId) addMessage("assistant", `Unable to answer: ${error.message}`);
      notify?.(error.message);
    } finally {
      busy = false;
      input.disabled = false;
      input.focus();
    }
  }

  form.addEventListener("submit", (event) => { event.preventDefault(); send(); });
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); send(); }
  });
  newButton.addEventListener("click", reset);
  clearButton.addEventListener("click", reset);
  closeButton.addEventListener("click", closePanel);
  reset();
  return Object.freeze({ reset, send });
}
