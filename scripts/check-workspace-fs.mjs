import assert from "node:assert/strict";
import { WORKSPACE_FS_STORAGE_KEY } from "../js/core/config.js";
import { createWorkspaceFileSystem, normalizeWorkspacePath, WORKSPACE_FS_SCHEMA_VERSION } from "../js/components/editor-panel/workspace-fs.js";

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

const migrationValues = new Map([[WORKSPACE_FS_STORAGE_KEY, JSON.stringify({
  version: 1,
  overlays: {
    "README.md": "keep this unrelated edit",
    "js/main.js": "import { bindSourceControl } from './components/source-control/source-control-main.js';",
    "js/components/source-control/source-control-main.js": "export const stale = true;",
    "notes/custom.js": "export const keep = true;"
  },
  deleted: ["js/core/elements.js"],
  directories: ["js/components/source-control", "notes"]
})]]);
const migrationStorage = {
  getItem: (key) => migrationValues.has(key) ? migrationValues.get(key) : null,
  setItem: (key, value) => migrationValues.set(key, String(value)),
  removeItem: (key) => migrationValues.delete(key)
};
const migrationBaseline = new Map([
  ["README.md", "fresh readme"],
  ["js/main.js", "console.log('fresh app');"],
  ["js/core/elements.js", "export const fresh = true;"]
]);
const migrated = createWorkspaceFileSystem({
  baseFiles: [...migrationBaseline.keys()],
  storage: migrationStorage,
  readBaseline: async (path) => migrationBaseline.get(path)
});
assert.equal(await migrated.readFile("js/main.js"), "console.log('fresh app');", "Legacy Source Control-era overlays on migrated application files must reset to the current baseline.");
assert.equal(await migrated.readFile("js/core/elements.js"), "export const fresh = true;", "Legacy deleted markers on migrated application files must be cleared.");
assert.equal(migrated.hasFile("js/components/source-control/source-control-main.js"), false, "Retired Source Control files must not survive legacy WorkspaceFS overlays.");
assert.equal(migrated.hasDirectory("js/components/source-control"), false, "Retired Source Control directories must not survive legacy WorkspaceFS state.");
assert.equal(await migrated.readFile("README.md"), "keep this unrelated edit", "Unrelated persisted edits must survive the one-time WorkspaceFS migration.");
assert.equal(await migrated.readFile("notes/custom.js"), "export const keep = true;", "User-created files outside the retired feature must survive migration.");
assert.equal(JSON.parse(migrationValues.get(WORKSPACE_FS_STORAGE_KEY)).version, WORKSPACE_FS_SCHEMA_VERSION, "Legacy WorkspaceFS state must persist the upgraded schema immediately.");

console.log("Workspace file-system check passed.");