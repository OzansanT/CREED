import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createAgentToolSandbox } from "../js/components/ai/agent-sandbox.js";
import { applyAIPatch, hashPatchContent, normalizeAIPatch } from "../js/components/ai/ai-patch.js";
import { createLLMProviderRegistry, createLocalContextProvider } from "../js/components/ai/llm-provider.js";
import { createSemanticRepositoryIndex } from "../js/components/ai/semantic-index.js";
import { createTaskDag } from "../js/components/ai/task-dag.js";
import { runVerifyRepairLoop } from "../js/components/ai/verify-repair-loop.js";
import { createWorkspaceContextEngine } from "../js/components/ai/workspace-context.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");

function memoryWorkspace(entries) {
  const files = new Map(Object.entries(entries));
  const listeners = new Set();
  const emit = (change) => listeners.forEach((listener) => listener(change));
  return {
    listFiles: () => [...files.keys()].sort(),
    listDirectories: () => [],
    hasFile: (path) => files.has(path),
    readFile: async (path) => {
      if (!files.has(path)) throw new Error("missing " + path);
      return files.get(path);
    },
    writeFile: (path, content) => { files.set(path, String(content)); emit({ type: "file-written", path }); },
    createFile: (path, content = "") => { if (files.has(path)) throw new Error("exists"); files.set(path, String(content)); emit({ type: "file-created", path }); },
    deleteFile: (path) => { const result = files.delete(path); emit({ type: "file-deleted", path }); return result; },
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    snapshot: () => Object.fromEntries(files)
  };
}

const registry = createLLMProviderRegistry();
registry.register("local", createLocalContextProvider());
registry.register("test", { label: "Test", complete: async ({ prompt }) => ({ message: `ok:${prompt}` }) });
registry.setActive("test");
assert.equal((await registry.complete({ prompt: "hello" })).message, "ok:hello");
assert.equal(registry.list().length, 2);

const workspace = memoryWorkspace({
  "js/main.js": "import { run } from './run.js';\nrun();",
  "js/run.js": "export function run(){ return 42; }",
  "README.md": "CREED visual workspace system"
});
const index = createSemanticRepositoryIndex({ workspace });
await index.refresh();
const semanticResults = index.search("visual workspace");
assert.equal(semanticResults[0].fileName, "README.md");

const contextEngine = createWorkspaceContextEngine({
  workspace,
  semanticIndex: index,
  getActiveFile: () => "js/main.js",
  getOpenFiles: () => ["js/main.js"],
  getProblems: () => [{ severity: "warning", code: "W", message: "sample", fileName: "js/main.js", line: 0 }]
});
const context = await contextEngine.build("run function");
assert.equal(context.activeFile, "js/main.js");
assert(context.excerpts.some((item) => item.fileName === "js/main.js"));
assert(context.relevantFiles.some((item) => item.fileName === "js/run.js"));

const sandbox = createAgentToolSandbox({ workspace, semanticIndex: index, contextEngine });
assert(sandbox.listTools().includes("propose-patch"));
assert.equal((await sandbox.invoke("read-file", { path: "js/run.js" })).includes("42"), true);
await assert.rejects(sandbox.invoke("shell", { command: "rm -rf /" }), /not allowlisted/);

const before = await workspace.readFile("js/run.js");
const patch = normalizeAIPatch({
  version: 1,
  title: "Update run",
  files: [{ path: "js/run.js", operation: "write", beforeHash: hashPatchContent(before), content: "export function run(){ return 43; }" }]
});
await assert.rejects(applyAIPatch(patch, workspace), /explicit approval/);
await applyAIPatch(patch, workspace, { approved: true });
assert.equal((await workspace.readFile("js/run.js")).includes("43"), true);

const dagEvents = [];
const dag = createTaskDag([
  { id: "a", dependencies: [], run: async () => { dagEvents.push("a"); return 1; } },
  { id: "b", dependencies: ["a"], run: async ({ dependencies }) => { dagEvents.push("b"); return dependencies.a + 1; } }
]);
const dagResult = await dag.execute();
assert.deepEqual(dagEvents, ["a", "b"]);
assert.equal(dagResult.results.b, 2);
assert.throws(() => createTaskDag([
  { id: "a", dependencies: ["b"], run: async () => {} },
  { id: "b", dependencies: ["a"], run: async () => {} }
]), /cycle/);

let verifyCount = 0;
let repairCount = 0;
const loop = await runVerifyRepairLoop({
  verify: async () => ({ passed: ++verifyCount >= 2 }),
  repair: async () => { repairCount += 1; },
  maxAttempts: 3
});
assert.equal(loop.passed, true);
assert.equal(repairCount, 1);

const chat = read("js/components/ai/chat-main.js");
assert(chat.includes("renderPatchApproval"), "Chat must render a diff approval UI for proposed patches.");
assert(chat.includes("applyAIPatch(patch, workspace, { approved: true })"), "Approved patches must apply directly to the workspace.");
assert(!chat.includes("selfDevelopment"), "AI chat must not retain the removed Source Control self-development path.");
const aiMain = read("js/components/ai/ai-main.js");
assert(aiMain.includes("createAgentToolSandbox"), "AI workbench must wire the tool sandbox.");
assert(aiMain.includes("createSemanticRepositoryIndex"), "AI workbench must wire the semantic repository index.");
assert(!aiMain.includes("self-development"), "AI workbench must not import the removed self-development workflow.");
const unavailable = read("js/ui/unavailable-controls.js");
assert(!unavailable.includes('"#chatPromptInput"'));
assert(!unavailable.includes('"#sendChatMessageBtn"'));
const main = read("js/main.js");
assert(main.includes("bindAIWorkbench"), "Application orchestration must enable the Secondary Sidebar AI workbench.");
assert(main.includes("globalThis.CREED_AI"), "External LLM providers must have an explicit registration surface.");

console.log("AI workbench checks passed.");
