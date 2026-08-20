import { WORKSPACE_FILES } from "../editor-panel/source-files.js";

const MAX_OUTPUT_LINES = 1000;
const MAX_FILE_RESULTS = 60;

export function tokenizeTerminalCommand(commandLine) {
  const tokens = [];
  const pattern = /"((?:\\.|[^"])*)"|'((?:\\.|[^'])*)'|(\S+)/g;
  for (const match of String(commandLine).matchAll(pattern)) {
    tokens.push((match[1] ?? match[2] ?? match[3]).replace(/\\([\\"'])/g, "$1"));
  }
  return tokens;
}

function listDirectory(prefix = "") {
  const normalized = String(prefix).replace(/^\.\//, "").replace(/^\/+|\/+$/g, "");
  const start = normalized ? normalized + "/" : "";
  const entries = new Set();

  for (const file of WORKSPACE_FILES) {
    if (!file.startsWith(start)) continue;
    const remainder = file.slice(start.length);
    if (!remainder) continue;
    const [name, ...rest] = remainder.split("/");
    entries.add(name + (rest.length ? "/" : ""));
  }

  return [...entries].sort((left, right) => left.localeCompare(right));
}

export function searchWorkspaceFiles(query) {
  const needle = String(query || "").trim().toLowerCase();
  const files = needle
    ? WORKSPACE_FILES.filter((file) => file.toLowerCase().includes(needle))
    : [...WORKSPACE_FILES];
  return files.slice(0, MAX_FILE_RESULTS);
}

export function createTerminalCommandProcessor({ openFile, now = () => new Date() } = {}) {
  async function execute(commandLine, context) {
    const tokens = tokenizeTerminalCommand(commandLine);
    if (!tokens.length) return false;

    const [commandValue, ...args] = tokens;
    const command = commandValue.toLowerCase();
    const write = context.write;

    if (command === "help") {
      write([
        "CREED safe browser terminal",
        "help                  Show available commands",
        "clear                 Clear current terminal output",
        "pwd                   Print workspace path",
        "ls [folder]           List repository entries",
        "files [query]         Find workspace files",
        "open <file>           Open a workspace file in the editor",
        "echo <text>           Print text",
        "date                  Print current browser date/time",
        "history               Show command history",
        "sessions              Show terminal sessions"
      ].join("\n"));
      return true;
    }

    if (command === "clear") {
      context.clear();
      return true;
    }

    if (command === "pwd") {
      write("/workspaces/CREED");
      return true;
    }

    if (command === "ls") {
      const entries = listDirectory(args[0]);
      write(entries.length ? entries.join("\n") : "(empty)");
      return true;
    }

    if (command === "files") {
      const matches = searchWorkspaceFiles(args.join(" "));
      write(matches.length ? matches.join("\n") : "No files found");
      return true;
    }

    if (command === "open") {
      const fileName = args.join(" ").replace(/^\.\//, "");
      if (!fileName) throw new Error("Usage: open <file>");
      if (!WORKSPACE_FILES.includes(fileName)) throw new Error("Workspace file not found: " + fileName);
      const opened = await openFile?.(fileName);
      if (opened === false) throw new Error("Unable to open " + fileName);
      write("Opened " + fileName);
      return true;
    }

    if (command === "echo") {
      write(args.join(" "));
      return true;
    }

    if (command === "date") {
      write(now().toString());
      return true;
    }

    if (command === "history") {
      write(context.history.length
        ? context.history.map((item, index) => `${index + 1}  ${item}`).join("\n")
        : "No command history");
      return true;
    }

    if (command === "sessions") {
      write(context.sessions().map((session) => {
        const marker = session.active ? "*" : " ";
        return `${marker} ${session.name}`;
      }).join("\n"));
      return true;
    }

    throw new Error(command + ": command not found");
  }

  return Object.freeze({ execute });
}

function createPromptInput() {
  const form = document.createElement("form");
  form.className = "terminal-prompt toolbar";

  const user = document.createElement("span");
  user.className = "terminal-prompt__user";
  user.textContent = "@OzansanT";

  const separator = document.createTextNode(" ➜ ");
  const path = document.createElement("span");
  path.className = "terminal-prompt__path";
  path.textContent = "/workspaces/CREED";

  const branch = document.createElement("span");
  branch.className = "terminal-prompt__branch";
  branch.textContent = "(main)";

  const dollar = document.createTextNode(" $ ");
  const input = document.createElement("input");
  input.type = "text";
  input.autocomplete = "off";
  input.spellcheck = false;
  input.setAttribute("aria-label", "Terminal command");
  input.placeholder = "Type help for commands";

  form.append(user, separator, path, document.createTextNode(" "), branch, dollar, input);
  return { form, input };
}

export function bindTerminalSessions({
  view,
  newButton,
  splitButton,
  killButton,
  openFile,
  showView,
  notify
}) {
  const sessions = [];
  let nextSessionId = 1;
  let activeId = "";

  const sessionBar = document.createElement("div");
  sessionBar.className = "toolbar";
  const sessionSelect = document.createElement("select");
  sessionSelect.setAttribute("aria-label", "Terminal session");
  sessionBar.append(sessionSelect);

  const output = document.createElement("div");
  output.className = "terminal-view__body";
  output.setAttribute("aria-live", "polite");
  output.setAttribute("aria-label", "Terminal output");

  const { form, input } = createPromptInput();
  view.replaceChildren(sessionBar, output, form);

  const processor = createTerminalCommandProcessor({ openFile });

  function activeSession() {
    return sessions.find((session) => session.id === activeId) || null;
  }

  function sessionSummary() {
    return sessions.map((session) => ({
      id: session.id,
      name: session.name,
      active: session.id === activeId
    }));
  }

  function renderSessions() {
    const fragment = document.createDocumentFragment();
    for (const session of sessions) {
      const option = document.createElement("option");
      option.value = session.id;
      option.textContent = session.name;
      option.selected = session.id === activeId;
      fragment.append(option);
    }
    sessionSelect.replaceChildren(fragment);
    killButton.disabled = sessions.length <= 1;
    killButton.setAttribute("aria-disabled", String(killButton.disabled));
  }

  function renderOutput() {
    const session = activeSession();
    const fragment = document.createDocumentFragment();
    for (const line of session?.lines || []) {
      const row = document.createElement("div");
      row.textContent = line.text;
      if (line.kind === "error") row.setAttribute("role", "alert");
      fragment.append(row);
    }
    output.replaceChildren(fragment);
    output.scrollTop = output.scrollHeight;
  }

  function write(text, kind = "output") {
    const session = activeSession();
    if (!session) return;
    String(text ?? "").split("\n").forEach((line) => session.lines.push({ text: line, kind }));
    if (session.lines.length > MAX_OUTPUT_LINES) {
      session.lines.splice(0, session.lines.length - MAX_OUTPUT_LINES);
    }
    renderOutput();
  }

  function clear() {
    const session = activeSession();
    if (!session) return;
    session.lines.length = 0;
    renderOutput();
  }

  function createSession(label = "browser") {
    const id = `terminal-${nextSessionId}`;
    const session = {
      id,
      name: `${label} ${nextSessionId}`,
      lines: [{ text: "CREED safe browser terminal. Type help for commands.", kind: "output" }],
      history: [],
      historyIndex: 0
    };
    nextSessionId += 1;
    sessions.push(session);
    activeId = id;
    renderSessions();
    renderOutput();
    showView?.("terminal");
    requestAnimationFrame(() => input.focus());
    return session;
  }

  function killActiveSession() {
    if (sessions.length <= 1) return false;
    const index = sessions.findIndex((session) => session.id === activeId);
    sessions.splice(index, 1);
    activeId = sessions[Math.max(0, index - 1)]?.id || sessions[0].id;
    renderSessions();
    renderOutput();
    input.focus();
    return true;
  }

  async function execute(lineValue) {
    const line = String(lineValue || "").trim();
    if (!line) return false;
    const session = activeSession();
    if (!session) return false;
    session.history.push(line);
    session.historyIndex = session.history.length;
    write("$ " + line, "command");
    try {
      await processor.execute(line, {
        write,
        clear,
        history: session.history,
        sessions: sessionSummary
      });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      write(message, "error");
      notify?.(message);
      return false;
    }
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const line = input.value;
    input.value = "";
    execute(line);
  });

  input.addEventListener("keydown", (event) => {
    const session = activeSession();
    if (!session) return;
    if (event.key === "ArrowUp") {
      event.preventDefault();
      session.historyIndex = Math.max(0, session.historyIndex - 1);
      input.value = session.history[session.historyIndex] || "";
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      session.historyIndex = Math.min(session.history.length, session.historyIndex + 1);
      input.value = session.history[session.historyIndex] || "";
    }
  });

  sessionSelect.addEventListener("change", () => {
    if (!sessions.some((session) => session.id === sessionSelect.value)) return;
    activeId = sessionSelect.value;
    renderSessions();
    renderOutput();
    input.focus();
  });

  newButton.addEventListener("click", () => createSession("browser"));
  splitButton.addEventListener("click", () => createSession("split"));
  killButton.addEventListener("click", killActiveSession);

  createSession();

  return Object.freeze({
    execute,
    write,
    clear,
    createSession,
    killActiveSession,
    focus: () => input.focus(),
    getSessions: sessionSummary
  });
}
