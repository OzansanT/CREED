import assert from "node:assert/strict";
import {
  createTerminalCommandProcessor,
  searchWorkspaceFiles,
  tokenizeTerminalCommand
} from "../js/components/bottom-panel/terminal-session.js";

assert.deepEqual(tokenizeTerminalCommand('open "ui/main-frame.html"'), ["open", "ui/main-frame.html"]);
assert.deepEqual(tokenizeTerminalCommand("echo 'hello world'"), ["echo", "hello world"]);
assert.deepEqual(tokenizeTerminalCommand("echo hello\\\"world"), ["echo", 'hello"world']);

const barMatches = searchWorkspaceFiles("bar-registry");
assert.ok(barMatches.includes("ui/bars/bar-registry.json"));
assert.ok(searchWorkspaceFiles("definitely-not-a-real-file").length === 0);

const opened = [];
const output = [];
let cleared = 0;
const processor = createTerminalCommandProcessor({
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
  sessions: () => [
    { name: "browser 1", active: true },
    { name: "split 2", active: false }
  ]
};

assert.equal(await processor.execute("pwd", context), true);
assert.equal(output.at(-1), "/workspaces/CREED");

await processor.execute("ls js/core", context);
assert.ok(output.at(-1).includes("state.js"));

await processor.execute("files command-engine", context);
assert.ok(output.at(-1).includes("js/core/command-engine.js"));

await processor.execute("open js/core/state.js", context);
assert.deepEqual(opened, ["js/core/state.js"]);
assert.equal(output.at(-1), "Opened js/core/state.js");

await processor.execute("history", context);
assert.ok(output.at(-1).includes("1  pwd"));

await processor.execute("sessions", context);
assert.ok(output.at(-1).includes("* browser 1"));

await processor.execute("date", context);
assert.ok(output.at(-1).includes("2026"));

await processor.execute("clear", context);
assert.equal(cleared, 1);

await assert.rejects(
  processor.execute("open no/such/file.js", context),
  /Workspace file not found/
);
await assert.rejects(
  processor.execute("rm something", context),
  /command not found/
);

console.log("Browser terminal checks passed.");
