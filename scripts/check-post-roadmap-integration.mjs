import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { navigateToDiagnostic } from "../js/components/diagnostics/diagnostics-main.js";
import { createSourceLocationNavigator } from "../js/components/editor-panel/source-navigation.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");

const main = read("js/main.js");
assert(main.includes("function synchronizeTerminalBranch()"), "Terminal prompt must synchronize with Source Control branch changes.");
assert(main.includes("sourceControl.provider.subscribe(synchronizeTerminalBranch)"), "Terminal branch synchronization must subscribe to Source Control.");
assert(main.includes("secondarySidebar.setMaximized(false, false)"), "Infinite Reset must clear Secondary Sidebar maximization.");
assert(main.includes("bottomPanel.setMaximized(false, false)"), "Infinite Reset must clear Bottom Panel maximization.");
assert(!main.includes("createSourceLocationNavigator"), "Application orchestration must not construct source-location internals directly.");
assert.equal(
  (main.match(/openFileAt: editorPanel\.openFileAt/g) || []).length,
  2,
  "Run/Debug and Diagnostics must consume the editor panel exact-location API."
);
assert(!main.includes("sourceLocationNavigator"), "Application orchestration must not retain editor navigation implementation state.");
assert(!main.includes("function revealEditorLocation("), "Exact-location reveal implementation must not live in application orchestration.");
assert(!main.includes('source-editor__location-marker'), "Runtime source-location decoration must remain owned by the editor navigation component.");

const sourceNavigation = read("js/components/editor-panel/source-navigation.js");
assert(sourceNavigation.includes("export function createSourceLocationNavigator"), "Editor source navigation must own exact-location navigation.");
assert(sourceNavigation.includes('marker.className = "source-editor__location-marker"'), "Exact columns must receive a visible runtime marker.");
assert(sourceNavigation.includes('row.dataset.runtimeTarget = "true"'), "The revealed source row must expose transient target state.");
assert(sourceNavigation.includes("sourceScroller.focus({ preventScroll: true })"), "Exact-location navigation must focus the source editor without disturbing scroll position.");
assert(sourceNavigation.includes("generation !== navigationGeneration"), "Superseded source-location requests must not reveal stale targets.");

const marker = {
  className: "",
  style: {},
  removed: false,
  attributes: new Map(),
  setAttribute(name, value) { this.attributes.set(name, value); },
  remove() { this.removed = true; }
};
const row = {
  dataset: {},
  style: { background: "", boxShadow: "", position: "" },
  appended: null,
  append(node) { this.appended = node; }
};
const sourceContent = {
  dataset: { lineCount: "20" },
  querySelector(selector) {
    return selector.includes('data-line-number="20"') ? row : null;
  }
};
const focusCalls = [];
const sourceScroller = {
  scrollTop: 0,
  scrollLeft: 0,
  clientHeight: 190,
  tabIndex: 0,
  hasAttribute: () => false,
  focus(options) { focusCalls.push(options); }
};
let activeFile = "";
const openedFiles = [];
const clearedTimers = [];
let scheduledTimer = null;
const navigator = createSourceLocationNavigator({
  openFile(fileName) {
    openedFiles.push(fileName);
    activeFile = fileName;
    return fileName !== "missing.js";
  },
  getActiveFile: () => activeFile,
  sourceContent,
  sourceScroller,
  requestFrame(callback) { callback(); return 1; },
  setTimer(callback, delay) { scheduledTimer = { callback, delay }; return 17; },
  clearTimer(timer) { clearedTimers.push(timer); },
  getStyle: () => ({ lineHeight: "19px" }),
  createElement: () => marker
});
assert.equal(navigator.openFileAt("js/example.js", 20, 30), true, "Exact source navigation must open valid workspace files.");
assert.deepEqual(openedFiles, ["js/example.js"]);
assert.equal(sourceContent.dataset.runtimeTargetLine, "20");
assert.equal(sourceContent.dataset.runtimeTargetColumn, "30");
assert.equal(row.dataset.runtimeTarget, "true");
assert.equal(row.appended, marker);
assert.equal(marker.className, "source-editor__location-marker");
assert.equal(marker.attributes.get("aria-hidden"), "true");
assert.equal(marker.style.left, "256.8px");
assert.equal(sourceScroller.scrollTop, 275.5);
assert.equal(sourceScroller.scrollLeft, 128.8);
assert.equal(sourceScroller.tabIndex, -1);
assert.deepEqual(focusCalls, [{ preventScroll: true }]);
assert.equal(scheduledTimer?.delay, 1600, "Transient source-location decoration must use the established reveal duration.");
scheduledTimer.callback();
assert.equal(marker.removed, true, "Transient source-location marker must be removed during cleanup.");
assert.equal("runtimeTarget" in row.dataset, false, "Transient row state must be cleared after reveal cleanup.");
assert.equal(row.style.background, "");
assert.equal(row.style.boxShadow, "");
assert.equal(row.style.position, "");
assert.deepEqual(clearedTimers, [17], "Reveal cleanup must clear the pending timer before restoring row state.");
assert.equal(navigator.openFileAt("missing.js", 1, 1), false, "Exact source navigation must reject files that cannot be opened.");

const chat = read("js/components/ai/chat-main.js");
const clearStart = chat.indexOf("function clear()");
const clearEnd = chat.indexOf("async function executeToolCalls", clearStart);
const clearBody = chat.slice(clearStart, clearEnd);
assert(clearBody.includes("running = false"), "New Chat must release a running AI composer immediately.");
const firstProviderCall = chat.indexOf("providerRegistry.complete");
const firstToolCall = chat.indexOf("executeToolCalls(response.toolCalls)");
const cancellationCheck = chat.indexOf("if (token !== generation) return false;", firstProviderCall);
assert(cancellationCheck > firstProviderCall && cancellationCheck < firstToolCall, "Cancelled AI requests must not execute tool calls.");

const diagnostics = read("js/components/diagnostics/diagnostics-main.js");
assert(diagnostics.includes("return buildDependencyModel(workspace);"), "Diagnostics must build fresh dependency state from the workspace.");
assert(diagnostics.includes("workspace.subscribe?.(scheduleWorkspaceDiagnostics)"), "Diagnostics must refresh when WorkspaceFS changes outside the Problems panel.");
assert(diagnostics.includes("navigateToDiagnostic(problem, { openFile, openFileAt })"), "Problems rows must navigate through exact diagnostic locations.");

const navigationCalls = [];
assert.equal(
  navigateToDiagnostic(
    { fileName: "js/example.js", line: 4, column: 7 },
    { openFileAt: (...args) => { navigationCalls.push(args); return true; } }
  ),
  true,
  "Problem navigation must report successful exact-location navigation."
);
assert.deepEqual(
  navigationCalls,
  [["js/example.js", 5, 8]],
  "Zero-based diagnostic positions must convert to one-based editor locations."
);
const fallbackCalls = [];
assert.equal(
  navigateToDiagnostic(
    { fileName: "js/fallback.js", line: 2, column: 3 },
    { openFile: (fileName) => { fallbackCalls.push(fileName); return true; } }
  ),
  true,
  "Diagnostics must preserve plain file-opening fallback behavior."
);
assert.deepEqual(fallbackCalls, ["js/fallback.js"]);
assert.equal(navigateToDiagnostic({ message: "fileless" }, { openFileAt: () => true }), false, "Fileless diagnostics must not navigate.");

const workbench = read("js/components/editor-panel/workbench-input.js");
assert(workbench.includes("workspace.subscribe((change) =>"), "Primary editor must subscribe to external WorkspaceFS mutations.");
assert(workbench.includes("pendingWorkspaceReset"), "Branch/workspace resets must invalidate clean editor caches.");
assert(workbench.includes("buffers.isDirty(fileName)"), "External workspace reconciliation must protect dirty primary buffers.");
assert(workbench.includes('change.type === "file-renamed"'), "Primary editor must preserve open tabs across external file renames.");
assert(workbench.includes('change.type === "directory-renamed"'), "Primary editor must preserve directory-renamed sessions.");
assert(workbench.includes("createSourceLocationNavigator"), "Editor panel must construct its exact-location navigator internally.");
assert(workbench.includes("openFileAt: sourceLocationNavigator.openFileAt"), "Editor panel API must expose exact-location navigation.");
assert(workbench.includes("sourceLocationNavigator?.clear()"), "Editor panel lifecycle must clear stale source-location decoration.");

const split = read("js/components/editor-panel/split-editor.js");
assert(split.includes("function renameSession(oldName, newName)"), "Split editor must preserve file sessions across renames.");
assert(split.includes("function renameDirectorySessions(oldPath, newPath)"), "Split editor must preserve directory-renamed sessions.");
assert(split.includes("scheduleMissingFileReconcile"), "Split editor must defer missing-file cleanup until composite rename events settle.");

const bottom = read("js/components/bottom-panel/bottom-panel-input.js");
const secondary = read("js/components/secondary-sidebar/secondary-sidebar-input.js");
assert(bottom.includes("setMaximized"), "Bottom Panel controller must expose explicit maximize lifecycle control.");
assert(secondary.includes("setMaximized"), "Secondary Sidebar controller must expose explicit maximize lifecycle control.");

const conflicts = read("js/components/source-control/merge-conflict-editor.js");
assert(conflicts.includes("content === currentContent"), "Accept Current must resolve a no-op conflict without attempting to stage an unchanged HEAD file.");

console.log("Post-roadmap integration audit checks passed.");
