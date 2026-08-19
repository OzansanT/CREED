import assert from "node:assert/strict";

const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.has(key) ? storage.get(key) : null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key)
};

const {
  EDITOR_WORKSPACE_SCHEMA_VERSION,
  normalizeEditorWorkspaceState,
  migrateEditorWorkspaceState,
  saveEditorWorkspace,
  loadEditorWorkspace,
  clearEditorWorkspace
} = await import("../js/components/editor-panel/editor-workspace-storage.js");

const normalized = normalizeEditorWorkspaceState({
  openFiles: ["README.md", "missing-file.js", "index.html", "README.md"],
  activeFile: "missing-file.js",
  sessions: {
    "README.md": {
      viewport: { scrollTop: 125.5, scrollLeft: 40 },
      navigation: {
        query: "CREED",
        activeIndex: 2,
        options: { matchCase: true, wholeWord: false, useRegex: false },
        findOpen: true,
        lastGoTo: { line: 18, column: 7 }
      }
    }
  }
});

assert.equal(normalized.version, EDITOR_WORKSPACE_SCHEMA_VERSION);
assert.deepEqual(normalized.openFiles, ["README.md", "index.html"]);
assert.equal(normalized.activeFile, "");
assert.equal(normalized.sessions["README.md"].viewport.scrollTop, 125.5);
assert.equal(normalized.sessions["README.md"].navigation.query, "CREED");
assert.deepEqual(normalized.sessions["README.md"].navigation.lastGoTo, { line: 18, column: 7 });
assert.equal(Object.hasOwn(normalized.sessions, "missing-file.js"), false);

const migrated = migrateEditorWorkspaceState({
  openFiles: ["README.md"],
  activeFile: "README.md",
  sessions: {}
});
assert.equal(migrated.version, EDITOR_WORKSPACE_SCHEMA_VERSION);
assert.equal(migrated.activeFile, "README.md");
assert.equal(migrateEditorWorkspaceState({ version: 99, openFiles: ["README.md"] }), null);

assert.equal(saveEditorWorkspace({
  openFiles: ["README.md", "index.html"],
  activeFile: "index.html",
  sessions: normalized.sessions
}), true);
const loaded = loadEditorWorkspace();
assert.deepEqual(loaded.openFiles, ["README.md", "index.html"]);
assert.equal(loaded.activeFile, "index.html");
assert.equal(clearEditorWorkspace(), true);
assert.equal(loadEditorWorkspace(), null);

delete globalThis.localStorage;
console.log("Editor workspace persistence check passed.");
