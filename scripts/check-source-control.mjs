import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createLineDiff, createSideBySideDiff, summarizeDiff } from "../js/components/source-control/diff-engine.js";
import { createGitProvider } from "../js/components/source-control/git-provider.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");

class TestWorkspace {
  constructor(entries) {
    this.base = new Map(entries);
    this.overlays = new Map();
    this.deleted = new Set();
    this.listeners = new Set();
  }
  listFiles() {
    return [...new Set([...this.base.keys(), ...this.overlays.keys()])]
      .filter((path) => !this.deleted.has(path))
      .sort();
  }
  listDirectories() { return []; }
  hasFile(path) { return !this.deleted.has(path) && (this.overlays.has(path) || this.base.has(path)); }
  async readFile(path) {
    if (!this.hasFile(path)) throw new Error("missing " + path);
    return this.overlays.has(path) ? this.overlays.get(path) : this.base.get(path);
  }
  writeFile(path, content) {
    this.deleted.delete(path);
    this.overlays.set(path, String(content));
    this.emit({ type: "file-written", path });
    return path;
  }
  deleteFile(path) {
    this.overlays.delete(path);
    if (this.base.has(path)) this.deleted.add(path);
    this.emit({ type: "file-deleted", path });
    return true;
  }
  clearChanges() {
    this.overlays.clear();
    this.deleted.clear();
    this.emit({ type: "workspace-reset" });
  }
  getChanges() {
    const changes = [];
    for (const path of this.deleted) if (this.base.has(path)) changes.push({ path, status: "deleted" });
    for (const [path, content] of this.overlays) {
      changes.push({ path, status: this.base.has(path) ? "modified" : "created", content });
    }
    return changes;
  }
  subscribe(listener) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  emit(change) { this.listeners.forEach((listener) => listener(change)); }
}

const lineDiff = createLineDiff("one\ntwo\nthree", "one\nTWO\nthree\nfour");
assert(lineDiff.some((row) => row.type === "delete" && row.text === "two"));
assert(lineDiff.some((row) => row.type === "insert" && row.text === "TWO"));
assert.equal(summarizeDiff("a", "a\nb").additions, 1);
assert(createSideBySideDiff("a\nb", "a\nc").some((row) => row.left?.type === "delete" && row.right?.type === "insert"));

const baseline = new Map([
  ["README.md", "base readme"],
  ["app.js", "base app"]
]);
const workspace = new TestWorkspace(baseline);
const values = new Map();
const storage = {
  getItem: (key) => values.has(key) ? values.get(key) : null,
  setItem: (key, value) => values.set(key, String(value)),
  removeItem: (key) => values.delete(key)
};
let tick = 1;
const provider = createGitProvider({
  workspace,
  baseFiles: [...baseline.keys()],
  readBaseline: async (path) => baseline.get(path),
  storage,
  now: () => tick++,
  random: () => 0.1
});

workspace.writeFile("README.md", "main readme");
assert.equal((await provider.getWorkingChanges())[0].status, "modified");
await provider.stage("README.md");
assert.equal(provider.getStaged().length, 1);
const firstCommit = await provider.commit("Update README");
assert.equal(firstCommit.branch, "main");
assert.equal((await provider.getWorkingChanges()).length, 0);

provider.createBranch("feature");
await provider.switchBranch("feature");
workspace.writeFile("app.js", "feature app");
await provider.stage("app.js");
await provider.commit("Feature app");

await provider.switchBranch("main");
assert.equal(await workspace.readFile("app.js"), "base app");
workspace.writeFile("app.js", "main app");
await provider.stage("app.js");
await provider.commit("Main app");

const merge = await provider.mergeBranch("feature");
assert.equal(merge.conflicts.length, 1);
assert.equal(merge.conflicts[0].path, "app.js");
await provider.resolveConflict("app.js", merge.conflicts[0].incoming);
assert.equal(provider.getStaged()[0].path, "app.js");
await provider.commit("Resolve feature merge");
assert.equal((await provider.getWorkingChanges()).length, 0);
assert.equal(provider.getCommitGraph().length, 4);
assert.equal(provider.getBranches().length, 2);

const restored = createGitProvider({
  workspace,
  baseFiles: [...baseline.keys()],
  readBaseline: async (path) => baseline.get(path),
  storage,
  now: () => 99,
  random: () => 0.2
});
assert.equal(restored.getCommitGraph().length, 4);
assert.equal(restored.getCurrentBranch(), "main");

const ui = read("js/components/source-control/source-control-main.js");
for (const token of [
  "sourceControlView", "stagedChangesList", "workingChangesList", "sourceControlDiff",
  "sourceControlBranchSelect", "commitChangesBtn", "mergeBranchBtn", "commitGraph"
]) {
  assert(ui.includes(token), "Source Control UI missing " + token);
}
assert(ui.includes("renderInlineDiff") && ui.includes("renderSideBySide"), "Source Control must expose both diff layouts.");
const conflicts = read("js/components/source-control/merge-conflict-editor.js");
assert(conflicts.includes("Accept Current") && conflicts.includes("Accept Incoming") && conflicts.includes("Resolve Edited"));

console.log("Source Control checks passed.");
