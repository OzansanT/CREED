import assert from "node:assert/strict";
import { createCommand, createCommandEngine } from "../js/core/command-engine.js";

let value = 0;
let updates = 0;
let persists = 0;
const snapshots = [];

const engine = createCommandEngine({
  update: () => { updates += 1; },
  persist: () => { persists += 1; },
  limit: 2
});

const unsubscribe = engine.subscribe((snapshot) => snapshots.push(snapshot));

engine.execute(createCommand({
  label: "Increment",
  redo: () => { value += 1; },
  undo: () => { value -= 1; }
}));
assert.equal(value, 1);
assert.equal(engine.getState().canUndo, true);
assert.equal(engine.getState().undoLabel, "Increment");

assert.equal(engine.undo(), true);
assert.equal(value, 0);
assert.equal(engine.getState().canRedo, true);
assert.equal(engine.getState().redoLabel, "Increment");

assert.equal(engine.redo(), true);
assert.equal(value, 1);

const beforeRecorded = value;
value = 5;
engine.record(createCommand({
  label: "Set value",
  redo: () => { value = 5; },
  undo: () => { value = beforeRecorded; }
}));
assert.equal(engine.undo(), true);
assert.equal(value, 1);
assert.equal(engine.redo(), true);
assert.equal(value, 5);

engine.execute(createCommand({
  label: "Set six",
  redo: () => { value = 6; },
  undo: () => { value = 5; }
}));
engine.execute(createCommand({
  label: "Set seven",
  redo: () => { value = 7; },
  undo: () => { value = 6; }
}));
assert.equal(engine.undo(), true);
assert.equal(value, 6);
assert.equal(engine.undo(), true);
assert.equal(value, 5);
assert.equal(engine.undo(), false, "history limit must discard commands older than the configured bound");

const stateBeforeNoop = engine.getState();
assert.equal(engine.record(createCommand({
  label: "No-op",
  redo: () => {},
  undo: () => {},
  isNoop: () => true
})), false);
assert.deepEqual(engine.getState(), stateBeforeNoop);

engine.clear();
assert.deepEqual(engine.getState(), {
  canUndo: false,
  canRedo: false,
  undoLabel: "",
  redoLabel: ""
});
assert.ok(updates > 0 && persists > 0, "history mutations must schedule UI and persistence work");
assert.ok(snapshots.length >= 1, "subscribers must receive history state changes");
unsubscribe();

console.log("Command history checks passed.");
