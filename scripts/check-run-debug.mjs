import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");

assert.equal(
  existsSync(resolve(root, "js/components/run-debug")),
  false,
  "The removed Run and Debug implementation directory must not return."
);

const activityBar = read("ui/bars/activity-bar/activity-bar.html");
assert(!activityBar.includes("activityRunBtn"), "The Run and Debug activity button must remain removed.");
assert(!activityBar.includes("Run and Debug"), "The activity bar must not retain Run and Debug UI copy.");

const elements = read("js/core/elements.js");
assert(!elements.includes("activityRunBtn"), "DOM lookup must not retain the removed Run and Debug button.");

const main = read("js/main.js");
assert(!main.includes("bindRunDebug"), "Application orchestration must not bind the removed Run and Debug feature.");
assert(!main.includes("runDebug"), "Application orchestration must not retain Run and Debug state.");
assert(!main.includes("activityRunBtn"), "Application orchestration must not reference the removed Run activity.");

const primarySidebar = read("js/components/primary-sidebar/primary-sidebar-input.js");
assert(!primarySidebar.includes("runButton"), "Primary sidebar must not retain Run activity button wiring.");
assert(!primarySidebar.includes("runView"), "Primary sidebar must not retain a Run view.");
assert(!primarySidebar.includes('"run"'), "Primary sidebar view names must not include the removed Run view.");

const inventory = read("js/components/editor-panel/source-files.js");
assert(!inventory.includes("js/components/run-debug/"), "Explorer inventory must not expose removed Run and Debug files.");

const generatedFrame = read("index.html");
assert(!generatedFrame.includes("activityRunBtn"), "Generated index.html must not contain the removed Run and Debug button.");
assert(!generatedFrame.includes("runDebugView"), "Generated index.html must not contain the removed Run and Debug view.");

console.log("Run and Debug removal checks passed.");
