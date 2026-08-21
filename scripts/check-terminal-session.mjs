import assert from "node:assert/strict";
import {
  completeTerminalInput,
  createTerminalCommandProcessor,
  formatTerminalPath,
  loadTerminalState,
  resolveTerminalPath,
  saveTerminalState,
  searchWorkspaceFiles,
  tokenizeTerminalCommand
} from "../js/components/bottom-panel/terminal-session.js";
import { createWorkspaceFileSystem } from "../js/components/editor-panel/workspace-fs.js";

assert.deepEqual(tokenizeTerminalCommand('open "ui/main-frame.html"'), ["open", "ui/main-frame.html"]);
assert.deepEqual(tokenizeTerminalCommand("echo 'hello world'"), ["echo", "hello world"]);
assert.deepEqual(tokenizeTerminalCommand("echo hello\\\"world"), ["echo", 'hello"world']);
assert.equal(resolveTerminalPath("../README.md", "src"), "README.md");
assert.equal(formatTerminalPath("src"), "/workspaces/CREED/src");

const baseline = new Map([
  ["README.md", "CREED"],
  ["src/main.js", "console.log('main');"],
  ["src/util.js", "export const util = true;"],
  ["docs/info.md", "Info"]
]);
const storageValues = new Map();
const workspaceStorage = {
  getItem: (key) => storageValues.has(key) ? storageValues.get(key) : null,
  setItem: (key, value) => storageValues.set(key, String(value)),
  removeItem: (key) => storageValues.delete(key)
};
const workspace = createWorkspaceFileSystem({
  baseFiles: [...baseline.keys()],
  storage: workspaceStorage,
  readBaseline: async (path) => baseline.get(path)
});

const opened = [];
const output = [];
let cleared = 0;
let cwd = "";
const processor = createTerminalCommandProcessor({
  workspace,
  openFile: async (fileName) => {
    opened.push(fileName);
    return true;
  },
  now: () => new Date("2026-08-20T06:00:00Z")
});
const context = {
  write: (text) => output.push(String(text)),
  clear: () => { cleared += 1; },
  history: ["pwd", "history"],
  getCwd: () => cwd,
  setCwd: (nextCwd) => { cwd = nextCwd; },
  sessions: () => [
    { name: "browser 1", cwd, active: true },
    { name: "split 2", cwd: "docs", active: false }
  ]
};

assert.equal(await processor.execute("pwd", context), true);
assert.equal(output.at(-1), "/workspaces/CREED");
await processor.execute("ls src", context);
assert.ok(output.at(-1).includes("main.js"));

await processor.execute("cd src", context);
assert.equal(cwd, "src");
await processor.execute("pwd", context);
assert.equal(output.at(-1), "/workspaces/CREED/src");

await processor.execute("cat main.js", context);
assert.equal(output.at(-1), "console.log('main');");
await processor.execute("open main.js", context);
assert.deepEqual(opened, ["src/main.js"]);

await processor.execute("mkdir nested", context);
assert.equal(workspace.hasDirectory("src/nested"), true);
await processor.execute("touch nested/test.js", context);
assert.equal(workspace.hasFile("src/nested/test.js"), true);
assert.ok(searchWorkspaceFiles("test.js", workspace).includes("src/nested/test.js"));

await processor.execute("cp main.js copy.js", context);
assert.equal(await workspace.readFile("src/copy.js"), "console.log('main');");
await processor.execute("mv copy.js moved.js", context);
assert.equal(workspace.hasFile("src/copy.js"), false);
assert.equal(workspace.hasFile("src/moved.js"), true);

await processor.execute("cp nested ../nested-copy", context);
assert.equal(workspace.hasFile("nested-copy/test.js"), true);
await processor.execute("rm moved.js", context);
assert.equal(workspace.hasFile("src/moved.js"), false);
await processor.execute("rmdir nested", context);
assert.equal(workspace.hasDirectory("src/nested"), false);

assert.equal(completeTerminalInput("mk", { workspace, cwd }).value, "mkdir ");
assert.equal(completeTerminalInput("cat ma", { workspace, cwd }).value, "cat main.js");

await processor.execute("history", context);
assert.ok(output.at(-1).includes("1  pwd"));
await processor.execute("sessions", context);
assert.ok(output.at(-1).includes("* browser 1"));
assert.ok(output.at(-1).includes("/workspaces/CREED/src"));
await processor.execute("date", context);
assert.ok(output.at(-1).includes("2026"));
await processor.execute("clear", context);
assert.equal(cleared, 1);

await assert.rejects(
  processor.execute("open no/such/file.js", context),
  /Workspace file not found/
);
await assert.rejects(
  processor.execute("rm ../nested-copy", { ...context, getCwd: () => "src" }),
  /is a directory/
);

const terminalValues = new Map();
const terminalStorage = {
  getItem: (key) => terminalValues.has(key) ? terminalValues.get(key) : null,
  setItem: (key, value) => terminalValues.set(key, String(value))
};
assert.equal(saveTerminalState(terminalStorage, {
  activeId: "terminal-2",
  nextSessionId: 3,
  sessions: [
    { id: "terminal-1", name: "browser 1", cwd: "", history: ["pwd"] },
    { id: "terminal-2", name: "split 2", cwd: "src", history: ["cd src", "ls"] }
  ]
}), true);
const restored = loadTerminalState(terminalStorage);
assert.equal(restored.activeId, "terminal-2");
assert.equal(restored.sessions[1].cwd, "src");
assert.deepEqual(restored.sessions[1].history, ["cd src", "ls"]);

console.log("Writable browser terminal checks passed.");
