import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(resolve(repositoryRoot, path), "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function collectFiles(directory, extensionPattern) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === ".git" || entry.name === "node_modules") return [];
    const fullPath = resolve(directory, entry.name);
    if (entry.isDirectory()) return collectFiles(fullPath, extensionPattern);
    return extensionPattern.test(entry.name) ? [fullPath] : [];
  });
}

const html = read("index.html");
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
const idSet = new Set(ids);
const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
assert(duplicates.length === 0, "Duplicate HTML IDs: " + [...new Set(duplicates)].join(", "));

const requiredIds = [
  "app", "restrictedModeBanner", "titleBar", "titleBarBrand", "navigationControls",
  "commandCenter", "layoutControls", "activityBar", "primarySidebar", "explorerView",
  "workspaceTree", "workbench", "editorPanel", "editorTabs", "editorViewport",
  "canvasView", "canvasViewport", "canvasWorld", "canvasOverlay", "sourceEditorView",
  "sourceEditor", "bottomPanel", "secondarySidebar", "chatView", "notificationLayer",
  "statusBar", "togglePrimarySidebarBtn", "toggleBottomPanelBtn",
  "toggleSecondarySidebarBtn", "returnToOriginBtn", "resetCanvasBtn", "resetWorkspaceBtn",
  "activityMenuBtn", "activityExplorerBtn", "activitySearchBtn", "activitySourceControlBtn",
  "activityRunBtn", "activityExtensionsBtn", "activityGitHubBtn", "activityAccountBtn",
  "activitySettingsBtn", "workspaceDisclosureBtn", "newFileBtn", "newFolderBtn",
  "refreshExplorerBtn", "canvasControlsTabBtn", "infiniteCanvasTabBtn", "componentsTabBtn",
  "canvasTab", "fileTabs", "editorBreadcrumbKind", "editorBreadcrumbName", "splitEditorBtn",
  "editorActionsBtn", "problemsTabBtn", "outputTabBtn", "debugConsoleTabBtn",
  "terminalTabBtn", "portsTabBtn", "newTerminalBtn", "splitTerminalBtn", "killTerminalBtn",
  "maximizeBottomPanelBtn", "closeBottomPanelBtn", "newChatBtn", "chatSettingsBtn",
  "maximizeSecondarySidebarBtn", "closeSecondarySidebarBtn", "chatContext",
  "chatPromptInput", "sendChatMessageBtn"
];

const missingRequiredIds = requiredIds.filter((id) => !idSet.has(id));
assert(missingRequiredIds.length === 0, "Missing recommended IDs: " + missingRequiredIds.join(", "));

const ariaTargets = [...html.matchAll(/aria-controls="([^"]+)"/g)]
  .flatMap((match) => match[1].split(/\s+/));
const missingAriaTargets = ariaTargets.filter((id) => !idSet.has(id));
assert(missingAriaTargets.length === 0, "Missing aria-controls targets: " + missingAriaTargets.join(", "));

const elementsSource = read("js/core/elements.js");
const elementIds = [...elementsSource.matchAll(/getElementById\("([^"]+)"\)/g)].map((match) => match[1]);
const missingElementIds = elementIds.filter((id) => !idSet.has(id));
assert(missingElementIds.length === 0, "js/core/elements.js references missing IDs: " + missingElementIds.join(", "));

const expectedApplicationDirectories = ["js/core", "js/components", "js/ui"];
for (const directory of expectedApplicationDirectories) {
  assert(existsSync(resolve(repositoryRoot, directory)), "Missing JavaScript architecture directory: " + directory);
}

const rootJavaScriptFiles = readdirSync(repositoryRoot, { withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith(".js"))
  .map((entry) => entry.name)
  .sort();
assert(
  JSON.stringify(rootJavaScriptFiles) === JSON.stringify(["main.js"]),
  "Application JavaScript must live under js/. Unexpected root JS files: " + rootJavaScriptFiles.join(", ")
);
assert(read("main.js").includes('import "./js/main.js"'), "Root main.js must remain only the compatibility bootstrap for js/main.js.");

const editorPanelModules = [
  "editor-panel-main.js", "editor-tabs.js", "explorer-controller.js", "file-metadata.js",
  "minimap-controller.js", "source-analysis-client.js", "source-analysis-worker.js",
  "source-analysis.js", "source-files.js", "source-loader.js", "source-navigation.js",
  "source-renderer.js", "source-viewport.js", "workbench-input.js"
];
for (const moduleName of editorPanelModules) {
  assert(existsSync(resolve(repositoryRoot, "js/components/editor-panel", moduleName)), "Missing editor-panel module: " + moduleName);
}
assert(existsSync(resolve(repositoryRoot, "css/components/source-editor/source-navigation.css")), "Missing source-navigation.css feature styles.");
assert(
  read("css/components/source-editor/source-editor-main.css").includes('@import url("./source-navigation.css")'),
  "source-editor-main.css must import source-navigation.css."
);

const workbenchSource = read("js/components/editor-panel/workbench-input.js");
for (const forbiddenResponsibility of ["AbortController", "TOKEN_PATTERNS", "setPointerCapture", "lostpointercapture"]) {
  assert(!workbenchSource.includes(forbiddenResponsibility), "workbench-input.js must remain orchestration-only; move " + forbiddenResponsibility + " to its focused module.");
}
assert(workbenchSource.includes("createSourceViewport"), "workbench-input.js must coordinate the virtualized source viewport.");
assert(workbenchSource.includes("bindSourceNavigation"), "workbench-input.js must wire source search/navigation through its focused controller.");
assert(workbenchSource.includes("host: sourceScroller.parentElement"), "workbench-input.js must mount navigation controls in the source editor shell.");

const sourceViewportSource = read("js/components/editor-panel/source-viewport.js");
assert(sourceViewportSource.includes("createSourceAnalysisClient"), "source-viewport.js must delegate full-source analysis to the analysis client.");
assert(!sourceViewportSource.includes('split("\\n")') && !sourceViewportSource.includes("chooseRepresentativeLine"), "source-viewport.js must not reclaim full-source parsing or minimap analysis.");
assert(sourceViewportSource.includes("goToLocation") && sourceViewportSource.includes("setSearchResults"), "source-viewport.js must support direct virtual navigation and visible search highlighting.");

const sourceAnalysisClientSource = read("js/components/editor-panel/source-analysis-client.js");
assert(sourceAnalysisClientSource.includes('new URL("./source-analysis-worker.js", import.meta.url)'), "source-analysis-client.js must resolve the module worker relative to its own module URL.");
assert(sourceAnalysisClientSource.includes("analyzeSource") && sourceAnalysisClientSource.includes("searchSource"), "source-analysis-client.js must retain synchronous analysis and search fallbacks.");
assert(sourceAnalysisClientSource.includes('type: "search-source"'), "source-analysis-client.js must route large-source search through the worker.");
assert(sourceAnalysisClientSource.includes("wholeWord") && sourceAnalysisClientSource.includes("useRegex"), "source-analysis-client.js must preserve advanced find options across worker/local search.");

const sourceAnalysisWorkerSource = read("js/components/editor-panel/source-analysis-worker.js");
assert(sourceAnalysisWorkerSource.includes("analysis.lineStarts.buffer") && sourceAnalysisWorkerSource.includes("analysis.lineEnds.buffer"), "source-analysis-worker.js must transfer typed line-index buffers instead of cloning them.");
assert(sourceAnalysisWorkerSource.includes('type === "search-source"'), "source-analysis-worker.js must support whole-file search requests.");

const sourceNavigationSource = read("js/components/editor-panel/source-navigation.js");
assert(sourceNavigationSource.includes('key === "f"') && sourceNavigationSource.includes('key === "g"') && sourceNavigationSource.includes('event.key === "F3"'), "source-navigation.js must expose find, go-to-line, and next/previous match shortcuts.");
assert(sourceNavigationSource.includes("contenteditable"), "source-navigation.js must avoid shortcut conflicts with interactive/contenteditable controls.");
assert(!sourceNavigationSource.includes("window.prompt"), "source-navigation.js must use non-blocking editor widgets instead of window.prompt.");
for (const widgetId of [
  "sourceFindWidget", "sourceFindInput", "sourceFindMatchCount", "sourceFindPreviousBtn",
  "sourceFindNextBtn", "sourceFindMatchCaseBtn", "sourceFindWholeWordBtn", "sourceFindRegexBtn",
  "sourceFindCloseBtn", "sourceGoToWidget", "sourceGoToInput", "sourceGoToHint", "sourceGoToCloseBtn"
]) {
  assert(sourceNavigationSource.includes(widgetId), "source-navigation.js is missing stable widget ID: " + widgetId);
}
assert(sourceNavigationSource.includes("FIND_DEBOUNCE_MS"), "Find input must debounce live whole-file searches.");

const scriptFiles = collectFiles(repositoryRoot, /\.(?:js|mjs)$/);
for (const file of scriptFiles) {
  const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  assert(result.status === 0, "JavaScript syntax failed for " + relative(repositoryRoot, file) + "\n" + result.stderr);

  const source = readFileSync(file, "utf8");
  const imports = [...source.matchAll(/(?:import|export)\s+(?:[^"']+?\s+from\s+)?["']([^"']+)["']/g)]
    .map((match) => match[1])
    .filter((specifier) => specifier.startsWith("."));
  for (const specifier of imports) {
    assert(!specifier.includes("?v="), "Manual cache-versioned module import: " + specifier + " in " + relative(repositoryRoot, file));
    const importedFile = resolve(dirname(file), specifier.split("?")[0]);
    assert(existsSync(importedFile), "Missing JavaScript dependency: " + relative(repositoryRoot, importedFile));
  }
}

const sourceViewportUrl = pathToFileURL(resolve(repositoryRoot, "js/components/editor-panel/source-viewport.js")).href;
const { calculateSourceWindow } = await import(sourceViewportUrl);
const largeSourceWindow = calculateSourceWindow({ lineCount: 100000, scrollTop: 950000, clientHeight: 760, lineHeight: 19, paddingTop: 4 });
assert(largeSourceWindow.end - largeSourceWindow.start <= 80, "Source virtualization renders too many DOM rows for a normal viewport.");

const sourceAnalysisUrl = pathToFileURL(resolve(repositoryRoot, "js/components/editor-panel/source-analysis.js")).href;
const { analyzeSource, searchSource, calculateMinimapRanges, MAX_MINIMAP_SAMPLES, MAX_SEARCH_MATCHES } = await import(sourceAnalysisUrl);
const largeMinimapRanges = calculateMinimapRanges(100000);
assert(largeMinimapRanges.length === MAX_MINIMAP_SAMPLES, "Minimap analysis must cap overview DOM samples.");
assert(largeMinimapRanges[0]?.start === 0 && largeMinimapRanges.at(-1)?.end === 99999, "Minimap analysis must cover the complete source range.");
const indexedSource = analyzeSource("alpha\r\nbeta\n" + "x\n".repeat(100000));
assert(indexedSource.lineCount === 100003, "Source analysis line indexing returned the wrong line count.");
assert(indexedSource.lineStarts instanceof Uint32Array && indexedSource.lineEnds instanceof Uint32Array, "Source analysis must use typed line offsets.");
assert(indexedSource.minimapSamples.length === MAX_MINIMAP_SAMPLES, "Large source analysis must keep the minimap sample count bounded.");
assert("alpha\r\nbeta\n".slice(indexedSource.lineStarts[0], indexedSource.lineEnds[0]) === "alpha", "Source analysis must exclude CR from CRLF line slices.");

const searchResult = searchSource("Alpha beta\r\nalpha ALPHA\nnone", "alpha");
assert(searchResult.matches.length === 3, "Whole-source search returned the wrong match count.");
assert(searchResult.matches[1]?.line === 1 && searchResult.matches[1]?.column === 0, "Whole-source search returned the wrong line/column index.");
const wholeWordSearch = searchSource("cat catalog cat_cat cat", "cat", { wholeWord: true });
assert(wholeWordSearch.matches.length === 2, "Whole-word search must reject identifier/sub-string matches.");
const regexSearch = searchSource("foo1 bar\nfoo22 foo3", "foo\\d+", { useRegex: true });
assert(regexSearch.matches.length === 3 && regexSearch.matches[1]?.line === 1, "Regex search must return complete line/column matches.");
const caseSearch = searchSource("Alpha alpha", "Alpha", { matchCase: true });
assert(caseSearch.matches.length === 1 && caseSearch.matches[0]?.column === 0, "Match-case search must remain case sensitive.");
let invalidRegexRejected = false;
try {
  searchSource("alpha", "[", { useRegex: true });
} catch {
  invalidRegexRejected = true;
}
assert(invalidRegexRejected, "Invalid regex queries must fail instead of producing misleading results.");
const cappedSearch = searchSource("x ".repeat(MAX_SEARCH_MATCHES + 20), "x", { maxMatches: MAX_SEARCH_MATCHES });
assert(cappedSearch.matches.length === MAX_SEARCH_MATCHES && cappedSearch.truncated, "Whole-source search must bound very large result sets.");

const sourceNavigationUrl = pathToFileURL(resolve(repositoryRoot, "js/components/editor-panel/source-navigation.js")).href;
const { parseSourceLocation } = await import(sourceNavigationUrl);
assert(JSON.stringify(parseSourceLocation("400:12")) === JSON.stringify({ line: 400, column: 12 }), "Go-to-line parser must accept line:column syntax.");
assert(JSON.stringify(parseSourceLocation(":400:12")) === JSON.stringify({ line: 400, column: 12 }), "Go-to-line parser must accept VS Code-style :line:column syntax.");
assert(parseSourceLocation("bad") === null, "Go-to-line parser must reject invalid locations.");

const pointerCaptureModules = [
  "js/components/infinite-canvas/pan-input.js",
  "js/components/infinite-canvas/card-input.js",
  "js/components/panel-resize/panel-resize-input.js",
  "js/components/editor-panel/minimap-controller.js"
];
for (const modulePath of pointerCaptureModules) {
  assert(read(modulePath).includes("lostpointercapture"), modulePath + " must recover from lost pointer capture.");
}

const keyboardSource = read("js/components/infinite-canvas/keyboard.js");
assert(keyboardSource.includes("contenteditable"), "keyboard.js must ignore contenteditable controls.");
assert(keyboardSource.includes("event.ctrlKey") && keyboardSource.includes("event.metaKey") && keyboardSource.includes("event.altKey"), "keyboard.js must reject modified shortcut conflicts.");

const storageSource = read("js/core/storage.js");
assert(storageSource.includes("getViewportWorldCenter") && storageSource.includes("camera"), "storage.js must persist the viewport camera in world coordinates.");

const generatedCss = read("css/generated/creed.css");
assert(generatedCss.length > 1000, "Generated CSS bundle is unexpectedly small.");
assert(!/@import\s/.test(generatedCss), "Generated CSS bundle still contains @import rules.");
assert(generatedCss.includes("source-navigation.css"), "Generated CSS bundle must include source-navigation.css.");

const inventorySource = read("js/components/editor-panel/source-files.js");
const inventory = [...inventorySource.matchAll(/^\s+"([^"]+)",$/gm)].map((match) => match[1]);
const actualFiles = collectFiles(repositoryRoot, /./)
  .map((file) => relative(repositoryRoot, file).replaceAll("\\", "/"))
  .sort((left, right) => left.localeCompare(right));
assert(JSON.stringify(inventory) === JSON.stringify(actualFiles), "source-files.js is not synchronized with the repository.");

const forbiddenHtmlTokens = ["sidebar1", "terminalPanel", "workspaceCanvasTab", "canvasEditorView", "codeEditorView"];
const foundForbiddenTokens = forbiddenHtmlTokens.filter((token) => html.includes(token));
assert(foundForbiddenTokens.length === 0, "Legacy HTML tokens remain: " + foundForbiddenTokens.join(", "));

console.log("Architecture check passed: " + ids.length + " unique IDs, " + elementIds.length + " wired elements.");
