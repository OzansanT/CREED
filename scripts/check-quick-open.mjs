import assert from "node:assert/strict";
import { rankQuickOpenFiles } from "../js/components/editor-panel/quick-open.js";

const files = [
  "README.md",
  "js/main.js",
  "js/components/editor-panel/workbench-input.js",
  "css/components/editor-panel/editor-tabs.css",
  "ui/main-frame.html"
];

assert.deepEqual(
  rankQuickOpenFiles("main.js", files),
  ["js/main.js"],
  "exact basename matches should rank first and exclude non-matches"
);

assert.deepEqual(
  rankQuickOpenFiles("editor", files),
  [
    "js/components/editor-panel/workbench-input.js",
    "css/components/editor-panel/editor-tabs.css"
  ],
  "path substring matches should remain stable in source order when scores are equivalent"
);

assert.deepEqual(
  rankQuickOpenFiles("", files, 2),
  files.slice(0, 2),
  "empty queries should preserve workspace inventory order and honor the result limit"
);

assert.deepEqual(rankQuickOpenFiles("missing", files), []);

console.log("Quick Open checks passed.");
