import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ACTIVE_JAVASCRIPT_ENTRY,
  DEFAULT_RUN_CONFIG,
  RUN_CONFIG_PATH,
  TASK_CONFIG_PATH,
  loadRunConfig,
  loadTasks,
  normalizeRunConfig
} from "../js/components/run-debug/run-config.js";
import {
  buildPreviewDocument,
  createPreviewBridgeSource,
  parsePreviewRuntimeLocation
} from "../js/components/run-debug/preview-runtime.js";
import {
  buildModuleExecutionDocument,
  buildWorkspaceModuleGraph,
  parseWorkerRuntimeLocation
} from "../js/components/run-debug/worker-runtime.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");

function createWorkspace(entries) {
  const files = new Map(entries);
  return {
    hasFile: (path) => files.has(path),
    readFile: async (path) => {
      if (!files.has(path)) throw new Error("missing " + path);
      return files.get(path);
    },
    listFiles: () => [...files.keys()],
    writeFile: (path, content) => files.set(path, String(content))
  };
}

assert.deepEqual(normalizeRunConfig({}), DEFAULT_RUN_CONFIG);
assert.deepEqual(normalizeRunConfig({ name: "Worker", type: "javascript", entry: "task.js", autoReload: false }), {
  version: 1,
  name: "Worker",
  type: "javascript",
  entry: "task.js",
  autoReload: false
});

const defaultTasks = await loadTasks(createWorkspace([]));
assert.equal(defaultTasks[1].type, "javascript");
assert.equal(defaultTasks[1].entry, ACTIVE_JAVASCRIPT_ENTRY, "Default JavaScript task must resolve the active editor file instead of hard-coding js/main.js.");

const configWorkspace = createWorkspace([
  [RUN_CONFIG_PATH, JSON.stringify({ name: "App", type: "preview", entry: "app.html", autoReload: true })],
  [TASK_CONFIG_PATH, JSON.stringify({ tasks: [
    { name: "App", type: "preview", entry: "app.html" },
    { name: "Script", type: "javascript", entry: "task.js", autoReload: false }
  ] })]
]);
assert.equal((await loadRunConfig(configWorkspace)).entry, "app.html");
const tasks = await loadTasks(configWorkspace);
assert.equal(tasks.length, 2);
assert.equal(tasks[1].type, "javascript");

const previewWorkspace = createWorkspace([
  ["app.html", '<!doctype html><link rel="stylesheet" href="style.css"><main>CREED</main><script src="task.js"></script>'],
  ["style.css", "main { display: grid; }"],
  ["task.js", "console.log('preview');"]
]);
const preview = await buildPreviewDocument("app.html", previewWorkspace);
assert(preview.includes('data-creed-preview-source="style.css"'), "Preview must inline workspace styles.");
assert(preview.includes('data-creed-preview-source="task.js"'), "Preview must inline workspace scripts.");
assert(preview.includes("workspace/task.js"), "Preview scripts must retain workspace source URLs.");
assert(preview.includes("creed-preview"), "Preview must inject the console/runtime bridge.");
assert(createPreviewBridgeSource().includes("unhandledrejection"), "Preview bridge must capture promise failures.");

const moduleWorkspace = createWorkspace([
  ["tasks/main.js", 'import { answer } from "./lib/value.js"; console.log(answer);'],
  ["tasks/lib/value.js", 'export { answer } from "./answer.js";'],
  ["tasks/lib/answer.js", "export const answer = 42;"]
]);
const moduleGraph = await buildWorkspaceModuleGraph("tasks/main.js", moduleWorkspace);
assert.equal(moduleGraph.modules.size, 3, "JavaScript runtime must include the complete relative ES-module dependency graph.");
assert(moduleGraph.modules.get("tasks/main.js").includes("creed-workspace/tasks/lib/value.js"), "Entry imports must be remapped into the virtual workspace.");
assert(moduleGraph.modules.get("tasks/lib/value.js").includes("creed-workspace/tasks/lib/answer.js"), "Nested module imports must be remapped into the virtual workspace.");
const moduleDocument = await buildModuleExecutionDocument("tasks/main.js", moduleWorkspace);
assert(moduleDocument.includes('type="importmap"'), "JavaScript module runtime must provide an import map.");
assert(moduleDocument.includes("creed-workspace/tasks/main.js"), "Module runtime must map the entry module.");
assert(moduleDocument.includes("creed-workspace/tasks/lib/value.js"), "Module runtime must map dependencies.");
await assert.rejects(
  () => buildWorkspaceModuleGraph("tasks/missing.js", moduleWorkspace),
  /JavaScript entry not found/,
  "Missing JavaScript entries must fail before runtime launch."
);

assert.deepEqual(
  parsePreviewRuntimeLocation({ fileName: "workspace/js/app.js:12:4", line: 12, column: 4 }),
  { fileName: "js/app.js", line: 12, column: 4 }
);
assert.deepEqual(
  parseWorkerRuntimeLocation({ stack: "Error: boom\n at workspace/tasks/job.js:8:3" }),
  { fileName: "tasks/job.js", line: 8, column: 3 }
);

const controller = read("js/components/run-debug/run-debug-main.js");
assert(controller.includes('runView.id = "runDebugView"'), "Run activity must own a dedicated sidebar view.");
assert(controller.includes('runButton.id = "runTaskBtn"'), "Run control is missing.");
assert(controller.includes('stopButton.id = "stopTaskBtn"'), "Stop control is missing.");
assert(controller.includes('restartButton.id = "restartTaskBtn"'), "Restart control is missing.");
assert(controller.includes("workspace.subscribe"), "Live reload must react to workspace writes.");
assert(controller.includes("openFileAt"), "Runtime errors must route back to source navigation.");
assert(controller.includes("ACTIVE_JAVASCRIPT_ENTRY"), "Run controller must support the active JavaScript task sentinel.");
assert(controller.includes('[aria-selected="true"][data-resource]'), "Active JavaScript task must resolve the selected editor tab.");

const main = read("js/main.js");
assert(main.includes('bindRunDebug'), "Application orchestration must bind Run and Debug.");
assert(main.includes('runButton: elements.activityRunBtn'), "Run activity button must be controlled by the primary sidebar.");
assert(main.includes('runView: runDebug.view'), "Run sidebar view must be registered with the primary sidebar controller.");
assert(main.includes('outputView: elements.outputView'), "Run output must use the real Output panel.");
assert(main.includes('debugConsoleView: elements.debugConsoleView'), "Runtime failures must use the real Debug Console panel.");
assert(main.includes("runtimeTargetLine"), "Runtime source navigation must retain the resolved target line.");

const primarySidebar = read("js/components/primary-sidebar/primary-sidebar-input.js");
assert(primarySidebar.includes('["explorer", "search", "sourceControl", "run"]'), "Primary sidebar must preserve the Run activity when additional activities are registered.");
assert(primarySidebar.includes('runButton?.addEventListener'), "Run activity button binding must remain present.");
const unavailable = read("js/ui/unavailable-controls.js");
assert(!unavailable.includes('"#activityRunBtn"'), "Run activity must no longer be disabled.");

console.log("Run and Debug check passed.");
