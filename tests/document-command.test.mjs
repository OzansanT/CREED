import test from "node:test";
import assert from "node:assert/strict";
import { createCommand, createCommandEngine } from "../command-engine.js";
import { DOCUMENT_SCHEMA_VERSION, createCreedDocument, normalizeCreedDocument, serializeCreedDocument } from "../creed-document.js";
import { listComponentTypes } from "../component-registry.js";
import { resolveToken } from "../design-tokens.js";
import { createRenderScheduler } from "../render-scheduler.js";

test("legacy canvas state migrates into the current document schema", () => {
  const migrated = normalizeCreedDocument({
    x: 120,
    y: -80,
    zoom: 1.4,
    sidebarView: "layers",
    originCard: { worldX: 10, worldY: 20 },
    jsonCard: { visible: true, worldX: 90, worldY: 100 },
    anchor: { name: "Legacy", worldX: 50, worldY: 60, zoom: 1.2 }
  });
  assert.equal(migrated.schemaVersion, DOCUMENT_SCHEMA_VERSION);
  assert.deepEqual(migrated.viewport, { x: 120, y: -80, zoom: 1.4 });
  assert.equal(migrated.ui.sidebarView, "layers");
  assert.equal(migrated.components.find((component) => component.id === "json-1").visible, true);
  assert.equal(migrated.savedViews[0].name, "Legacy");
  assert.deepEqual(serializeCreedDocument(migrated), normalizeCreedDocument(migrated));
});

test("document defaults and design tokens are complete", () => {
  const document = createCreedDocument();
  assert.equal(document.schemaVersion, DOCUMENT_SCHEMA_VERSION);
  assert.ok(listComponentTypes().length >= 11);
  assert.equal(resolveToken("$colors.accent", document.designTokens), document.designTokens.colors.accent);
  assert.equal(resolveToken("plain", document.designTokens), "plain");
});

test("command engine executes, undoes, redoes and enforces its limit", () => {
  let value = 0;
  let updates = 0;
  let persists = 0;
  const engine = createCommandEngine({ update: () => { updates += 1; }, persist: () => { persists += 1; }, limit: 2 });
  const change = (next) => {
    const before = value;
    return createCommand({ label: `Set ${next}`, redo: () => { value = next; }, undo: () => { value = before; } });
  };
  engine.execute(change(1));
  engine.execute(change(2));
  engine.execute(change(3));
  assert.equal(value, 3);
  assert.equal(engine.undo(), true);
  assert.equal(value, 2);
  assert.equal(engine.undo(), true);
  assert.equal(value, 1);
  assert.equal(engine.undo(), false);
  assert.equal(engine.redo(), true);
  assert.equal(value, 2);
  assert.equal(updates, persists);
});

test("render scheduler coalesces frames and supports flush/cancel", () => {
  let renders = 0;
  let callback = null;
  let cancelled = 0;
  const scheduler = createRenderScheduler(
    () => { renders += 1; },
    (next) => { callback = next; return 7; },
    () => { cancelled += 1; }
  );
  scheduler.schedule();
  scheduler.schedule();
  assert.equal(scheduler.pending(), true);
  callback();
  assert.equal(renders, 1);
  scheduler.schedule();
  scheduler.flush();
  assert.equal(renders, 2);
  assert.equal(cancelled, 1);
  scheduler.schedule();
  scheduler.cancel();
  assert.equal(scheduler.pending(), false);
});
