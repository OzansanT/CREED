import test from "node:test";
import assert from "node:assert/strict";
import { createWorkspaceStore, normalizePath } from "../workspace-store.js";

const seed = {
  "index.html": "<h1>CREED</h1>",
  "src/main.js": "export const value = 'needle';",
  "README.md": "# Project\nneedle"
};

function store() {
  return createWorkspaceStore({ fileNames: Object.keys(seed), loadSource: async (file) => seed[file] });
}

test("workspace validates paths and provides a hierarchical inventory", async () => {
  assert.throws(() => normalizePath("../escape"));
  const workspace = store();
  assert.deepEqual(workspace.listDirectories(), ["src"]);
  assert.equal(await workspace.readFile("src/main.js"), seed["src/main.js"]);
  workspace.createFolder("assets/icons");
  workspace.createFile("assets/icons/icon.txt", "icon");
  assert.equal(workspace.getFile("assets/icons/icon.txt").status, "added");
  await workspace.renamePath("assets/icons/icon.txt", "assets/icon.txt");
  assert.equal(workspace.getFile("assets/icon.txt").content, "icon");
});

test("search, replace, stage, commit, delete and discard are consistent", async () => {
  const workspace = store();
  const matches = await workspace.search("needle");
  assert.equal(matches.length, 2);
  const replaced = await workspace.replaceAll("needle", "updated");
  assert.deepEqual(replaced, { replacements: 2, files: 2 });
  assert.equal(workspace.listChanges().length, 2);
  workspace.stageAll(true);
  const commit = workspace.commit("Replace needle");
  assert.equal(commit.files.length, 2);
  assert.equal(workspace.listChanges().length, 0);
  await workspace.removePath("README.md");
  assert.equal(workspace.listChanges()[0].status, "deleted");
  workspace.discard("README.md");
  assert.equal(await workspace.readFile("README.md"), "# Project\nupdated");
});

test("snapshots preserve clean local commits and committed deletions", async () => {
  const workspace = store();
  await workspace.readFile("src/main.js");
  workspace.writeFile("src/main.js", "export const value = 'local';");
  workspace.setStaged("src/main.js", true);
  workspace.commit("Local main");
  await workspace.removePath("README.md");
  workspace.setStaged("README.md", true);
  workspace.commit("Remove readme");
  const snapshot = workspace.createSnapshot();
  const restored = store();
  restored.restoreSnapshot(snapshot);
  assert.equal(await restored.readFile("src/main.js"), "export const value = 'local';");
  assert.equal(restored.getFile("README.md").deleted, true);
  assert.equal(restored.listChanges().length, 0);
  assert.equal(restored.getCommits().length, 2);
});
