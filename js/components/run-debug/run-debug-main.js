import { loadRunConfig, loadTasks } from "./run-config.js";
import { bindRunOutputConsoles } from "./output-console.js";
import { createPreviewRuntime } from "./preview-runtime.js";
import { createWorkerRuntime } from "./worker-runtime.js";

function createButton(label, title = label) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.title = title;
  return button;
}

function formatConsole(payload = {}) {
  const level = String(payload.level || "log").toUpperCase();
  const args = Array.isArray(payload.args) ? payload.args : [];
  return `[${level}] ${args.join(" ")}`;
}

function formatError(payload = {}, location) {
  const prefix = location ? `${location.fileName}:${location.line}:${location.column}: ` : "";
  return prefix + String(payload.message || "Runtime error");
}

export function bindRunDebug({
  sidebar,
  editorViewport,
  workspace,
  activityRunButton,
  outputView,
  debugConsoleView,
  showBottomView,
  openFileAt,
  notify
}) {
  const runView = document.createElement("section");
  runView.id = "runDebugView";
  runView.className = "primary-sidebar__content explorer-view panel__content";
  runView.hidden = true;
  runView.setAttribute("aria-label", "Run and Debug");

  const heading = document.createElement("h2");
  heading.textContent = "RUN AND DEBUG";
  const configLabel = document.createElement("div");
  configLabel.className = "label";
  const taskSelect = document.createElement("select");
  taskSelect.id = "runTaskSelect";
  taskSelect.setAttribute("aria-label", "Run task");
  const controls = document.createElement("div");
  controls.className = "toolbar";
  const runButton = createButton("Run", "Run selected task");
  runButton.id = "runTaskBtn";
  const stopButton = createButton("Stop", "Stop running task");
  stopButton.id = "stopTaskBtn";
  const restartButton = createButton("Restart", "Restart running task");
  restartButton.id = "restartTaskBtn";
  controls.append(runButton, stopButton, restartButton);
  const status = document.createElement("div");
  status.id = "runDebugStatus";
  status.className = "label";
  const help = document.createElement("p");
  help.textContent = "Run index.html in a sandboxed preview or execute a JavaScript workspace file in an isolated Worker.";
  runView.append(heading, configLabel, taskSelect, controls, status, help);
  sidebar.querySelector(".primary-sidebar__content:last-of-type")?.insertAdjacentElement("afterend", runView);
  if (!runView.parentElement) sidebar.append(runView);

  const previewHost = document.createElement("section");
  previewHost.id = "runPreviewHost";
  previewHost.hidden = true;
  previewHost.setAttribute("aria-label", "Sandbox preview");
  Object.assign(previewHost.style, {
    position: "absolute",
    inset: "0",
    zIndex: "30",
    background: "white",
    border: "0",
    overflow: "hidden"
  });
  editorViewport.append(previewHost);

  const consoles = bindRunOutputConsoles({ outputView, debugConsoleView, showView: showBottomView });
  let tasks = [];
  let runningTask = null;
  let currentConfig = null;
  let reloadTimer = 0;
  let runGeneration = 0;

  function navigateError(location) {
    if (!location?.fileName) return false;
    openFileAt?.(location.fileName, location.line, location.column);
    return true;
  }

  const preview = createPreviewRuntime({
    host: previewHost,
    workspace,
    onConsole: (payload) => consoles.writeOutput(formatConsole(payload), payload.level === "error" ? "error" : "output"),
    onError: (payload, location) => {
      consoles.writeDebug(formatError(payload, location), "error", { reveal: true });
      navigateError(location);
    },
    onReady: () => {
      status.textContent = runningTask ? `Running ${runningTask.name}` : "Preview ready";
      consoles.writeOutput("Preview ready.");
    }
  });

  const worker = createWorkerRuntime({
    workspace,
    onConsole: (payload) => consoles.writeOutput(formatConsole(payload), payload.level === "error" ? "error" : "output"),
    onError: (payload, location) => {
      consoles.writeDebug(formatError(payload, location), "error", { reveal: true });
      navigateError(location);
      status.textContent = "Runtime error";
    },
    onComplete: (payload) => {
      consoles.writeOutput(`Worker completed: ${payload.fileName}`);
      status.textContent = "Completed";
    }
  });

  function synchronizeControls() {
    const running = preview.isRunning() || worker.isRunning();
    runButton.disabled = running;
    stopButton.disabled = !running;
    restartButton.disabled = !runningTask;
    for (const button of [runButton, stopButton, restartButton]) {
      button.setAttribute("aria-disabled", String(button.disabled));
    }
  }

  function stop({ keepTask = false } = {}) {
    runGeneration += 1;
    clearTimeout(reloadTimer);
    reloadTimer = 0;
    preview.stop();
    worker.stop();
    previewHost.hidden = true;
    status.textContent = "Stopped";
    consoles.writeOutput("Execution stopped.");
    if (!keepTask) runningTask = null;
    synchronizeControls();
    return true;
  }

  async function executeTask(task, { restart = false } = {}) {
    if (!task) throw new Error("No run task selected.");
    const generation = ++runGeneration;
    preview.stop();
    worker.stop();
    previewHost.hidden = task.type !== "preview";
    runningTask = { ...task };
    status.textContent = `${restart ? "Restarting" : "Starting"} ${task.name}…`;
    consoles.writeOutput(`${restart ? "Restart" : "Run"}: ${task.name} (${task.type}) → ${task.entry}`, "output", { reveal: true });
    try {
      if (task.type === "preview") await preview.run(task.entry);
      else if (task.type === "javascript") await worker.run(task.entry);
      else throw new Error("Unsupported run task type: " + task.type);
      if (generation !== runGeneration) return false;
      status.textContent = `Running ${task.name}`;
      synchronizeControls();
      return true;
    } catch (error) {
      if (generation !== runGeneration) return false;
      const message = error instanceof Error ? error.message : String(error);
      status.textContent = "Failed";
      consoles.writeDebug(message, "error", { reveal: true });
      synchronizeControls();
      throw error;
    }
  }

  async function runSelected() {
    const task = tasks.find((candidate) => candidate.name === taskSelect.value) || currentConfig || tasks[0];
    return executeTask(task);
  }

  async function restart() {
    if (!runningTask) return runSelected();
    return executeTask({ ...runningTask }, { restart: true });
  }

  async function refreshConfiguration() {
    currentConfig = await loadRunConfig(workspace);
    tasks = await loadTasks(workspace);
    if (!tasks.some((task) => task.name === currentConfig.name)) tasks.unshift({ ...currentConfig });
    const previous = taskSelect.value;
    const fragment = document.createDocumentFragment();
    for (const task of tasks) {
      const option = document.createElement("option");
      option.value = task.name;
      option.textContent = `${task.name} — ${task.entry}`;
      fragment.append(option);
    }
    taskSelect.replaceChildren(fragment);
    taskSelect.value = tasks.some((task) => task.name === previous) ? previous : currentConfig.name;
    configLabel.textContent = `.creed/run.json · ${currentConfig.type} · ${currentConfig.entry}`;
    synchronizeControls();
    return currentConfig;
  }

  runButton.addEventListener("click", () => runSelected().catch((error) => notify?.(error instanceof Error ? error.message : String(error))));
  stopButton.addEventListener("click", () => stop());
  restartButton.addEventListener("click", () => restart().catch((error) => notify?.(error instanceof Error ? error.message : String(error))));

  workspace.subscribe((change) => {
    if (change.path === ".creed/run.json" || change.path === ".creed/tasks.json") {
      refreshConfiguration().catch((error) => notify?.(error instanceof Error ? error.message : String(error)));
    }
    if (!runningTask || runningTask.type !== "preview" || runningTask.autoReload === false) return;
    clearTimeout(reloadTimer);
    reloadTimer = setTimeout(() => {
      restart().catch((error) => notify?.(error instanceof Error ? error.message : String(error)));
    }, 180);
  });

  refreshConfiguration().catch((error) => {
    configLabel.textContent = "Run configuration error";
    notify?.(error instanceof Error ? error.message : String(error));
  });
  synchronizeControls();

  return Object.freeze({
    view: runView,
    previewHost,
    run: runSelected,
    runTask(name) {
      const task = tasks.find((candidate) => candidate.name === name);
      if (!task) return Promise.reject(new Error("Run task not found: " + name));
      taskSelect.value = task.name;
      return executeTask(task);
    },
    stop,
    restart,
    refreshConfiguration,
    getTasks: () => tasks.map((task) => ({ ...task })),
    getState: () => ({ runningTask: runningTask ? { ...runningTask } : null, preview: preview.isRunning(), worker: worker.isRunning() }),
    consoles
  });
}
