import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createEditorTextModel,
  findMatchingDelimiter,
  offsetToPosition,
  positionToOffset
} from "../js/components/editor-panel/editor-text-model.js";
import { classifySourceTokens } from "../js/components/editor-panel/source-renderer.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");

const sample = "alpha\nbeta\ngamma";
assert.deepEqual(offsetToPosition(sample, 7), { line: 1, column: 1 });
assert.equal(positionToOffset(sample, 2, 2), 13);
assert.equal(findMatchingDelimiter("function x() { return '(ok)'; }", 13)?.matchOffset, 30);
assert.equal(findMatchingDelimiter('const x = "hello";', 10)?.character, '"');

const indentModel = createEditorTextModel("if (ready) {");
indentModel.setPrimarySelection(indentModel.getText().length);
indentModel.insertNewlineWithIndent();
assert.equal(indentModel.getText(), "if (ready) {\n  ");

const lineModel = createEditorTextModel("one\ntwo");
lineModel.setPrimarySelection(0, lineModel.getText().length);
lineModel.indentSelections();
assert.equal(lineModel.getText(), "  one\n  two");
lineModel.indentSelections({ outdent: true });
assert.equal(lineModel.getText(), "one\ntwo");
lineModel.toggleLineComments("js");
assert.equal(lineModel.getText(), "// one\n// two");
lineModel.toggleLineComments("js");
assert.equal(lineModel.getText(), "one\ntwo");

const multiModel = createEditorTextModel("a\nb\nc");
multiModel.setPrimarySelection(0);
multiModel.addCursorVertical(1);
multiModel.addCursorVertical(1);
assert.equal(multiModel.getSelections().length, 3);
multiModel.replaceSelections("x");
assert.equal(multiModel.getText(), "xa\nxb\nxc");

const columnModel = createEditorTextModel("abcd\nefgh\nijkl");
columnModel.setPrimarySelection(1, positionToOffset(columnModel.getText(), 2, 3));
columnModel.createColumnSelectionsFromPrimary();
assert.equal(columnModel.getSelections().length, 3);
columnModel.replaceSelections("Z");
assert.equal(columnModel.getText(), "aZd\neZh\niZl");

const jsTokens = classifySourceTokens("const answer = 42;", "js");
assert(jsTokens.some((token) => token.text === "const" && token.className === "syntax-keyword"));
assert(jsTokens.some((token) => token.text === "42" && token.className === "syntax-number"));
const jsonTokens = classifySourceTokens('{"name":"CREED","enabled":true,"count":2}', "json");
assert(jsonTokens.some((token) => token.text.includes("name") && token.className === "syntax-property"));
assert(jsonTokens.some((token) => token.text === "true" && token.className === "syntax-keyword"));
assert(classifySourceTokens("<main>CREED</main>", "html").some((token) => token.className === "syntax-tag"));
assert(classifySourceTokens(".app { color: #fff; }", "css").length > 0);
assert(classifySourceTokens("# CREED", "md").some((token) => token.className === "syntax-heading"));

const editing = read("js/components/editor-panel/editor-editing.js");
assert(editing.includes("createEditorTextModel"), "Editor editing must use the independent text model.");
assert(editing.includes('event.key === "Tab"'), "Editor must support Tab/Shift+Tab indentation.");
assert(editing.includes('key === "/"'), "Editor must support comment toggling.");
assert(editing.includes("addCursorVertical"), "Editor must wire multi-cursor creation.");
assert(editing.includes("createColumnSelectionsFromPrimary"), "Editor must wire column selections.");
assert(editing.includes("findMatchingDelimiter"), "Editor must report bracket/quote matches.");

const tabs = read("js/components/editor-panel/editor-tabs.js");
assert(tabs.includes("tab.draggable = true"), "Editor tabs must be draggable.");
assert(tabs.includes("function reorder("), "Editor tabs must expose deterministic reordering.");

console.log("Editor engine check passed.");
