import assert from "node:assert/strict";
import {
  getRovingTabIndexes,
  getRovingTargetIndex
} from "../js/ui/accessibility.js";

assert.equal(getRovingTargetIndex({ index: 0, length: 4, key: "ArrowRight" }), 1);
assert.equal(getRovingTargetIndex({ index: 3, length: 4, key: "ArrowRight" }), 0);
assert.equal(getRovingTargetIndex({ index: 0, length: 4, key: "ArrowLeft" }), 3);
assert.equal(getRovingTargetIndex({ index: 2, length: 4, key: "Home" }), 0);
assert.equal(getRovingTargetIndex({ index: 1, length: 4, key: "End" }), 3);
assert.equal(getRovingTargetIndex({ index: 0, length: 3, key: "ArrowDown", orientation: "vertical" }), 1);
assert.equal(getRovingTargetIndex({ index: 0, length: 3, key: "ArrowUp", orientation: "vertical" }), 2);
assert.equal(getRovingTargetIndex({ index: 0, length: 3, key: "ArrowRight", orientation: "vertical" }), null);
assert.equal(getRovingTargetIndex({ index: -1, length: 3, key: "Home" }), null);
assert.equal(getRovingTargetIndex({ index: 0, length: 0, key: "Home" }), null);

assert.deepEqual(getRovingTabIndexes({ activeIndex: 0, length: 4 }), [0, -1, -1, -1]);
assert.deepEqual(getRovingTabIndexes({ activeIndex: 2, length: 4 }), [-1, -1, 0, -1]);
assert.deepEqual(getRovingTabIndexes({ activeIndex: 99, length: 3 }), [0, -1, -1]);
assert.deepEqual(getRovingTabIndexes({ activeIndex: 0, length: 0 }), []);
assert.equal(getRovingTabIndexes({ activeIndex: 1, length: 5 }).filter((value) => value === 0).length, 1);

console.log("Accessibility navigation checks passed.");
