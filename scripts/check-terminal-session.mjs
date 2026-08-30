import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  completeTerminalInput,
  createTerminalCommandProcessor,
  createTerminalOutputLine,
  findTerminalSourceReferences,
  formatTerminalPath,
  loadTerminalState,
  navigateTerminalSourceReference,
  parseTerminalOpenTarget,
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
assert.deepEqual(parseTerminalOpenTarget("src/main.js"), { path: "src/main.js", line: null, column: null });
assert.deepEqual(parseTerminalOpenTarget("src/main.js:12"), { path: "src/main.js", line: 12, column: 1 });
assert.deepEqual(parseTerminalOpenTarget("src/main.js:12:7"), { path: "src/main.js", line: 12, column: 7 });
assert.deepEqual(parseTerminalOpenTarget("src/main.js:0:0"), { path: "src/main.js", line: 1, column: 1 });

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

const references = findTerminalSourceReferences(
  "Error at src/main.js:2:4, util.js:3, workspace/src/util.js:5:6 and /workspaces/CREED/README.md:7:8; https://example.com:12",
  { workspace, cwd: "src" }
);
assert.deepEqual(
  references.map(({ text, fileName, line, column }) => ({ text, fileName, line, column })),
  [
    { text: "src/main.js:2:4", fileName: "src/main.js", line: 2, column: 4 },
    { text: "util.js:3", fileName: "src/util.js", line: 3, column: 1 },
    { text: "workspace/src/util.js:5:6", fileName: "src/util.js", line: 5, column: 6 },
    { text: "/workspaces/CREED/README.md:7:8", fileName: "README.md", line: 7, column: 8 }
  ],
  "Terminal output must identify only real workspace source locations while preserving displayed reference text."
);
assert.deepEqual(
  findTerminalSourceReferences("missing.js:9:2 and src/main.js", { workspace, cwd: "src" }),
  [],
  "Missing files and file paths without coordinates must remain plain terminal text."
);

const historicalLine = createTerminalOutputLine("util.js:3", "output", "/workspaces/CREED/src");
assert.deepEqual(
  historicalLine,
  { text: "util.js:3", kind: "output", cwd: "src" },
  "Terminal output rows must snapshot a normalized working directory."
);
assert.equal(
  findTerminalSourceReferences(historicalLine.text, { workspace, cwd: historicalLine.cwd })[0]?.fileName,
  "src/util.js",
  "A historical relative source reference must resolve against the cwd captured when the row was written."
);
assert.deepEqual(
  findTerminalSourceReferences(historicalLine.text, { workspace, cwd: "docs" }),
  [],
  "Changing the terminal cwd later must not be used to reinterpret historical relative references."
);

const referenceNavigationCalls = [];
assert.equal(
  await navigateTerminalSourceReference(references[0], {
    openFileAt: async (...args) => { referenceNavigationCalls.push(args); return true; }
  }),
  true
);
assert.deepEqual(referenceNavigationCalls, [["src/main.js", 2, 4]], "Clickable terminal references must use exact editor navigation.");
const referenceFallbackCalls = [];
assert.equal(
  await navigateTerminalSourceReference(references[1], {
    openFile: async (fileName) => { referenceFallbackCalls.push(fileName); return true; }
  }),
  true
);
assert.deepEqual(referenceFallbackCalls, ["src/util.js"], "Clickable source references must retain plain-file fallback navigation.");
assert.equal(await navigateTerminalSourceReference(null, { openFileAt: () => true }), false);

const terminalSource = readFileSync(new URL("../js/components/bottom-panel/terminal-session.js", import.meta.url), "utf8");
assert(terminalSource.includes('link.className = "terminal-view__source-link"'), "Terminal source references must render as dedicated interactive controls.");
assert(terminalSource.includes("findTerminalSourceReferences(text, { workspace: fs, cwd })"), "Terminal output rendering must pass through workspace-aware source-reference detection.");
assert(terminalSource.includes("navigateTerminalSourceReference(reference, { openFile, openFileAt })"), "Terminal source links must use the shared exact-location navigation path.");
assert(terminalSource.includes('line.cwd ?? session?.cwd ?? ""'), "Terminal rendering must prefer each row's captured cwd over the session's current cwd.");
assert(terminalSource.includes("createTerminalOutputLine(line, kind, outputCwd)"), "Terminal writes must snapshot cwd on every output row.");
assert(terminalSource.includes("MAX_PERSISTED_OUTPUT_LINES = 200"), "Persisted terminal output must remain bounded.");
assert(terminalSource.includes("MAX_PERSISTED_LINE_LENGTH = 4096"), "Persisted terminal line size must remain bounded.");
assert(terminalSource.includes("lines: session.lines"), "Terminal session persistence must include the bounded output buffer.");

const opened = [];
const exactOpened = [];
const output = [];
let cleared = 0;
let cwd = "";
const processor = createTerminalCommandProcessor({
  workspace,
  openFile: async (fileName) => {
    opened.push(fileName);
    return true;
  },
  openFileAt: async (...args) => {
    exactOpened.push(args);
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
assert.deepEqual(exactOpened, []);
await processor.execute("open main.js:1:9", context);
assert.deepEqual(exactOpened, [["src/main.js", 1, 9]], "Explicit terminal source locations must use exact editor navigation.");
assert.equal(output.at(-1), "Opened src/main.js:1:9");
await processor.execute("open util.js:1", context);
assert.deepEqual(exactOpened[1], ["src/util.js", 1, 1], "Line-only terminal locations must default to column 1.");

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

const fallbackOpened = [];
const fallbackProcessor = createTerminalCommandProcessor({
  workspace,
  openFile: async (fileName) => {
    fallbackOpened.push(fileName);
    return true;
  }
});
await fallbackProcessor.execute("open util.js:2:3", context);
assert.deepEqual(fallbackOpened, ["src/util.js"], "Terminal exact-location syntax must gracefully fall back to plain file opening when no exact navigator is supplied.");

const terminalValues = new Map();
const terminalStorage = {
  getItem: (key) => terminalValues.has(key) ? terminalValues.get(key) : null,
  setItem: (key, value) => terminalValues.set(key, String(value))
};
assert.equal(saveTerminalState(terminalStorage, {
  activeId: "terminal-2",
  nextSessionId: 3,
  sessions: [
    {
      id: "terminal-1",
      name: "browser 1",
      cwd: "",
      history: ["pwd"],
      lines: [createTerminalOutputLine("README.md:4:2", "output", "")]
    },
    {
      id: "terminal-2",
      name: "split 2",
      cwd: "src",
      history: ["cd src", "ls"],
      lines: [createTerminalOutputLine("util.js:3", "error", "src")]
    }
  ]
}), true);
const restored = loadTerminalState(terminalStorage);
assert.equal(restored.activeId, "terminal-2");
assert.equal(restored.sessions[1].cwd, "src");
assert.deepEqual(restored.sessions[1].history, ["cd src", "ls"]);
assert.deepEqual(
  restored.sessions[1].lines,
  [{ text: "util.js:3", kind: "error", cwd: "src" }],
  "Persisted terminal output must retain text, kind, and the source-reference cwd snapshot."
);

const oversizedLines = Array.from({ length: 205 }, (_, index) => ({
  text: index === 204 ? "x".repeat(5000) : `line-${index}`,
  kind: "output",
  cwd: "src"
}));
assert.equal(saveTerminalState(terminalStorage, {
  activeId: "terminal-1",
  sessions: [{ id: "terminal-1", name: "browser 1", cwd: "src", history: [], lines: oversizedLines }]
}), true);
const boundedRestore = loadTerminalState(terminalStorage);
assert.equal(boundedRestore.sessions[0].lines.length, 200, "Only the newest 200 terminal rows may be persisted.");
assert.equal(boundedRestore.sessions[0].lines[0].text, "line-5", "Persistence must retain the newest terminal rows when trimming.");
assert.equal(boundedRestore.sessions[0].lines.at(-1).text.length, 4096, "Persisted terminal rows must cap individual text size.");
assert.equal(boundedRestore.sessions[0].lines.at(-1).cwd, "src");

console.log("Writable browser terminal checks passed.");
