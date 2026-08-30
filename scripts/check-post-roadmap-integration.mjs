import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");

const main = read("js/main.js");
assert(main.includes("function synchronizeTerminalBranch()"), "Terminal prompt must synchronize with Source Control branch changes.");
assert(main.includes("sourceControl.provider.subscribe(synchronizeTerminalBranch)"), "Terminal branch synchronization must subscribe to Source Control.");
assert(main.includes("secondarySidebar.setMaximized(false, false)"), "Infinite Reset must clear Secondary Sidebar maximization.");
assert(main.includes("bottomPanel.setMaximized(false, false)"), "Infinite Reset must clear Bottom Panel maximization.");

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

const workbench = read("js/components/editor-panel/workbench-input.js");
assert(workbench.includes("workspace.subscribe((change) =>"), "Primary editor must subscribe to external WorkspaceFS mutations.");
assert(workbench.includes("pendingWorkspaceReset"), "Branch/workspace resets must invalidate clean editor caches.");
assert(workbench.includes("buffers.isDirty(fileName)"), "External workspace reconciliation must protect dirty primary buffers.");
assert(workbench.includes('change.type === "file-renamed"'), "Primary editor must preserve open tabs across external file renames.");
assert(workbench.includes('change.type === "directory-renamed"'), "Primary editor must preserve open tabs across external directory renames.");

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
