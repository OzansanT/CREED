import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createWorkspaceSearchEngine, createWorkspaceSearchPattern } from "../js/components/editor-panel/workspace-search.js";
import {
  createLanguageProviderRegistry,
  createWorkspaceSymbolIndex,
  extractSourceSymbols
} from "../js/components/editor-panel/workspace-symbols.js";
import { navigateToWorkspaceLocation } from "../js/components/primary-sidebar/workspace-search-view.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");
const files = new Map([
  ["src/main.js", "export function greet(name) {\n  const message = 'Hello ' + name;\n  return message;\n}\ngreet('CREED');\n"],
  ["src/util.js", "export const greetCount = 2;\nexport function helper() { return greetCount; }\n"],
  ["README.md", "# CREED\nHello workspace\n"]
]);
const listeners = new Set();
const workspace = {
  listFiles: () => [...files.keys()].sort(),
  readFile: async (path) => {
    if (!files.has(path)) throw new Error("missing");
    return files.get(path);
  },
  writeFile: (path, content) => {
    files.set(path, content);
    listeners.forEach((listener) => listener({ type: "file-written", path }));
  },
  hasFile: (path) => files.has(path),
  subscribe: (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }
};

const pattern = createWorkspaceSearchPattern("hello", { matchCase: false, wholeWord: true });
assert.equal(pattern.test("Hello helloWorld"), true);
pattern.lastIndex = 0;
assert.equal([..."helloWorld".matchAll(pattern)].length, 0);

const search = createWorkspaceSearchEngine({ workspace });
let result = await search.search("greet", { matchCase: true, wholeWord: true });
assert.equal(result.groups.length, 1);
assert.equal(result.groups[0].fileName, "src/main.js");
assert.equal(result.totalMatches, 2);
result = await search.search("greet(?:Count)?", { useRegex: true, matchCase: true });
assert(result.totalMatches >= 3);
const replaced = await search.replaceAll("Hello", "Hi", { matchCase: true });
assert.equal(replaced.filesChanged, 2);
assert(files.get("src/main.js").includes("Hi"));
assert(files.get("README.md").includes("Hi workspace"));

const jsSymbols = extractSourceSymbols("src/main.js", files.get("src/main.js"));
assert(jsSymbols.some((symbol) => symbol.name === "greet" && symbol.kind === "function"));
assert(jsSymbols.some((symbol) => symbol.name === "message" && symbol.kind === "variable"));
assert(extractSourceSymbols("README.md", "# CREED\n## Architecture").some((symbol) => symbol.name === "Architecture"));
assert(extractSourceSymbols("theme.css", ".app { color: red; }").some((symbol) => symbol.kind === "selector"));
assert(extractSourceSymbols("page.html", '<main id="workspace"><h1>CREED</h1></main>').some((symbol) => symbol.name === "workspace"));
assert(extractSourceSymbols("data.json", '{\n  "name": "CREED"\n}').some((symbol) => symbol.name === "name"));

const index = createWorkspaceSymbolIndex({ workspace });
await index.refresh();
assert(index.fileSymbols("src/main.js").some((symbol) => symbol.name === "greet"));
assert(index.searchSymbols("help").some((symbol) => symbol.name === "helper"));
assert.equal(index.findDefinition("greet")?.fileName, "src/main.js");
const references = await index.findReferences("greet", { matchCase: true });
assert(references.some((reference) => reference.fileName === "src/main.js"));

const providers = createLanguageProviderRegistry();
providers.register("*", index.provider);
const definition = await providers.provideDefinition({ language: "*", symbol: "helper" });
assert.equal(definition.fileName, "src/util.js");
const providerRefs = await providers.provideReferences({ language: "*", symbol: "greetCount", matchCase: true });
assert(providerRefs.length >= 2);

const navigationCalls = [];
assert.equal(
  navigateToWorkspaceLocation(
    { fileName: "src/main.js", lineNumber: 3, columnNumber: 5 },
    { openFileAt: (...args) => { navigationCalls.push(args); return true; } }
  ),
  true,
  "Workspace search matches must navigate through exact editor locations."
);
assert.deepEqual(navigationCalls, [["src/main.js", 3, 5]], "One-based search match coordinates must pass through unchanged.");
assert.equal(
  navigateToWorkspaceLocation(
    { fileName: "src/util.js", line: 1, column: 7 },
    { openFileAt: (...args) => { navigationCalls.push(args); return true; } }
  ),
  true,
  "Zero-based workspace symbol coordinates must navigate through the same editor API."
);
assert.deepEqual(navigationCalls[1], ["src/util.js", 2, 8], "Zero-based symbol coordinates must convert to one-based editor locations.");
const fallbackOpen = [];
assert.equal(
  navigateToWorkspaceLocation({ fileName: "README.md", lineNumber: 2, columnNumber: 1 }, { openFile: (fileName) => { fallbackOpen.push(fileName); return true; } }),
  true,
  "Workspace navigation must preserve plain file-opening fallback behavior."
);
assert.deepEqual(fallbackOpen, ["README.md"]);
assert.equal(navigateToWorkspaceLocation({ lineNumber: 1 }, { openFileAt: () => true }), false, "Fileless workspace locations must not navigate.");

const searchView = read("js/components/primary-sidebar/workspace-search-view.js");
assert(searchView.includes("workspaceSearchInput"), "Search view must provide a workspace search input.");
assert(searchView.includes("workspaceReplaceInput"), "Search view must provide workspace replacement.");
assert(searchView.includes("workspaceOutlineResults"), "Search view must expose an Outline panel.");
assert(searchView.includes("workspaceSymbolInput"), "Search view must expose workspace symbol navigation.");
assert(searchView.includes("provideReferences"), "Search view must expose reference navigation.");
assert(searchView.includes("provideDefinition"), "Search view must use the definition provider interface.");
assert(searchView.includes("navigateToWorkspaceLocation(location, { openFile, openFileAt })"), "Search results, symbols, definitions, and references must share exact editor navigation.");
assert(!searchView.includes("sourceScroller.scrollTop"), "Workspace Search must not own duplicate source scrolling math.");
assert(!searchView.includes("sourceScroller.scrollLeft"), "Workspace Search must not own duplicate horizontal navigation math.");

const main = read("js/main.js");
const exactNavigationBindings = main.match(/openFileAt: editorPanel\.openFileAt/g) || [];
assert(exactNavigationBindings.length >= 3, "Search, Run/Debug, and Diagnostics must share editorPanel.openFileAt.");

const sidebar = read("js/components/primary-sidebar/primary-sidebar-input.js");
assert(sidebar.includes('activeView = "explorer"'), "Primary sidebar must track an active activity view.");
assert(sidebar.includes('activateFromButton("search")'), "Search activity must participate in primary sidebar switching.");

const unavailable = read("js/ui/unavailable-controls.js");
assert(!unavailable.includes('"#activitySearchBtn"'), "Search activity must be enabled.");

console.log("Workspace intelligence check passed.");
