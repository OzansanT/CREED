import assert from "node:assert/strict";
import { createEditorBufferStore } from "../js/components/editor-panel/editor-buffer-store.js";

const values = new Map();
const storage = {
  getItem: (key) => values.has(key) ? values.get(key) : null,
  setItem: (key, value) => values.set(key, String(value)),
  removeItem: (key) => values.delete(key)
};

let buffers = createEditorBufferStore({ storage });
assert.equal(buffers.open("README.md", "one"), "one");
buffers.setText("README.md", "two");
buffers.setText("README.md", "three");
assert.equal(buffers.isDirty("README.md"), true);
assert.equal(buffers.undo("README.md"), "two");
assert.equal(buffers.redo("README.md"), "three");
assert.deepEqual(buffers.dirtyFiles(), ["README.md"]);

buffers = createEditorBufferStore({ storage });
assert.equal(buffers.open("README.md", "one"), "three", "dirty buffer must survive reload");
assert.equal(buffers.isDirty("README.md"), true);
buffers.markSaved("README.md");
assert.equal(buffers.isDirty("README.md"), false);
buffers.setText("README.md", "four");
buffers.revert("README.md", "three");
assert.equal(buffers.getText("README.md"), "three");
assert.deepEqual(buffers.dirtyFiles(), []);

console.log("Editor buffer check passed.");
