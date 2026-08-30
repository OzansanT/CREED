import { TERMINAL_SESSIONS_STORAGE_KEY } from "../../core/config.js";
import { WORKSPACE_FILES } from "../editor-panel/source-files.js";

const MAX_OUTPUT_LINES = 1000;
const MAX_PERSISTED_OUTPUT_LINES = 200;
const MAX_PERSISTED_LINE_LENGTH = 4096;
const MAX_FILE_RESULTS = 60;
const MAX_HISTORY_ITEMS = 200;
const TERMINAL_SCHEMA_VERSION = 1;
const WORKSPACE_ROOT = "/workspaces/CREED";
const COMMANDS = Object.freeze([
  "cat", "cd", "clear", "cp", "date", "echo", "files", "help", "history",
  "ls", "mkdir", "mv", "open", "pwd", "rm", "rmdir", "sessions", "touch"
]);

export function tokenizeTerminalCommand(commandLine) {
  const tokens = [];
  const pattern = /"((?:\\.|[^"])*)"|'((?:\\.|[^'])*)'|(\S+)/g;
  for (const match of String(commandLine).matchAll(pattern)) {
    tokens.push((match[1] ?? match[2] ?? match[3]).replace(/\\([\\"'])/g, "$1"));
  }
  return tokens;
}

function baseName(path) {
  return String(path || "").slice(String(path || "").lastIndexOf("/") + 1);
}

function parentDirectory(path) {
  const index = String(path || "").lastIndexOf("/");
  return index < 0 ? "" : path.slice(0, index);
}

function deriveDirectories(files) {
  const directories = new Set();
  for (const fileName of files) {
    let current = parentDirectory(fileName);
    while (current) {
      directories.add(current);
      current = parentDirectory(current);
    }
  }
  return [...directories].sort((left, right) => left.localeCompare(right));
}

function readOnlyWorkspace() {
  const files = [...WORKSPACE_FILES];
  const directories = deriveDirectories(files);
  return Object.freeze({
    listFiles: () => [...files],
    listDirectories: () => [...directories],
    hasFile: (path) => files.includes(path),
    hasDirectory: (path) => path === "" || directories.includes(path)
  });
}

function getWorkspace(workspace) {
  return workspace?.listFiles ? workspace : readOnlyWorkspace();
}

export function resolveTerminalPath(value, cwd = "") {
  let raw = String(value ?? "").trim().replaceAll("\\", "/");
  const safeCwd = String(cwd || "").replace(/^\/+|\/+$/g, "");
  if (!raw || raw === ".") return safeCwd;
  if (raw === "~" || raw === WORKSPACE_ROOT) return "";

  if (raw.startsWith(WORKSPACE_ROOT + "/")) raw = raw.slice(WORKSPACE_ROOT.length + 1);
  const absolute = raw.startsWith("/");
  raw = raw.replace(/^\/+/, "");
  const segments = absolute ? [] : (safeCwd ? safeCwd.split("/") : []);

  for (const segment of raw.split("/")) {
    if (!segment || segment === ".") continue;
    if (segment === "..") {
      segments.pop();
      continue;
    }
    if (segment.includes("\0")) throw new Error("Invalid path segment.");
    segments.push(segment);
  }
  return segments.join("/");
}

export function formatTerminalPath(cwd = "") {
  const normalized = resolveTerminalPath(".", cwd);
  return normalized ? `${WORKSPACE_ROOT}/${normalized}` : WORKSPACE_ROOT;
}

export function parseTerminalOpenTarget(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return { path: "", line: null, column: null };
  const match = raw.match(/^(.*?):(\d+)(?::(\d+))?$/);
  if (!match || !match[1]) return { path: raw, line: null, column: null };
  return {
    path: match[1],
    line: Math.max(1, Math.trunc(Number(match[2]) || 1)),
    column: match[3] ? Math.max(1, Math.trunc(Number(match[3]) || 1)) : 1
  };
}

function terminalReferenceAliases(fileName, cwd = "") {
  const aliases = new Set([
    fileName,
    `workspace/${fileName}`,
    `${WORKSPACE_ROOT}/${fileName}`
  ]);
  const normalizedCwd = resolveTerminalPath(".", cwd);
  const prefix = normalizedCwd ? normalizedCwd + "/" : "";
  if (prefix && fileName.startsWith(prefix)) aliases.add(fileName.slice(prefix.length));
  return [...aliases].filter(Boolean).sort((left, right) => right.length - left.length);
}

function hasTerminalReferenceBoundary(text, index) {
  if (index <= 0) return true;
  return !/[A-Za-z0-9_.@~+\/-]/.test(text[index - 1]);
}

export function findTerminalSourceReferences(value, { workspace, cwd = "" } = {}) {
  const fs = getWorkspace(workspace);
  const text = String(value ?? "");
  const candidates = [];
  const files = [...fs.listFiles()].sort((left, right) => right.length - left.length || left.localeCompare(right));

  for (const fileName of files) {
    for (const alias of terminalReferenceAliases(fileName, cwd)) {
      let searchIndex = 0;
      while (searchIndex < text.length) {
        const start = text.indexOf(alias + ":", searchIndex);
        if (start < 0) break;
        searchIndex = start + alias.length + 1;
        if (!hasTerminalReferenceBoundary(text, start)) continue;
        const suffix = text.slice(start + alias.length).match(/^:(\d+)(?::(\d+))?/);
        if (!suffix) continue;
        const end = start + alias.length + suffix[0].length;
        candidates.push({
          start,
          end,
          text: text.slice(start, end),
          fileName,
          line: Math.max(1, Math.trunc(Number(suffix[1]) || 1)),
          column: suffix[2] ? Math.max(1, Math.trunc(Number(suffix[2]) || 1)) : 1
        });
      }
    }
  }

  candidates.sort((left, right) => left.start - right.start || right.end - left.end);
  const references = [];
  let coveredUntil = -1;
  for (const candidate of candidates) {
    if (candidate.start < coveredUntil) continue;
    references.push(candidate);
    coveredUntil = candidate.end;
  }
  return references;
}

export async function navigateTerminalSourceReference(reference, { openFile, openFileAt } = {}) {
  if (!reference?.fileName) return false;
  const line = Math.max(1, Math.trunc(Number(reference.line) || 1));
  const column = Math.max(1, Math.trunc(Number(reference.column) || 1));
  if (typeof openFileAt === "function") return await openFileAt(reference.fileName, line, column) !== false;
  if (typeof openFile === "function") return await openFile(reference.fileName) !== false;
  return false;
}

export function createTerminalOutputLine(text, kind = "output", cwd = "") {
  return {
    text: String(text ?? ""),
    kind: typeof kind === "string" && kind ? kind : "output",
    cwd: resolveTerminalPath(cwd || ".", "")
  };
}

function normalizeStoredOutputLines(value, cwd = "") {
  if (!Array.isArray(value)) return [];
  return value
    .slice(-MAX_PERSISTED_OUTPUT_LINES)
    .map((line) => {
      if (!line || typeof line !== "object") return null;
      return createTerminalOutputLine(
        String(line.text ?? "").slice(0, MAX_PERSISTED_LINE_LENGTH),
        line.kind,
        typeof line.cwd === "string" ? line.cwd : cwd
      );
    })
    .filter(Boolean);
}

export function listWorkspaceDirectory(workspace, directory = "") {
  const source = getWorkspace(workspace);
  const normalized = resolveTerminalPath(directory, "");
  const prefix = normalized ? normalized + "/" : "";
  const entries = new Map();

  for (const childDirectory of source.listDirectories?.() || deriveDirectories(source.listFiles())) {
    if (!childDirectory.startsWith(prefix) || childDirectory === normalized) continue;
    const remainder = childDirectory.slice(prefix.length);
    if (!remainder || remainder.includes("/")) continue;
    entries.set(remainder + "/", "directory");
  }

  for (const fileName of source.listFiles()) {
    if (!fileName.startsWith(prefix)) continue;
    const remainder = fileName.slice(prefix.length);
    if (!remainder || remainder.includes("/")) continue;
    entries.set(remainder, "file");
  }

  return [...entries.keys()].sort((left, right) => left.localeCompare(right));
}

export function searchWorkspaceFiles(query, workspace) {
  const source = getWorkspace(workspace);
  const needle = String(query || "").trim().toLowerCase();
  const files = needle
    ? source.listFiles().filter((file) => file.toLowerCase().includes(needle))
    : source.listFiles();
  return files.slice(0, MAX_FILE_RESULTS);
}

function longestCommonPrefix(values) {
  if (!values.length) return "";
  let prefix = values[0];
  for (const value of values.slice(1)) {
    while (prefix && !value.startsWith(prefix)) prefix = prefix.slice(0, -1);
  }
  return prefix;
}

export function completeTerminalInput(inputValue, { workspace, cwd = "" } = {}) {
  const value = String(inputValue ?? "");
  const commandMatch = value.match(/^(\S*)$/);
  if (commandMatch) {
    const needle = commandMatch[1].toLowerCase();
    const candidates = COMMANDS.filter((command) => command.startsWith(needle));
    const completion = candidates.length === 1 ? candidates[0] + " " : longestCommonPrefix(candidates);
    return { value: completion || value, candidates };
  }

  const tokenMatch = value.match(/(\S*)$/);
  const rawToken = tokenMatch?.[1] || "";
  const tokenStart = tokenMatch ? tokenMatch.index : value.length;
  const slashIndex = rawToken.lastIndexOf("/");
  const typedDirectory = slashIndex >= 0 ? rawToken.slice(0, slashIndex + 1) : "";
  const namePrefix = slashIndex >= 0 ? rawToken.slice(slashIndex + 1) : rawToken;
  const directoryPath = typedDirectory
    ? resolveTerminalPath(typedDirectory, cwd)
    : resolveTerminalPath(".", cwd);
  const entries = listWorkspaceDirectory(workspace, directoryPath);
  const candidates = entries
    .filter((entry) => entry.toLowerCase().startsWith(namePrefix.toLowerCase()))
    .map((entry) => typedDirectory + entry);

  let completedToken = rawToken;
  if (candidates.length === 1) completedToken = candidates[0];
  else if (candidates.length > 1) completedToken = longestCommonPrefix(candidates) || rawToken;

  return {
    value: value.slice(0, tokenStart) + completedToken,
    candidates
  };
}

async function copyWorkspaceDirectory(workspace, sourcePath, targetPath) {
  if (targetPath === sourcePath || targetPath.startsWith(sourcePath + "/")) {
    throw new Error("Cannot copy a directory inside itself.");
  }
  const sourcePrefix = sourcePath + "/";
  const sourceFiles = workspace.listFiles().filter((fileName) => fileName.startsWith(sourcePrefix));
  const sourceDirectories = (workspace.listDirectories?.() || [])
    .filter((directory) => directory === sourcePath || directory.startsWith(sourcePrefix));

  if (!workspace.hasDirectory(targetPath)) workspace.createDirectory(targetPath);

  for (const directory of sourceDirectories.sort((left, right) => left.length - right.length)) {
    if (directory === sourcePath) continue;
    const nextDirectory = targetPath + directory.slice(sourcePath.length);
    if (!workspace.hasDirectory(nextDirectory)) workspace.createDirectory(nextDirectory);
  }

  for (const sourceFile of sourceFiles) {
    const targetFile = targetPath + sourceFile.slice(sourcePath.length);
    if (workspace.hasFile(targetFile) || workspace.hasDirectory(targetFile)) {
      throw new Error("Workspace path already exists: " + targetFile);
    }
    workspace.createFile(targetFile, await workspace.readFile(sourceFile));
  }
  return sourceFiles.length;
}

export function createTerminalCommandProcessor({ openFile, openFileAt, workspace, now = () => new Date() } = {}) {
  const fs = getWorkspace(workspace);

  function requireWritable(method) {
    if (typeof fs[method] !== "function") throw new Error("Terminal workspace is read-only.");
  }

  async function execute(commandLine, context) {
    const tokens = tokenizeTerminalCommand(commandLine);
    if (!tokens.length) return false;

    const [commandValue, ...args] = tokens;
    const command = commandValue.toLowerCase();
    const write = context.write;
    const cwd = () => context.getCwd?.() ?? context.cwd ?? "";
    const resolvePath = (value) => resolveTerminalPath(value, cwd());

    if (command === "help") {
      write([
        "CREED safe browser terminal",
        "help                       Show available commands",
        "clear                      Clear current terminal output",
        "pwd                        Print current workspace path",
        "cd [folder]                Change workspace directory",
        "ls [path]                  List workspace entries",
        "files [query]              Find workspace files",
        "open <file>[:line[:column]] Open a workspace file or exact source location",
        "cat <file>                 Print a workspace file",
        "mkdir <folder> [...]       Create workspace folders",
        "touch <file> [...]         Create empty workspace files",
        "rm [-r] <path> [...]       Delete files or recursive folders",
        "rmdir <folder> [...]       Delete folders recursively",
        "mv <source> <target>       Move or rename a workspace path",
        "cp <source> <target>       Copy a file or folder recursively",
        "echo <text>                Print text",
        "date                       Print current browser date/time",
        "history                    Show command history",
        "sessions                   Show terminal sessions",
        "Tab                        Autocomplete commands and paths"
      ].join("\n"));
      return true;
    }

    if (command === "clear") {
      context.clear();
      return true;
    }

    if (command === "pwd") {
      write(formatTerminalPath(cwd()));
      return true;
    }

    if (command === "cd") {
      const target = args.length ? resolvePath(args.join(" ")) : "";
      if (target && !fs.hasDirectory?.(target)) throw new Error("Directory not found: " + target);
      context.setCwd?.(target);
      return true;
    }

    if (command === "ls") {
      const target = resolvePath(args[0] || ".");
      if (target && fs.hasFile?.(target)) {
        write(baseName(target));
        return true;
      }
      if (target && !fs.hasDirectory?.(target)) throw new Error("Directory not found: " + target);
      const entries = listWorkspaceDirectory(fs, target);
      write(entries.length ? entries.join("\n") : "(empty)");
      return true;
    }

    if (command === "files") {
      const matches = searchWorkspaceFiles(args.join(" "), fs);
      write(matches.length ? matches.join("\n") : "No files found");
      return true;
    }

    if (command === "open") {
      if (!args.length) throw new Error("Usage: open <file>[:line[:column]]");
      const target = parseTerminalOpenTarget(args.join(" "));
      const fileName = resolvePath(target.path);
      if (!fs.hasFile?.(fileName)) throw new Error("Workspace file not found: " + fileName);
      const opened = target.line != null && typeof openFileAt === "function"
        ? await openFileAt(fileName, target.line, target.column)
        : await openFile?.(fileName);
      if (opened === false) throw new Error("Unable to open " + fileName);
      write(target.line != null
        ? `Opened ${fileName}:${target.line}:${target.column}`
        : "Opened " + fileName);
      return true;
    }

    if (command === "cat") {
      const fileName = resolvePath(args.join(" "));
      if (!args.length) throw new Error("Usage: cat <file>");
      if (!fs.hasFile?.(fileName)) throw new Error("Workspace file not found: " + fileName);
      if (typeof fs.readFile !== "function") throw new Error("Workspace file content is unavailable.");
      write(await fs.readFile(fileName));
      return true;
    }

    if (command === "mkdir") {
      if (!args.length) throw new Error("Usage: mkdir <folder> [...]");
      requireWritable("createDirectory");
      for (const rawPath of args) {
        const path = resolvePath(rawPath);
        fs.createDirectory(path);
        write("Created directory " + path);
      }
      return true;
    }

    if (command === "touch") {
      if (!args.length) throw new Error("Usage: touch <file> [...]");
      requireWritable("createFile");
      for (const rawPath of args) {
        const path = resolvePath(rawPath);
        if (fs.hasDirectory?.(path)) throw new Error("Is a directory: " + path);
        if (!fs.hasFile?.(path)) {
          fs.createFile(path, "");
          write("Created " + path);
        } else {
          write("Exists " + path);
        }
      }
      return true;
    }

    if (command === "rm" || command === "rmdir") {
      if (!args.length) throw new Error(`Usage: ${command} <path> [...]`);
      const recursive = command === "rmdir" || args.some((arg) => /^-[a-z]*r/i.test(arg));
      const targets = args.filter((arg) => !arg.startsWith("-"));
      if (!targets.length) throw new Error(`Usage: ${command} <path> [...]`);
      for (const rawPath of targets) {
        const path = resolvePath(rawPath);
        if (fs.hasFile?.(path)) {
          requireWritable("deleteFile");
          fs.deleteFile(path);
          write("Deleted " + path);
        } else if (fs.hasDirectory?.(path)) {
          if (!recursive) throw new Error(path + ": is a directory (use rmdir or rm -r)");
          requireWritable("deleteDirectory");
          fs.deleteDirectory(path);
          write("Deleted directory " + path);
        } else {
          throw new Error("Workspace path not found: " + path);
        }
      }
      return true;
    }

    if (command === "mv") {
      if (args.length !== 2) throw new Error("Usage: mv <source> <target>");
      requireWritable("rename");
      const source = resolvePath(args[0]);
      if (!fs.hasFile?.(source) && !fs.hasDirectory?.(source)) throw new Error("Workspace path not found: " + source);
      let target = resolvePath(args[1]);
      if (fs.hasDirectory?.(target)) target = target ? target + "/" + baseName(source) : baseName(source);
      await fs.rename(source, target);
      write(`Moved ${source} → ${target}`);
      return true;
    }

    if (command === "cp") {
      if (args.length !== 2) throw new Error("Usage: cp <source> <target>");
      const source = resolvePath(args[0]);
      if (!fs.hasFile?.(source) && !fs.hasDirectory?.(source)) throw new Error("Workspace path not found: " + source);
      let target = resolvePath(args[1]);

      if (fs.hasFile?.(source)) {
        requireWritable("duplicateFile");
        if (fs.hasDirectory?.(target)) target = target ? target + "/" + baseName(source) : baseName(source);
        await fs.duplicateFile(source, target);
        write(`Copied ${source} → ${target}`);
        return true;
      }

      requireWritable("createDirectory");
      requireWritable("createFile");
      if (fs.hasDirectory?.(target)) target = target ? target + "/" + baseName(source) : baseName(source);
      const copied = await copyWorkspaceDirectory(fs, source, target);
      write(`Copied directory ${source} → ${target} (${copied} files)`);
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
        return `${marker} ${session.name}  ${formatTerminalPath(session.cwd || "")}`;
      }).join("\n"));
      return true;
    }

    throw new Error(command + ": command not found");
  }

  return Object.freeze({ execute });
}

function normalizeStoredSession(value, index) {
  if (!value || typeof value !== "object") return null;
  const id = typeof value.id === "string" && value.id ? value.id : `terminal-${index + 1}`;
  const name = typeof value.name === "string" && value.name ? value.name : `browser ${index + 1}`;
  const cwd = resolveTerminalPath(".", typeof value.cwd === "string" ? value.cwd : "");
  const history = Array.isArray(value.history)
    ? value.history.filter((item) => typeof item === "string").slice(-MAX_HISTORY_ITEMS)
    : [];
  const lines = normalizeStoredOutputLines(value.lines, cwd);
  return { id, name, cwd, history, lines };
}

export function normalizeTerminalState(value = {}) {
  const sourceSessions = Array.isArray(value.sessions) ? value.sessions : [];
  const sessions = sourceSessions.map(normalizeStoredSession).filter(Boolean);
  const requestedActive = typeof value.activeId === "string" ? value.activeId : "";
  const activeId = sessions.some((session) => session.id === requestedActive)
    ? requestedActive
    : sessions[0]?.id || "";
  const inferredNextId = sessions.reduce((highest, session) => {
    const match = session.id.match(/^terminal-(\d+)$/);
    return Math.max(highest, Number(match?.[1]) || 0);
  }, 0) + 1;
  return {
    version: TERMINAL_SCHEMA_VERSION,
    activeId,
    nextSessionId: Math.max(inferredNextId, Math.trunc(Number(value.nextSessionId) || 1)),
    sessions
  };
}

export function saveTerminalState(storage, value) {
  try {
    storage.setItem(TERMINAL_SESSIONS_STORAGE_KEY, JSON.stringify(normalizeTerminalState(value)));
    return true;
  } catch {
    return false;
  }
}

export function loadTerminalState(storage) {
  try {
    const parsed = JSON.parse(storage.getItem(TERMINAL_SESSIONS_STORAGE_KEY));
    if (!parsed || parsed.version !== TERMINAL_SCHEMA_VERSION) return null;
    return normalizeTerminalState(parsed);
  } catch {
    return null;
  }
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
  path.textContent = WORKSPACE_ROOT;

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
  return { form, input, path };
}

function getBrowserStorage() {
  return typeof localStorage === "undefined"
    ? { getItem: () => null, setItem: () => {}, removeItem: () => {} }
    : localStorage;
}

export function bindTerminalSessions({
  view,
  newButton,
  splitButton,
  killButton,
  openFile,
  openFileAt,
  workspace,
  showView,
  notify,
  storage = getBrowserStorage()
}) {
  const fs = getWorkspace(workspace);
  const sessions = [];
  const restored = loadTerminalState(storage);
  let nextSessionId = restored?.nextSessionId || 1;
  let activeId = restored?.activeId || "";

  const sessionBar = document.createElement("div");
  sessionBar.className = "toolbar";
  const sessionSelect = document.createElement("select");
  sessionSelect.setAttribute("aria-label", "Terminal session");
  sessionBar.append(sessionSelect);

  const output = document.createElement("div");
  output.className = "terminal-view__body";
  output.setAttribute("aria-live", "polite");
  output.setAttribute("aria-label", "Terminal output");

  const { form, input, path: promptPath } = createPromptInput();
  view.replaceChildren(sessionBar, output, form);

  const processor = createTerminalCommandProcessor({ openFile, openFileAt, workspace: fs });

  if (restored?.sessions.length) {
    for (const session of restored.sessions) {
      sessions.push({
        ...session,
        lines: session.lines.length
          ? session.lines
          : [createTerminalOutputLine("Restored CREED terminal session.", "output", session.cwd)],
        historyIndex: session.history.length
      });
    }
  }

  function activeSession() {
    return sessions.find((session) => session.id === activeId) || null;
  }

  function sessionSummary() {
    return sessions.map((session) => ({
      id: session.id,
      name: session.name,
      cwd: session.cwd,
      active: session.id === activeId
    }));
  }

  function persist() {
    return saveTerminalState(storage, {
      version: TERMINAL_SCHEMA_VERSION,
      activeId,
      nextSessionId,
      sessions: sessions.map((session) => ({
        id: session.id,
        name: session.name,
        cwd: session.cwd,
        history: session.history,
        lines: session.lines
      }))
    });
  }

  function renderPrompt() {
    promptPath.textContent = formatTerminalPath(activeSession()?.cwd || "");
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
    renderPrompt();
  }

  function appendOutputText(row, text, cwd) {
    const references = findTerminalSourceReferences(text, { workspace: fs, cwd });
    if (!references.length) {
      row.textContent = text;
      return;
    }
    let cursor = 0;
    for (const reference of references) {
      if (reference.start > cursor) row.append(document.createTextNode(text.slice(cursor, reference.start)));
      const link = document.createElement("button");
      link.type = "button";
      link.className = "terminal-view__source-link";
      link.textContent = reference.text;
      link.title = `Open ${reference.fileName}:${reference.line}:${reference.column}`;
      link.setAttribute("aria-label", link.title);
      Object.assign(link.style, {
        appearance: "none",
        border: "0",
        background: "transparent",
        color: "inherit",
        font: "inherit",
        padding: "0",
        margin: "0",
        cursor: "pointer",
        textDecoration: "underline",
        textUnderlineOffset: "2px"
      });
      link.addEventListener("click", async () => {
        const opened = await navigateTerminalSourceReference(reference, { openFile, openFileAt });
        if (!opened) notify?.(`Unable to open ${reference.fileName}:${reference.line}:${reference.column}`);
      });
      row.append(link);
      cursor = reference.end;
    }
    if (cursor < text.length) row.append(document.createTextNode(text.slice(cursor)));
  }

  function renderOutput() {
    const session = activeSession();
    const fragment = document.createDocumentFragment();
    for (const line of session?.lines || []) {
      const row = document.createElement("div");
      appendOutputText(row, line.text, line.cwd ?? session?.cwd ?? "");
      if (line.kind === "error") row.setAttribute("role", "alert");
      fragment.append(row);
    }
    output.replaceChildren(fragment);
    output.scrollTop = output.scrollHeight;
  }

  function write(text, kind = "output") {
    const session = activeSession();
    if (!session) return;
    const outputCwd = session.cwd;
    String(text ?? "").split("\n").forEach((line) => session.lines.push(createTerminalOutputLine(line, kind, outputCwd)));
    if (session.lines.length > MAX_OUTPUT_LINES) {
      session.lines.splice(0, session.lines.length - MAX_OUTPUT_LINES);
    }
    renderOutput();
    persist();
  }

  function clear() {
    const session = activeSession();
    if (!session) return;
    session.lines.length = 0;
    renderOutput();
    persist();
  }

  function createSession(label = "browser", { focus = true } = {}) {
    const id = `terminal-${nextSessionId}`;
    const session = {
      id,
      name: `${label} ${nextSessionId}`,
      cwd: "",
      lines: [createTerminalOutputLine("CREED safe browser terminal. Type help for commands.")],
      history: [],
      historyIndex: 0
    };
    nextSessionId += 1;
    sessions.push(session);
    activeId = id;
    renderSessions();
    renderOutput();
    persist();
    showView?.("terminal");
    if (focus) requestAnimationFrame(() => input.focus());
    return session;
  }

  function killActiveSession() {
    if (sessions.length <= 1) return false;
    const index = sessions.findIndex((session) => session.id === activeId);
    sessions.splice(index, 1);
    activeId = sessions[Math.max(0, index - 1)]?.id || sessions[0].id;
    renderSessions();
    renderOutput();
    persist();
    input.focus();
    return true;
  }

  async function execute(lineValue) {
    const line = String(lineValue || "").trim();
    if (!line) return false;
    const session = activeSession();
    if (!session) return false;
    session.history.push(line);
    if (session.history.length > MAX_HISTORY_ITEMS) {
      session.history.splice(0, session.history.length - MAX_HISTORY_ITEMS);
    }
    session.historyIndex = session.history.length;
    write("$ " + line, "command");
    try {
      await processor.execute(line, {
        write,
        clear,
        history: session.history,
        getCwd: () => session.cwd,
        setCwd: (nextCwd) => {
          session.cwd = resolveTerminalPath(".", nextCwd);
          renderPrompt();
          persist();
        },
        sessions: sessionSummary
      });
      persist();
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      write(message, "error");
      notify?.(message);
      persist();
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
    } else if (event.key === "Tab") {
      event.preventDefault();
      const completion = completeTerminalInput(input.value, { workspace: fs, cwd: session.cwd });
      input.value = completion.value;
      input.setSelectionRange(input.value.length, input.value.length);
      if (completion.candidates.length > 1) write(completion.candidates.join("  "));
    }
  });

  sessionSelect.addEventListener("change", () => {
    if (!sessions.some((session) => session.id === sessionSelect.value)) return;
    activeId = sessionSelect.value;
    renderSessions();
    renderOutput();
    persist();
    input.focus();
  });

  newButton.addEventListener("click", () => createSession("browser"));
  splitButton.addEventListener("click", () => createSession("split"));
  killButton.addEventListener("click", killActiveSession);
  window.addEventListener("pagehide", persist);

  if (sessions.length) {
    if (!sessions.some((session) => session.id === activeId)) activeId = sessions[0].id;
    renderSessions();
    renderOutput();
    persist();
  } else {
    createSession();
  }

  return Object.freeze({
    execute,
    write,
    clear,
    createSession,
    killActiveSession,
    focus: () => input.focus(),
    getSessions: sessionSummary,
    getActiveCwd: () => activeSession()?.cwd || "",
    complete: (value) => completeTerminalInput(value, { workspace: fs, cwd: activeSession()?.cwd || "" }),
    persist
  });
}
