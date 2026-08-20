import assert from "node:assert/strict";
import { snapWorldPoint } from "../js/components/infinite-canvas/snapping.js";

assert.deepEqual(
  snapWorldPoint({ x: 47, y: 25, zoom: 1 }),
  { worldX: 48, worldY: 24 },
  "points inside the screen-space snap threshold should land on the world grid"
);

assert.deepEqual(
  snapWorldPoint({ x: 61, y: 61, zoom: 1 }),
  { worldX: 61, worldY: 61 },
  "points outside the snap threshold should remain unchanged"
);

assert.deepEqual(
  snapWorldPoint({
    x: 103,
    y: 197,
    zoom: 1,
    candidates: [{ worldX: 100, worldY: 200 }]
  }),
  { worldX: 100, worldY: 200 },
  "nearby component centres should take precedence when within threshold"
);

assert.deepEqual(
  snapWorldPoint({ x: 49, y: 49, zoom: 2 }),
  { worldX: 48, worldY: 48 },
  "snap threshold should scale with zoom while world grid coordinates stay stable"
);

console.log("World snapping checks passed.");
