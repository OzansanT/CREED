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

const runDebugMigrationValues = new Map([[WORKSPACE_FS_STORAGE_KEY, JSON.stringify({
  version: 2,
  overlays: {
    "js/main.js": "import { bindRunDebug } from './components/run-debug/run-debug-main.js';",
    "js/components/run-debug/run-debug-main.js": "export const stale = true;",
    "notes/keep.js": "export const keep = true;"
  },
  deleted: ["ui/bars/activity-bar/activity-bar.html"],
  directories: ["js/components/run-debug", "notes"]
})]]);
const runDebugMigrationStorage = {
  getItem: (key) => runDebugMigrationValues.has(key) ? runDebugMigrationValues.get(key) : null,
  setItem: (key, value) => runDebugMigrationValues.set(key, String(value)),
  removeItem: (key) => runDebugMigrationValues.delete(key)
};
const runDebugMigrationBaseline = new Map([
  ["js/main.js", "console.log('run-debug removed');"],
  ["ui/bars/activity-bar/activity-bar.html", "<nav>fresh activity bar</nav>"]
]);
const runDebugMigrated = createWorkspaceFileSystem({
  baseFiles: [...runDebugMigrationBaseline.keys()],
  storage: runDebugMigrationStorage,
  readBaseline: async (path) => runDebugMigrationBaseline.get(path)
});
assert.equal(await runDebugMigrated.readFile("js/main.js"), "console.log('run-debug removed');", "Run and Debug-era application overlays must reset to the current baseline.");
assert.equal(await runDebugMigrated.readFile("ui/bars/activity-bar/activity-bar.html"), "<nav>fresh activity bar</nav>", "Run and Debug-era deleted markers on the Activity Bar must be cleared.");
assert.equal(runDebugMigrated.hasFile("js/components/run-debug/run-debug-main.js"), false, "Retired Run and Debug files must not survive WorkspaceFS overlays.");
assert.equal(runDebugMigrated.hasDirectory("js/components/run-debug"), false, "Retired Run and Debug directories must not survive WorkspaceFS state.");
assert.equal(await runDebugMigrated.readFile("notes/keep.js"), "export const keep = true;", "Unrelated user-created files must survive the Run and Debug migration.");
assert.equal(JSON.parse(runDebugMigrationValues.get(WORKSPACE_FS_STORAGE_KEY)).version, WORKSPACE_FS_SCHEMA_VERSION, "Run and Debug WorkspaceFS state must persist the upgraded schema immediately.");

console.log("Workspace file-system check passed.");
