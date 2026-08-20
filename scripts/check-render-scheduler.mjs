import assert from "node:assert/strict";
import { createRenderScheduler } from "../js/ui/render-scheduler.js";

let renderCount = 0;
let nextFrameId = 0;
const callbacks = new Map();
const cancelled = [];

const requestFrame = (callback) => {
  nextFrameId += 1;
  callbacks.set(nextFrameId, callback);
  return nextFrameId;
};
const cancelFrame = (frameId) => {
  cancelled.push(frameId);
  callbacks.delete(frameId);
};

const scheduler = createRenderScheduler(
  () => { renderCount += 1; },
  requestFrame,
  cancelFrame
);

assert.equal(scheduler.pending(), false);
scheduler.schedule();
const firstFrame = nextFrameId;
assert.equal(scheduler.pending(), true);
scheduler.schedule();
assert.equal(nextFrameId, firstFrame, "multiple schedules in one frame must coalesce");

callbacks.get(firstFrame)?.();
callbacks.delete(firstFrame);
assert.equal(renderCount, 1);
assert.equal(scheduler.pending(), false);

scheduler.schedule();
const secondFrame = nextFrameId;
scheduler.flush();
assert.equal(renderCount, 2);
assert.equal(scheduler.pending(), false);
assert.ok(cancelled.includes(secondFrame), "flush must cancel pending frame work before rendering immediately");

scheduler.schedule();
const thirdFrame = nextFrameId;
scheduler.cancel();
assert.equal(scheduler.pending(), false);
assert.ok(cancelled.includes(thirdFrame), "cancel must discard pending frame work");
assert.equal(renderCount, 2);

assert.throws(() => createRenderScheduler(null, requestFrame, cancelFrame), TypeError);
console.log("Render scheduler checks passed.");
