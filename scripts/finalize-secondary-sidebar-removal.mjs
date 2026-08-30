import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");
const write = (path, content) => writeFileSync(resolve(root, path), content);

function replaceRequired(source, search, replacement, label) {
  if (!source.includes(search)) throw new Error(`Missing expected ${label}`);
  return source.replace(search, replacement);
}

let workbench = read("js/components/editor-panel/workbench-input.js");
workbench = replaceRequired(
  workbench,
  "  codeMinimap,\n  chatContextKind,\n  chatContextName,\n  statusLanguage,",
  "  codeMinimap,\n  statusLanguage,",
  "editor chat-context parameters"
);
workbench = replaceRequired(
  workbench,
  "    breadcrumbName.textContent = name;\n    chatContextKind.textContent = kind;\n    chatContextName.textContent = name;\n    setNavigationStatus(\"\");",
  "    breadcrumbName.textContent = name;\n    setNavigationStatus(\"\");",
  "editor chat-context updates"
);
write("js/components/editor-panel/workbench-input.js", workbench);

let main = read("js/main.js");
main = replaceRequired(
  main,
  "const elements = getElements();\nconst detachedFileContextKind = document.createElement(\"span\");\nconst detachedFileContextName = document.createElement(\"span\");\nloadState(elements.canvas);",
  "const elements = getElements();\nloadState(elements.canvas);",
  "detached file-context sinks"
);
main = replaceRequired(
  main,
  "  codeMinimap: elements.sourceMinimap,\n  chatContextKind: detachedFileContextKind,\n  chatContextName: detachedFileContextName,\n  statusLanguage: elements.statusLanguage,",
  "  codeMinimap: elements.sourceMinimap,\n  statusLanguage: elements.statusLanguage,",
  "detached editor context options"
);
write("js/main.js", main);

let architecture = read("scripts/check-architecture.mjs");
const requiredIdsBlock = `const requiredIds = [
  "app", "restrictedModeBanner", "titleBar", "titleBarBrand", "navigationControls",
  "commandCenter", "layoutControls", "activityBar", "primarySidebar", "explorerView",
  "workspaceTree", "workbench", "editorPanel", "editorTabs", "editorViewport",
  "canvasView", "canvasViewport", "canvasWorld", "canvasOverlay", "sourceEditorView",
  "sourceEditor", "bottomPanel", "notificationLayer", "statusBar",
  "togglePrimarySidebarBtn", "toggleBottomPanelBtn", "returnToOriginBtn",
  "resetCanvasBtn", "resetWorkspaceBtn", "activityMenuBtn", "activityExplorerBtn",
  "activitySearchBtn", "activityExtensionsBtn", "activityGitHubBtn", "activityAccountBtn",
  "activitySettingsBtn", "workspaceDisclosureBtn", "newFileBtn", "newFolderBtn",
  "refreshExplorerBtn", "canvasControlsTabBtn", "infiniteCanvasTabBtn", "componentsTabBtn",
  "canvasTab", "fileTabs", "editorBreadcrumbKind", "editorBreadcrumbName", "splitEditorBtn",
  "editorActionsBtn", "problemsTabBtn", "outputTabBtn", "debugConsoleTabBtn",
  "terminalTabBtn", "portsTabBtn", "newTerminalBtn", "splitTerminalBtn", "killTerminalBtn",
  "maximizeBottomPanelBtn", "closeBottomPanelBtn"
];`;
const requiredIdsPattern = /const requiredIds = \[[\s\S]*?\n\];/;
if (!requiredIdsPattern.test(architecture)) throw new Error("Missing architecture requiredIds block");
architecture = architecture.replace(requiredIdsPattern, requiredIdsBlock);
architecture = replaceRequired(
  architecture,
  "const missingRequiredIds = requiredIds.filter((id) => !idSet.has(id));\nassert(missingRequiredIds.length === 0, \"Missing recommended IDs: \" + missingRequiredIds.join(\", \"));",
  "const missingRequiredIds = requiredIds.filter((id) => !idSet.has(id));\nassert(missingRequiredIds.length === 0, \"Missing recommended IDs: \" + missingRequiredIds.join(\", \"));\nfor (const removedId of [\"secondarySidebar\", \"toggleSecondarySidebarBtn\", \"chatView\", \"chatPromptInput\", \"sendChatMessageBtn\"]) {\n  assert(!idSet.has(removedId), \"Removed Secondary Sidebar ID returned: \" + removedId);\n}",
  "architecture missing-ID assertion"
);
write("scripts/check-architecture.mjs", architecture);

const normalWorkflow = `name: CREED CI

on:
  push:
    branches: [main]
  pull_request:

permissions:
  contents: read

jobs:
  validate:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - name: Check out repository
        uses: actions/checkout@v4
      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22
      - name: Run architecture and behavior checks
        run: npm run check
`;
write(".github/workflows/ci.yml", normalWorkflow);

unlinkSync(fileURLToPath(import.meta.url));
console.log("Finalized Secondary Sidebar source removal and restored normal CI workflow.");
