import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildDependencyModel,
  createProblemsModel,
  findArchitectureViolations,
  findDependencyCycles,
  findOrphanModules,
  parseCheckOutput
} from "../js/components/diagnostics/diagnostics-model.js";
import { createPerformanceProfiler } from "../js/components/diagnostics/performance-profiler.js";
import {
  UNIFIED_WORKSPACE_STATE_KEY,
  createUnifiedWorkspaceState
} from "../js/core/workspace-state.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");

const problems = createProblemsModel();
problems.setSource("one", [{ severity: "error", code: "E1", message: "boom", fileName: "a.js", line: 1 }]);
problems.setSource("two", [{ severity: "warning", code: "W1", message: "warn" }]);
assert.deepEqual(problems.counts(), { error: 1, warning: 1, info: 0 });
problems.setSource("one", [{ severity: "info", code: "I1", message: "replaced" }]);
assert.deepEqual(problems.counts(), { error: 0, warning: 1, info: 1 }, "Problems sources must replace stale diagnostics.");

const parsed = parseCheckOutput("src/app.js:4:8 - Error: broken\nAssertionError: failed");
assert.equal(parsed.length, 2);
assert.equal(parsed[0].fileName, "src/app.js");
assert.equal(parsed[0].line, 3);
assert.equal(parsed[0].severity, "error");

const dependencyModel = {
  nodes: [
    { id: "file:a.js", type: "file", category: "js", fileName: "a.js" },
    { id: "file:b.js", type: "file", category: "js", fileName: "b.js" },
    { id: "file:main.js", type: "file", category: "js", fileName: "main.js" },
    { id: "file:orphan.js", type: "file", category: "js", fileName: "orphan.js" }
  ],
  edges: [
    { from: "file:a.js", to: "file:b.js", type: "import" },
    { from: "file:b.js", to: "file:a.js", type: "import" },
    { from: "file:main.js", to: "file:a.js", type: "import" }
  ]
};
assert.equal(findDependencyCycles(dependencyModel).length, 1, "One dependency cycle should be reported once.");
const orphans = findOrphanModules(dependencyModel);
assert(orphans.some((item) => item.fileName === "orphan.js"));
assert(!orphans.some((item) => item.fileName === "main.js"), "Main entry modules must not be classified as orphaned.");

const workspaceFiles = new Map([
  ["js/main.js", 'import "./missing.js";'],
  ["js/tool-fix.js", "export const x = 1;"]
]);
const workspace = {
  listFiles: () => [...workspaceFiles.keys()],
  readFile: async (path) => workspaceFiles.get(path) || ""
};
const architecture = await findArchitectureViolations(workspace);
assert(architecture.some((item) => item.code === "UNRESOLVED-IMPORT" && item.fileName === "js/main.js"));
assert(architecture.some((item) => item.code === "DUPLICATE-SUFFIX" && item.fileName === "js/tool-fix.js"));
const dependencies = await buildDependencyModel({
  listFiles: () => ["js/main.js", "js/run.js", "css/main.css", "css/base.css"],
  readFile: async (path) => ({
    "js/main.js": 'import "./run.js";',
    "js/run.js": "export const run = true;",
    "css/main.css": '@import "./base.css";',
    "css/base.css": ":root{}"
  })[path] || ""
});
assert(dependencies.edges.some((edge) => edge.type === "import" && edge.to === "file:js/run.js"));
assert(dependencies.edges.some((edge) => edge.type === "css-import" && edge.to === "file:css/base.css"));

const fixtureSource = [
  'const workspace = { "js/main.js": "import { run } from \'./run.js\';\\nrun();" };',
  '// import "./comment-only.js";',
  '/* export { value } from "./block-comment.js"; */',
  'const sample = `import("./template-only.js")`;'
].join("\n");
const fixtureArchitecture = await findArchitectureViolations({
  listFiles: () => ["scripts/check-ai-workbench.mjs"],
  readFile: async () => fixtureSource
});
assert.equal(
  fixtureArchitecture.filter((item) => item.code === "UNRESOLVED-IMPORT").length,
  0,
  "Imports embedded in JavaScript strings, comments, or templates must not be reported as dependencies."
);

const lexicalDependencies = await buildDependencyModel({
  listFiles: () => [
    "scripts/check-ai-workbench.mjs",
    "scripts/run.js",
    "scripts/real-export.js",
    "scripts/real-dynamic.js"
  ],
  readFile: async (path) => ({
    "scripts/check-ai-workbench.mjs": fixtureSource,
    "scripts/run.js": "export const run = true;",
    "scripts/real-export.js": 'export { run } from "./run.js";',
    "scripts/real-dynamic.js": 'export async function load(){ return import("./run.js"); }'
  })[path] || ""
});
assert(!lexicalDependencies.edges.some((edge) => edge.from === "file:scripts/check-ai-workbench.mjs"), "Fixture strings must not create dependency edges.");
assert(lexicalDependencies.edges.some((edge) => edge.from === "file:scripts/real-export.js" && edge.to === "file:scripts/run.js"));
assert(lexicalDependencies.edges.some((edge) => edge.from === "file:scripts/real-dynamic.js" && edge.to === "file:scripts/run.js"));

let clock = 0;
const profiler = createPerformanceProfiler({ now: () => clock });
const measured = await profiler.measure("test", async () => {
  clock = 12.5;
  return 7;
});
assert.equal(measured, 7);
assert.equal(profiler.summary()[0].last, 12.5);

function memoryStorage(entries = {}) {
  const values = new Map(Object.entries(entries));
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    values
  };
}

const storage = memoryStorage({ alpha: '{"value":1}', beta: "saved" });
const unified = createUnifiedWorkspaceState({ storage, keys: ["alpha", "beta"], now: () => 123 });
const snapshot = unified.snapshot();
assert.equal(snapshot.version, 1);
assert.equal(snapshot.savedAt, 123);
assert.equal(snapshot.sections.alpha, '{"value":1}');
storage.removeItem("alpha");
assert.equal(unified.restoreMissing(), 1);
assert.equal(storage.getItem("alpha"), '{"value":1}');
assert(storage.getItem(UNIFIED_WORKSPACE_STATE_KEY), "Unified state envelope must be persisted.");

const migrationStorage = memoryStorage({
  [UNIFIED_WORKSPACE_STATE_KEY]: JSON.stringify({ version: 0, savedAt: 4, state: { alpha: "legacy" } })
});
const migrated = createUnifiedWorkspaceState({ storage: migrationStorage, keys: ["alpha"] });
assert.equal(migrated.load().version, 1);
assert.equal(migrated.restoreMissing(), 1);
assert.equal(migrationStorage.getItem("alpha"), "legacy");

const diagnosticsMain = read("js/components/diagnostics/diagnostics-main.js");
assert(diagnosticsMain.includes("Test Explorer"), "Diagnostics must expose a Test Explorer.");
assert(diagnosticsMain.includes("async function runTest"), "Tests must be runnable independently.");
assert(diagnosticsMain.includes("actions/runs?per_page=1"), "Diagnostics must expose GitHub Actions status.");
assert(diagnosticsMain.includes("Performance Profiler"), "Diagnostics must expose profiler measurements.");
assert(diagnosticsMain.includes("buildDependencyModel"), "Diagnostics must use its own dependency analyzer.");
const terminalBridge = read("js/components/diagnostics/diagnostics-terminal.js");
assert(terminalBridge.includes('command !== "npm check"'), "Terminal bridge must recognize npm check.");
assert(terminalBridge.includes("runChecks({ reveal: true })"), "Terminal npm check must route to Problems diagnostics.");
const main = read("js/main.js");
assert(main.includes("problemsView: elements.problemsView"), "Application must bind diagnostics to the real Problems panel.");
assert(main.includes("createUnifiedWorkspaceState"), "Application must use the unified workspace-state envelope.");
assert(main.includes("bindDiagnosticsTerminalCommand"), "Application must route terminal npm check into diagnostics.");

console.log("Diagnostics checks passed.");
