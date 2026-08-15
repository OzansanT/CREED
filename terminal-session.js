function tokenize(commandLine) {
  const tokens = [];
  const pattern = /"((?:\\.|[^"])*)"|'((?:\\.|[^'])*)'|(\S+)/g;
  for (const match of String(commandLine).matchAll(pattern)) {
    tokens.push((match[1] ?? match[2] ?? match[3]).replace(/\\([\\"'])/g, "$1"));
  }
  return tokens;
}

function formatChanges(store) {
  const label = { added: "A", modified: "M", deleted: "D" };
  const changes = store.listChanges();
  return changes.length
    ? changes.map((change) => `${change.staged ? "●" : "○"} ${label[change.status] || "?"} ${change.path}`).join("\n")
    : "Workspace clean";
}

export function bindTerminalSessions({
  store,
  extensionHost,
  output,
  form,
  input,
  sessionSelect,
  newButton,
  branchLabel,
  openFile,
  runPreview,
  showView,
  notify
}) {
  const sessions = [];
  let activeId = "";
  let nextId = 1;

  function activeSession() {
    return sessions.find((session) => session.id === activeId);
  }

  function render() {
    const session = activeSession();
    const fragment = document.createDocumentFragment();
    (session?.lines || []).forEach((line) => {
      const row = document.createElement("div");
      row.className = line.kind === "error" ? "terminal-output__error" : line.kind === "command" ? "terminal-output__command" : "";
      row.textContent = line.text;
      fragment.append(row);
    });
    output.replaceChildren(fragment);
    output.scrollTop = output.scrollHeight;
    branchLabel.textContent = `(${store.getBranch()})`;
  }

  function write(text, kind = "output") {
    const session = activeSession();
    if (!session) return;
    String(text ?? "").split("\n").forEach((line) => session.lines.push({ text: line, kind }));
    if (session.lines.length > 1000) session.lines.splice(0, session.lines.length - 1000);
    render();
  }

  function refreshSessions() {
    const fragment = document.createDocumentFragment();
    sessions.forEach((session) => {
      const option = document.createElement("option");
      option.value = session.id;
      option.textContent = `◈ ${session.name}`;
      option.selected = session.id === activeId;
      fragment.append(option);
    });
    sessionSelect.replaceChildren(fragment);
  }

  function createSession() {
    const id = `terminal-${nextId}`;
    const session = { id, name: `browser ${nextId}`, lines: [], history: [], historyIndex: 0 };
    nextId += 1;
    sessions.push(session);
    activeId = id;
    session.lines.push({ text: "CREED safe browser terminal. Type help for commands.", kind: "output" });
    refreshSessions();
    render();
    showView?.("terminal");
    requestAnimationFrame(() => input.focus());
    return session;
  }

  async function execute(lineValue) {
    const line = String(lineValue || "").trim();
    if (!line) return;
    const session = activeSession();
    session.history.push(line);
    session.historyIndex = session.history.length;
    write(`$ ${line}`, "command");
    const [commandValue, ...args] = tokenize(line);
    const command = commandValue.toLowerCase();
    try {
      if (command === "help") {
        const builtins = [
          "help", "clear", "pwd", "ls [folder]", "cat <file>", "open <file> [line]", "search <text>",
          "touch <file>", "mkdir <folder>", "mv <from> <to>", "rm <path>", "changes", "stage <file|--all>",
          "unstage <file|--all>", "restore <file|--all>", "branch [name]", "commit <message>", "diagnostics", "preview", "echo <text>",
          "date", "history"
        ];
        const contributed = extensionHost.listTerminalCommands().map((item) => `${item.name} — ${item.description}`);
        write([...builtins, ...contributed].join("\n"));
      } else if (command === "clear") {
        session.lines.length = 0;
        render();
      } else if (command === "pwd") {
        write("/workspace/CREED");
      } else if (command === "ls") {
        const prefix = args[0] ? args[0].replace(/\/$/, "") + "/" : "";
        const names = new Set();
        store.listDirectories().filter((path) => path.startsWith(prefix)).forEach((path) => names.add(path.slice(prefix.length).split("/")[0] + "/"));
        store.listFiles().filter((file) => file.path.startsWith(prefix)).forEach((file) => names.add(file.path.slice(prefix.length).split("/")[0]));
        write([...names].sort().join("\n") || "(empty)");
      } else if (command === "cat") {
        if (!args[0]) throw new Error("Usage: cat <file>");
        const source = await store.readFile(args[0]);
        write(source.length > 50000 ? source.slice(0, 50000) + "\n… output truncated" : source);
      } else if (command === "open") {
        if (!args[0]) throw new Error("Usage: open <file> [line]");
        await openFile(args[0], { line: Number(args[1]) || 1 });
      } else if (command === "search") {
        if (!args.length) throw new Error("Usage: search <text>");
        const matches = await store.search(args.join(" "), { limit: 30 });
        write(matches.length ? matches.map((match) => `${match.path}:${match.line}:${match.column} ${match.preview.trim()}`).join("\n") : "No matches");
      } else if (command === "touch") {
        if (!args[0]) throw new Error("Usage: touch <file>");
        store.createFile(args[0], "");
        write(`Created ${args[0]}`);
      } else if (command === "mkdir") {
        if (!args[0]) throw new Error("Usage: mkdir <folder>");
        store.createFolder(args[0]);
        write(`Created ${args[0]}/`);
      } else if (command === "mv") {
        if (args.length < 2) throw new Error("Usage: mv <from> <to>");
        await store.renamePath(args[0], args[1]);
        write(`Renamed ${args[0]} to ${args[1]}`);
      } else if (command === "rm") {
        if (!args[0]) throw new Error("Usage: rm <path>");
        const affected = await store.removePath(args[0]);
        write(`Deleted ${affected.length} file${affected.length === 1 ? "" : "s"}`);
      } else if (command === "changes" || command === "status") {
        write(formatChanges(store));
      } else if (command === "stage" || command === "unstage") {
        if (!args[0]) throw new Error(`Usage: ${command} <file|--all>`);
        const staged = command === "stage";
        if (args[0] === "--all") store.stageAll(staged);
        else store.setStaged(args[0], staged);
        write(staged ? "Changes staged" : "Changes unstaged");
      } else if (command === "restore") {
        if (!args[0]) throw new Error("Usage: restore <file|--all>");
        if (args[0] === "--all") store.discardAll();
        else store.discard(args[0]);
        write("Browser-workspace changes discarded");
      } else if (command === "branch") {
        if (!args[0]) write(store.getBranch());
        else { store.setBranch(args[0]); write(`Switched to ${store.getBranch()}`); }
      } else if (command === "commit") {
        const commit = store.commit(args.join(" "));
        write(`[${commit.branch} ${commit.id}] ${commit.message}\n${commit.files.length} files changed`);
      } else if (command === "diagnostics") {
        const diagnostics = store.getDiagnostics();
        write(diagnostics.length ? diagnostics.map((item) => `${item.path}:${item.line} ${item.severity}: ${item.message}`).join("\n") : "No diagnostics");
      } else if (command === "preview") {
        await runPreview();
      } else if (command === "echo") {
        write(args.join(" "));
      } else if (command === "date") {
        write(new Date().toString());
      } else if (command === "history") {
        write(session.history.map((item, index) => `${index + 1}  ${item}`).join("\n"));
      } else {
        const result = extensionHost.executeTerminalCommand(command, args, { store, openFile, runPreview, write });
        if (!result.handled) throw new Error(`${command}: command not found`);
        write(await result.value);
      }
    } catch (error) {
      write(error.message, "error");
      notify?.(error.message);
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
  sessionSelect.addEventListener("change", () => { activeId = sessionSelect.value; render(); input.focus(); });
  newButton.addEventListener("click", createSession);
  store.subscribe((event) => { if (event.type === "branch") render(); });
  createSession();

  return Object.freeze({ execute, write, clear() { activeSession().lines.length = 0; render(); }, focus: () => input.focus() });
}
