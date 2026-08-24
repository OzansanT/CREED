import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { calculateResizedBounds } from "../js/components/infinite-canvas/component-resize-input.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");
const start = { worldX: 0, worldY: 0, width: 400, height: 300 };

assert.deepEqual(
  calculateResizedBounds(start, "e", 100, 0),
  { worldX: 50, worldY: 0, width: 500, height: 300 },
  "East resize must grow from the east edge while preserving the west edge."
);
assert.deepEqual(
  calculateResizedBounds(start, "w", 100, 0),
  { worldX: 50, worldY: 0, width: 300, height: 300 },
  "West resize must move the center while preserving the east edge."
);
assert.deepEqual(
  calculateResizedBounds(start, "n", 0, 100),
  { worldX: 0, worldY: 50, width: 400, height: 200 },
  "North resize must move the center while preserving the south edge."
);
assert.deepEqual(
  calculateResizedBounds(start, "nw", 300, 300),
  { worldX: 90, worldY: 80, width: 220, height: 140 },
  "Corner resize must enforce the generic component minimum size."
);

const resizeSource = read("js/components/infinite-canvas/component-resize-input.js");
assert(resizeSource.includes("/ Math.max(0.01, state.zoom)"), "Component resize must convert pointer deltas through canvas zoom.");
assert(resizeSource.includes("lostpointercapture"), "Component resize must recover from lost pointer capture.");
assert(resizeSource.includes("Resize ${record.type} component"), "Component resize must register undo/redo history.");

const managerSource = read("js/components/infinite-canvas/component-manager.js");
assert(managerSource.includes('dataComponentAction = action') || managerSource.includes("dataset.componentAction = action"), "Component shell must expose stable window-control actions.");
assert(managerSource.includes('makeWindowButton("minimize"'), "Component shell must provide a minimize control.");
assert(managerSource.includes('makeWindowButton("maximize"'), "Component shell must provide a maximize control.");
assert(managerSource.includes("toggleMinimize"), "Component manager must own minimize/restore lifecycle.");
assert(managerSource.includes("toggleMaximize"), "Component manager must own maximize/restore lifecycle.");
assert(managerSource.includes("getViewportWorldCenter(canvas, state)"), "Maximize must remain world-coordinate aware.");
assert(managerSource.includes("for (const id of [...mounted.keys()]) unmountRecord(id);"), "Snapshot restore must remount component bindings instead of retaining stale record closures.");

const storageSource = read("js/core/storage.js");
assert(storageSource.includes("windowState"), "Canvas component window state must persist.");
assert(storageSource.includes("restoreBounds"), "Maximized component restore bounds must persist.");

console.log("Canvas component window-control checks passed.");
