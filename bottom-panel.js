import { bindTerminalSessions } from "./terminal-session.js";

export function bindBottomPanel({
  store,
  extensionHost,
  tabs,
  views,
  problemsView,
  outputView,
  debugView,
  debugOutput,
  debugForm,
  debugInput,
  terminalOutput,
  terminalForm,
  terminalInput,
  terminalSessionSelect,
  newTerminalButton,
  clearButton,
  closeButton,
  terminalBranch,
  portsView,
  editor,
  runPreview,
  closePanel,
  statusProblems,
  statusWarnings,
  notify
}) {
  let activeView = "terminal";
  const outputLines = [];
  const ports = new Map();
  if (location.port) ports.set(location.port, "CREED development server");

  function showView(name) {
    if (!views[name]) return;
    activeView = name;
    Object.entries(views).forEach(([id, view]) => { view.hidden = id !== name; });
    tabs.forEach((tab) => {
      const selected = tab.dataset.bottomView === name;
      tab.classList.toggle("active", selected);
      tab.setAttribute("aria-selected", String(selected));
      tab.setAttribute("aria-controls", views[tab.dataset.bottomView]?.id || "terminalPanel");
    });
    if (name === "problems") renderProblems();
    if (name === "output") renderOutput();
    if (name === "ports") renderPorts();
  }

  function logOutput(message, kind = "info") {
    outputLines.push({ createdAt: new Date(), message: String(message), kind });
    if (outputLines.length > 500) outputLines.shift();
    if (activeView === "output") renderOutput();
  }

  function renderOutput() {
    const fragment = document.createDocumentFragment();
    outputLines.forEach((entry) => {
      const row = document.createElement("div");
      row.className = entry.kind === "error" ? "terminal-output__error" : "";
      row.textContent = `[${entry.createdAt.toLocaleTimeString()}] ${entry.message}`;
      fragment.append(row);
    });
    if (!outputLines.length) {
      const empty = document.createElement("div");
      empty.className = "activity-empty";
      empty.textContent = "No output events yet.";
      fragment.append(empty);
    }
    outputView.replaceChildren(fragment);
  }

  function renderProblems() {
    const diagnostics = store.getDiagnostics();
    const errors = diagnostics.filter((item) => item.severity === "error").length;
    const warnings = diagnostics.filter((item) => item.severity === "warning").length;
    statusProblems.textContent = `ⓧ ${errors}`;
    statusWarnings.textContent = `△ ${warnings}`;
    const fragment = document.createDocumentFragment();
    diagnostics.forEach((item) => {
      const row = document.createElement("button");
      row.className = "problem-row";
      row.type = "button";
      const icon = document.createElement("span");
      icon.textContent = item.severity === "error" ? "ⓧ" : "△";
      const text = document.createElement("span");
      text.textContent = item.message;
      const location = document.createElement("span");
      location.textContent = `${item.path}:${item.line}`;
      row.append(icon, text, location);
      row.addEventListener("click", () => editor.openFile(item.path, { line: item.line }));
      fragment.append(row);
    });
    if (!diagnostics.length) {
      const empty = document.createElement("div");
      empty.className = "activity-empty";
      empty.textContent = "No workspace diagnostics.";
      fragment.append(empty);
    }
    problemsView.replaceChildren(fragment);
  }

  function renderPorts() {
    const root = document.createElement("div");
    const form = document.createElement("form");
    form.className = "activity-form";
    const portInput = document.createElement("input");
    portInput.type = "number";
    portInput.min = "1";
    portInput.max = "65535";
    portInput.placeholder = "Port";
    portInput.setAttribute("aria-label", "Port number");
    const labelInput = document.createElement("input");
    labelInput.placeholder = "Label";
    labelInput.setAttribute("aria-label", "Port label");
    const add = document.createElement("button");
    add.type = "submit";
    add.textContent = "Add";
    form.append(portInput, labelInput, add);
    const list = document.createElement("div");
    ports.forEach((label, port) => {
      const row = document.createElement("div");
      row.className = "port-row";
      const number = document.createElement("strong");
      number.textContent = port;
      const name = document.createElement("span");
      name.textContent = label;
      const actions = document.createElement("span");
      const open = document.createElement("a");
      open.href = `${location.protocol}//${location.hostname}:${port}`;
      open.target = "_blank";
      open.rel = "noreferrer";
      open.textContent = "Open";
      const remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = "×";
      remove.title = `Remove port ${port}`;
      remove.addEventListener("click", () => { ports.delete(port); renderPorts(); });
      actions.append(open, document.createTextNode(" "), remove);
      row.append(number, name, actions);
      list.append(row);
    });
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const port = String(Number(portInput.value));
      if (!Number.isInteger(Number(port)) || Number(port) < 1 || Number(port) > 65535) { notify?.("Enter a valid port number"); return; }
      ports.set(port, labelInput.value.trim() || `Port ${port}`);
      renderPorts();
    });
    root.append(form, list);
    portsView.replaceChildren(root);
  }

  function runDebugCommand(value) {
    const command = String(value || "").trim().toLowerCase();
    let result = "";
    if (command === "help") result = "Commands: help, state, tabs, file, diagnostics";
    else if (command === "state") result = JSON.stringify({ branch: store.getBranch(), files: store.listFiles().length, changes: store.listChanges().length }, null, 2);
    else if (command === "tabs") result = JSON.stringify(editor.getTabs(), null, 2);
    else if (command === "file") result = editor.getActiveFile() || "No active source file";
    else if (command === "diagnostics") result = JSON.stringify(store.getDiagnostics(), null, 2);
    else result = "Unknown debug command. Type help.";
    const row = document.createElement("div");
    row.textContent = `› ${value}\n${result}`;
    debugOutput.append(row);
    debugOutput.scrollTop = debugOutput.scrollHeight;
  }

  tabs.forEach((tab) => tab.addEventListener("click", () => showView(tab.dataset.bottomView)));
  debugForm.addEventListener("submit", (event) => { event.preventDefault(); runDebugCommand(debugInput.value); debugInput.value = ""; });
  closeButton.addEventListener("click", closePanel);
  const terminal = bindTerminalSessions({
    store,
    extensionHost,
    output: terminalOutput,
    form: terminalForm,
    input: terminalInput,
    sessionSelect: terminalSessionSelect,
    newButton: newTerminalButton,
    branchLabel: terminalBranch,
    openFile: editor.openFile,
    runPreview,
    showView,
    notify
  });
  clearButton.addEventListener("click", () => {
    if (activeView === "terminal") terminal.clear();
    else if (activeView === "output") { outputLines.length = 0; renderOutput(); }
    else if (activeView === "debug") debugOutput.replaceChildren();
    else if (activeView === "problems") renderProblems();
    else if (activeView === "ports") { ports.clear(); renderPorts(); }
  });
  store.subscribe((event) => {
    if (["write", "create", "delete", "rename", "discard", "discard-all", "commit", "replace-all", "restore", "reset"].includes(event.type)) {
      renderProblems();
      logOutput(`${event.type}: ${event.path || event.commit?.id || "workspace"}`);
    }
  });
  renderProblems();
  renderOutput();
  renderPorts();
  showView("terminal");

  return Object.freeze({ showView, logOutput, renderProblems, terminal });
}
