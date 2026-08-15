import test from "node:test";
import assert from "node:assert/strict";
import { createCreedDocument } from "../creed-document.js";
import { createDurablePersistence } from "../durable-persistence.js";
import { createIndexedDatabase } from "../indexed-db.js";
import { createWorkspaceStore } from "../workspace-store.js";

function settingsStub() {
  return {
    value: { theme: "light", locale: "en", reduceMotion: false, editorFontSize: 12, layoutPreset: "full", workspaceTrusted: false },
    get() { return { ...this.value }; },
    replace(next) { this.value = { ...next }; },
    subscribe() { return () => {}; }
  };
}

test("IndexedDB adapter supports key/value and prefix operations", async () => {
  const database = createIndexedDatabase();
  await database.clear();
  await database.set("one.a", { value: 1 });
  await database.set("two.b", { value: 2 });
  assert.deepEqual(await database.get("one.a"), { value: 1 });
  assert.deepEqual(await database.entries("one."), [["one.a", { value: 1 }]]);
  await database.delete("one.a");
  assert.equal(await database.get("one.a"), undefined);
  await database.clear();
});

test("durable persistence saves current state and restores recovery points", async () => {
  const database = createIndexedDatabase();
  await database.clear();
  const workspace = createWorkspaceStore({ fileNames: ["main.js"], loadSource: async () => "export default 1;" });
  let document = createCreedDocument({ title: "Initial" });
  let editorSession = { format: "creed-editor-session", version: 1, active: { type: "canvas" }, tabs: [], recentlyClosed: [] };
  let panels = { primaryWidth: 293, secondaryWidth: 290, terminalHeight: 320, primaryVisible: true, secondaryVisible: true, terminalVisible: true };
  const settings = settingsStub();
  const durable = createDurablePersistence({
    database,
    workspaceStore: workspace,
    getDocument: () => document,
    restoreDocument: (next) => { document = next; },
    getEditorSession: () => editorSession,
    restoreEditorSession: async (next) => { editorSession = next; },
    settingsStore: settings,
    getPanelLayout: () => panels,
    restorePanelLayout: (next) => { panels = next; }
  });
  const started = await durable.start();
  assert.equal(started.persistent, false);
  document.title = "Saved";
  document.updatedAt = new Date(Date.now() + 1000).toISOString();
  workspace.createFile("local.txt", "durable");
  await durable.flush();
  const recovery = await durable.createRecovery("test");
  document.title = "Lost";
  workspace.resetToSource();
  await durable.restoreRecovery(recovery);
  assert.equal(document.title, "Saved");
  assert.equal(workspace.getFile("local.txt").content, "durable");
  assert.ok((await durable.listRecoveries()).some((item) => item.id === recovery.id));
  await durable.clearAll();
});
