import assert from "node:assert/strict";
import { calculateFitView } from "../js/components/infinite-canvas/canvas-navigation.js";

assert.equal(calculateFitView({ items: [], viewportWidth: 1000, viewportHeight: 700 }), null);

const centered = calculateFitView({
  items: [{ worldX: 0, worldY: 0, width: 200, height: 100 }],
  viewportWidth: 1000,
  viewportHeight: 700,
  padding: 100
});
assert.equal(centered.zoom, 3, "fit zoom must respect MAX_ZOOM");
assert.equal(centered.x, 500);
assert.equal(centered.y, 350);

const spread = calculateFitView({
  items: [
    { worldX: -500, worldY: 0, width: 100, height: 100 },
    { worldX: 500, worldY: 0, width: 100, height: 100 }
  ],
  viewportWidth: 1000,
  viewportHeight: 700,
  padding: 50
});
assert.ok(spread.zoom < 1);
assert.equal(spread.x, 500, "symmetric content should remain horizontally centered");
assert.equal(spread.y, 350, "symmetric content should remain vertically centered");

const tinyViewport = calculateFitView({
  items: [{ worldX: 10000, worldY: -10000, width: 100000, height: 100000 }],
  viewportWidth: 100,
  viewportHeight: 100,
  padding: 72
});
assert.equal(tinyViewport.zoom, 0.2, "fit zoom must respect MIN_ZOOM");
assert.ok(Number.isFinite(tinyViewport.x) && Number.isFinite(tinyViewport.y));

console.log("Canvas navigation checks passed.");
