import assert from "node:assert/strict";
import { createWorkspaceFileSystem, normalizeWorkspacePath } from "../js/components/editor-panel/workspace-fs.js";

const storageValues = new Map();
const storage = {
  getItem: (key) => storageValues.has(key) ? storageValues.get(key) : null,
  setItem: (key, value) => storageValues.set(key, String(value)),
  removeItem: (key) => storageValues.delete(key)
};
const baseline = new Map([
  ["README.md", "baseline"],
  ["src/main.js", "console.log('base');"]
]);
const readBaseline = async (path) => baseline.get(path);

const workspace = createWorkspaceFileSystem({ baseFiles: [...baseline.keys()], storage, readBaseline });
assert.deepEqual(workspace.listFiles(), ["README.md", "src/main.js"]);
assert.equal(await workspace.readFile("README.md"), "baseline");
workspace.writeFile("README.md", "changed");
assert.equal(await workspace.readFile("README.md"), "changed");
assert.equal(workspace.getChanges().find((change) => change.path === "README.md")?.status, "modified");

workspace.createDirectory("docs/guides");
workspace.createFile("docs/guides/start.md", "start");
assert.equal(workspace.hasDirectory("docs/guides"), true);
assert.equal(await workspace.readFile("docs/guides/start.md"), "start");
await workspace.rename("docs/guides/start.md", "docs/guides/intro.md");
assert.equal(workspace.hasFile("docs/guides/start.md"), false);
assert.equal(workspace.hasFile("docs/guides/intro.md"), true);
await workspace.duplicateFile("docs/guides/intro.md", "docs/guides/copy.md");
assert.equal(await workspace.readFile("docs/guides/copy.md"), "start");
workspace.deleteFile("docs/guides/copy.md");
assert.equal(workspace.hasFile("docs/guides/copy.md"), false);
assert.equal(workspace.canUndoDelete(), true);
assert.equal(workspace.undoLastDelete()?.path, "docs/guides/copy.md");
assert.equal(await workspace.readFile("docs/guides/copy.md"), "start");

workspace.deleteDirectory("docs/guides");
assert.equal(workspace.hasDirectory("docs/guides"), false);
assert.equal(workspace.hasFile("docs/guides/intro.md"), false);
const restoredDirectory = workspace.undoLastDelete();
assert.equal(restoredDirectory?.kind, "directory");
assert.equal(workspace.hasDirectory("docs/guides"), true);
assert.equal(await workspace.readFile("docs/guides/intro.md"), "start");

let rejectedTraversal = false;
try { normalizeWorkspacePath("../escape.js"); } catch { rejectedTraversal = true; }
assert.equal(rejectedTraversal, true);
let rejectedDuplicate = false;
try { workspace.createFile("README.md", "duplicate"); } catch { rejectedDuplicate = true; }
assert.equal(rejectedDuplicate, true);

const restored = createWorkspaceFileSystem({ baseFiles: [...baseline.keys()], storage, readBaseline });
assert.equal(await restored.readFile("README.md"), "changed");
assert.equal(restored.hasFile("docs/guides/intro.md"), true);

console.log("Workspace file-system check passed.");
