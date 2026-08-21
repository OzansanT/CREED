import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");

const split = read("js/components/editor-panel/split-editor.js");
assert(split.includes('host.id = "secondaryEditorGroup"'), "Split editor must create a distinct secondary editor group.");
assert(split.includes('fileSelect.id = "secondaryEditorFileSelect"'), "Secondary group must own independent file selection.");
assert(split.includes('editor.id = "secondaryEditorText"'), "Secondary group must own an independent editable surface.");
assert(split.includes("const sessions = new Map()"), "Secondary group must maintain per-file sessions.");
assert(split.includes("selectionStart") && split.includes("selectionEnd"), "Secondary group must preserve selection state.");
assert(split.includes("scrollTop") && split.includes("scrollLeft"), "Secondary group must preserve scroll state.");
assert(split.includes("workspace.writeFile(activeFile"), "Secondary group must save through the writable workspace.");
assert(split.includes("SPLIT_STORAGE_KEY"), "Split editor state must survive browser reloads.");
assert(split.includes("getPrimaryActiveFile"), "Split editor should initialize from primary context without coupling ongoing active state.");
assert(split.includes('inset: "0 0 0 50%"'), "Secondary group must occupy an independent half-editor region.");
assert(split.includes('canvasView.style.right = right') && split.includes('sourceView.style.right = right'), "Primary editor region must resize when split opens.");
assert(split.includes('event.key.toLowerCase() === "s"'), "Secondary editor must support Ctrl/Cmd+S.");

const main = read("js/main.js");
assert(main.includes('bindSplitEditor'), "Application orchestration must bind the split editor.");
assert(main.includes('splitButton: elements.splitEditorBtn'), "Existing split editor control must own split activation.");
assert(main.includes('getPrimaryActiveFile: editorPanel.getActiveFile'), "Split editor must receive primary active-file context through a narrow API.");

const workbench = read("js/components/editor-panel/workbench-input.js");
assert(workbench.includes('getActiveFile: () => activeFile'), "Primary editor must expose active file without exposing mutable internals.");
assert(workbench.includes('onOrderChange: scheduleEditorWorkspacePersist'), "Editor tab reordering must persist after #29.");

const unavailable = read("js/ui/unavailable-controls.js");
assert(!unavailable.includes('"#splitEditorBtn"'), "Split editor button must no longer be disabled.");

console.log("Split editor check passed.");
