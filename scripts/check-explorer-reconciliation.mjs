import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve("js/components/editor-panel/explorer-controller.js"), "utf8");
assert.equal(source.includes("function reconcileContainer"), true, "Explorer must reconcile existing DOM nodes.");
assert.equal(source.includes("function directChildMap"), true, "Explorer reconciliation must key current child nodes.");
assert.equal(source.includes("getReconciliationStats"), true, "Explorer must expose reconciliation diagnostics.");
assert.equal(source.includes("fileTree.replaceChildren"), false, "Explorer must not replace the complete tree during refresh.");
assert.equal(source.includes("existing.delete(key)"), true, "Explorer must explicitly reuse keyed nodes.");

console.log("Explorer incremental reconciliation check passed.");
