import { replaceState, state } from "./state.js";
import { getElements } from "./elements.js";
import {
  flushStateSave,
  loadState,
  queueStateSave
} from "./storage.js";
import { updateUI } from "./ui.js";
import { showToast } from "./toast.js";
import { setZoomFromCenter, returnToOrigin, preserveCenterOnResize } from "./viewport.js";
import { setAnchor, goToAnchor, clearAnchor } from "./anchors.js";
import { bindPan } from "./pan-input.js";
import { bindWheel } from "./wheel-input.js";
import { bindKeyboard } from "./keyboard.js";
import { bindSidebarMenu } from "./sidebar-input.js";
import { bindPrimarySidebar } from "./primary-sidebar-input.js";
import { bindSecondarySidebar } from "./secondary-sidebar-input.js";
import { bindTerminalPanel } from "./terminal-panel-input.js";
import { bindPanelResize } from "./panel-resize-input.js";
import { bindResetControls } from "./reset-input.js";
import { bindCardDrag } from "./card-input.js";
import { bindWorkbenchFiles } from "./workbench-input.js";
import { createRenderScheduler } from "./render-scheduler.js";
import { createCommandEngine } from "./command-engine.js";
import { bindHistoryInput } from "./history-input.js";
import { createComponentRenderer } from "./component-renderer.js";
import { bindSelectionInput } from "./selection-input.js";
import { bindLassoInput } from "./lasso-input.js";
import { bindSelectionTransform } from "./selection-transform.js";
import { bindClipboardInput } from "./clipboard-input.js";
import { bindLayersPanel } from "./layers-input.js";
import { bindConnectionInput } from "./connection-input.js";
import { bindCanvasMinimap } from "./canvas-minimap.js";
import { bindCanvasNavigation } from "./canvas-navigation.js";
import { bindSavedViews } from "./saved-views-input.js";
import { bindInspector } from "./inspector-input.js";
import { bindComponentLibrary } from "./component-library-input.js";
import { bindTemplateInput } from "./template-input.js";
import { bindExportControls } from "./export-engine.js";
import { bindGroupInput } from "./group-input.js";
import { bindAlignmentInput } from "./alignment-input.js";
import { bindDesignTokenInput } from "./design-token-input.js";
import { rebaseWorldIfNeeded } from "./world-origin.js";
import { createExtensionHost } from "./extension-host.js";
import { bindPreviewRunner } from "./preview-runner.js";
import { bindBottomPanel } from "./bottom-panel.js";
import { bindContextualChat, createLocalWorkspaceAssistant } from "./contextual-chat.js";
import {
  bindActivityBar,
  createAccountView,
  createExtensionsView,
  createRunView,
  createSettingsView
} from "./activity-input.js";
import { createWorkspaceSearchView } from "./workspace-search.js";
import { createSourceControlView } from "./source-control.js";
import { createGitHubView } from "./github-workbench.js";
import { registerCoreExtension } from "./core-extension.js";
import { createSettingsStore } from "./settings-store.js";
import { bindI18n } from "./i18n.js";
import { createDurablePersistence } from "./durable-persistence.js";
import { createBackupManager } from "./backup-manager.js";
import { createLayoutPresets } from "./layout-presets.js";
import { bindPwa } from "./pwa-input.js";
import { bindAccessibility } from "./accessibility.js";
import { bindResponsiveLayout } from "./responsive-layout.js";
import { bindWorkspaceTrust } from "./workspace-trust.js";

const elements = getElements();
const settingsStore = createSettingsStore();
const extensionHost = createExtensionHost({ isTrusted: () => settingsStore.get().workspaceTrusted });
const i18n = bindI18n({ settingsStore });
bindWorkspaceTrust({
  settingsStore,
  banner: elements.trustBanner,
  bannerText: elements.trustBannerText,
  manageButton: elements.trustWorkspaceBtn,
  infoButton: elements.trustInfoBtn,
  statusButton: elements.statusTrust,
  dialog: elements.trustDialog,
  trustButton: elements.trustEnableBtn,
  restrictedButton: elements.trustKeepRestrictedBtn,
  notify: (message) => showToast(elements.toast, message)
});
const pwa = bindPwa({
  installButton: elements.installAppBtn,
  notify: (message) => showToast(elements.toast, message)
});
const featureUI = {};
const renderer = createRenderScheduler(() => updateUI(elements, state, featureUI));
const update = () => {
  rebaseWorldIfNeeded(state);
  renderer.schedule();
};
let durablePersistence = null;
const persist = () => {
  queueStateSave();
  durablePersistence?.queueDocument();
};
const commandEngine = createCommandEngine({ update, persist });
featureUI.componentRenderer = createComponentRenderer({
  layer: elements.componentLayer,
  state
});

function home() { returnToOrigin({ state, canvas: elements.canvas, update, persist }); showToast(elements.toast, "Returned to origin"); }
function saveAnchor() { setAnchor({ state, canvas: elements.canvas, update, persist }); showToast(elements.toast, "Anchor saved at current view"); }
function restoreAnchor() { const moved = goToAnchor({ state, canvas: elements.canvas, update, persist }); if (moved) showToast(elements.toast, "Returned to anchor"); }
function removeAnchor() { clearAnchor({ state, update, persist }); showToast(elements.toast, "Anchor cleared"); }
async function initializePosition() {
  const localRestored = loadState();
  let durableResult = { documentRestored: false };
  try {
    durableResult = await durablePersistence.start({ localDocumentLoaded: localRestored });
  } catch (error) {
    showToast(elements.toast, `Recovery restore failed: ${error.message}`);
  }
  if (!localRestored && !durableResult.documentRestored) {
    const center = {
      x: elements.canvas.clientWidth / 2,
      y: elements.canvas.clientHeight / 2
    };
    state.viewport.x = center.x;
    state.viewport.y = center.y;
    state.viewport.zoom = 1;
  }
  renderer.flush();
  return durableResult;
}

elements.zoomRange.addEventListener("input", () => setZoomFromCenter({ state, canvas: elements.canvas, nextZoom: Number(elements.zoomRange.value)/100, update, persist }));
elements.zoomInBtn.addEventListener("click", () => setZoomFromCenter({ state, canvas: elements.canvas, nextZoom: state.viewport.zoom + .10, update, persist }));
elements.zoomOutBtn.addEventListener("click", () => setZoomFromCenter({ state, canvas: elements.canvas, nextZoom: state.viewport.zoom - .10, update, persist }));
elements.setAnchorBtn.addEventListener("click", saveAnchor);
elements.goAnchorBtn.addEventListener("click", restoreAnchor);
elements.clearAnchorBtn.addEventListener("click", removeAnchor);
elements.homeBtn.addEventListener("click", home);
bindPan({ canvas: elements.canvas, state, update, persist });
bindWheel({ canvas: elements.canvas, state, update, persist });
const workbench = bindWorkbenchFiles({
  extensionHost,
  fileTree: elements.workspaceFileTree,
  newFileButton: elements.newWorkspaceFileBtn,
  newFolderButton: elements.newWorkspaceFolderBtn,
  refreshExplorerButton: elements.refreshExplorerBtn,
  moreExplorerButton: elements.moreExplorerActionsBtn,
  canvasTab: elements.workspaceCanvasTab,
  tabsContainer: elements.workspaceCodeTabs,
  breadcrumbKind: elements.workspaceBreadcrumbKind,
  breadcrumbName: elements.workspaceBreadcrumbName,
  canvasView: elements.canvasEditorView,
  codeView: elements.codeEditorView,
  previewView: elements.previewEditorView,
  codeContent: elements.sourceCode,
  editorInput: elements.sourceEditorInput,
  codeMinimap: elements.sourceMinimap,
  minimapViewport: elements.sourceMinimapViewport,
  chatContextKind: elements.chatContextKind,
  chatContextName: elements.chatContextName,
  statusLanguage: elements.statusLanguage,
  statusCursor: elements.statusCursor,
  statusIndentation: elements.statusIndentation,
  workspaceDirtyStatus: elements.workspaceDirtyStatus,
  previewModeButton: elements.editorPreviewModeBtn,
  editModeButton: elements.editorEditModeBtn,
  saveButton: elements.editorSaveBtn,
  runButton: elements.editorRunBtn,
  moreButton: elements.editorMoreBtn,
  backButton: elements.workbenchBackBtn,
  forwardButton: elements.workbenchForwardBtn,
  findBar: elements.editorFindBar,
  findInput: elements.editorFindInput,
  replaceInput: elements.editorReplaceInput,
  findPreviousButton: elements.editorFindPreviousBtn,
  findNextButton: elements.editorFindNextBtn,
  replaceButton: elements.editorReplaceBtn,
  replaceAllButton: elements.editorReplaceAllBtn,
  findCount: elements.editorFindCount,
  findCloseButton: elements.editorFindCloseBtn,
  quickOpenDialog: elements.quickOpenDialog,
  quickOpenInput: elements.quickOpenInput,
  quickOpenResults: elements.quickOpenResults,
  quickOpenCloseButton: elements.quickOpenCloseBtn,
  commandCenterButton: elements.commandCenterBtn,
  commandCenterLabel: elements.commandCenterLabel,
  applicationMenuButton: elements.applicationMenuBtn,
  onCanvasShow: update,
  onError: (message) => showToast(elements.toast, message)
});
bindSidebarMenu({
  canvasButton: elements.canvasMenuBtn,
  infiniteCanvasButton: elements.infiniteCanvasMenuBtn,
  componentsButton: elements.componentsMenuBtn,
  layersButton: elements.layersMenuBtn,
  inspectorButton: elements.inspectorMenuBtn,
  addJsonCardButton: elements.addJsonCardBtn,
  canvas: elements.canvas,
  componentLayer: elements.componentLayer,
  showCanvas: workbench.showCanvas,
  state,
  commandEngine,
  update,
  persist
});
bindSelectionInput({ canvas: elements.canvas, state, commandEngine, update, persist });
bindCardDrag({
  layer: elements.componentLayer,
  state,
  commandEngine,
  verticalGuide: elements.verticalGuide,
  horizontalGuide: elements.horizontalGuide,
  update,
  persist
});
bindLassoInput({
  canvas: elements.canvas,
  overlay: elements.lassoRect,
  state,
  update,
  persist
});
bindSelectionTransform({
  layer: elements.selectionLayer,
  boundsElement: elements.selectionBounds,
  state,
  commandEngine,
  update
});
bindClipboardInput({ state, commandEngine, update, persist });
featureUI.layers = bindLayersPanel({
  list: elements.layersList,
  state,
  commandEngine,
  update,
  persist
});
featureUI.inspector = bindInspector({
  form: elements.inspectorForm,
  empty: elements.inspectorEmpty,
  previewButtons: elements.previewBreakpointButtons,
  state,
  commandEngine,
  update,
  persist
});
featureUI.designTokens = bindDesignTokenInput({
  form: elements.designTokenForm,
  state,
  commandEngine
});
featureUI.savedViews = bindSavedViews({
  list: elements.savedViewsList,
  addButton: elements.addSavedViewBtn,
  state,
  canvas: elements.canvas,
  update,
  persist
});
featureUI.minimap = bindCanvasMinimap({
  minimap: elements.canvasMinimap,
  content: elements.canvasMinimapContent,
  viewport: elements.canvasMinimapViewport,
  canvas: elements.canvas,
  state,
  update,
  persist
});
bindComponentLibrary({
  container: elements.componentLibrary,
  state,
  canvas: elements.canvas,
  commandEngine
});
bindTemplateInput({
  button: elements.addHeroTemplateBtn,
  state,
  canvas: elements.canvas,
  commandEngine
});
bindConnectionInput({
  button: elements.connectSelectedBtn,
  state,
  commandEngine,
  notify: (message) => showToast(elements.toast, message)
});
bindGroupInput({
  groupButton: elements.groupSelectedBtn,
  ungroupButton: elements.ungroupSelectedBtn,
  state,
  commandEngine,
  notify: (message) => showToast(elements.toast, message)
});
bindAlignmentInput({
  controls: elements.alignmentControls,
  state,
  commandEngine,
  notify: (message) => showToast(elements.toast, message)
});
bindCanvasNavigation({
  fitContentButton: elements.fitContentBtn,
  fitSelectionButton: elements.fitSelectionBtn,
  state,
  canvas: elements.canvas,
  update,
  persist,
  notify: (message) => showToast(elements.toast, message)
});
bindExportControls({
  htmlButton: elements.exportHtmlBtn,
  jsonButton: elements.exportJsonBtn,
  wordpressButton: elements.exportWordPressBtn,
  state
});
bindKeyboard({ onHome: home, onSetAnchor: saveAnchor, onGoAnchor: restoreAnchor });
bindHistoryInput({ engine: commandEngine });
let lastSize = { w: elements.canvas.clientWidth, h: elements.canvas.clientHeight };
let sidebarLayoutFrame = 0;

function scheduleViewportCenterPreservation() {
  cancelAnimationFrame(sidebarLayoutFrame);
  sidebarLayoutFrame = requestAnimationFrame(() => {
    lastSize = preserveCenterOnResize({ state, canvas: elements.canvas, oldSize: lastSize, update, persist });
  });
}

let panelResize = null;
let responsiveLayout = null;

function handlePanelVisibilityChange(source) {
  scheduleViewportCenterPreservation();
  panelResize?.persist();
  responsiveLayout?.handleChange(source);
  durablePersistence?.queue();
}

const primarySidebar = bindPrimarySidebar({
  app: elements.app,
  sidebar: elements.sidebar,
  layoutButton: elements.primarySidebarLayoutBtn,
  explorerButton: elements.explorerActivityBtn,
  explorerTitle: () => i18n.t("explorer"),
  onLayoutChange: () => handlePanelVisibilityChange("primary")
});
const secondarySidebar = bindSecondarySidebar({
  app: elements.app,
  panel: elements.chatPanel,
  layoutButton: elements.secondarySidebarLayoutBtn,
  onLayoutChange: () => handlePanelVisibilityChange("secondary")
});
const terminalPanel = bindTerminalPanel({
  workbench: elements.workbench,
  panel: elements.terminalPanel,
  layoutButton: elements.panelLayoutBtn,
  onLayoutChange: () => handlePanelVisibilityChange("terminal")
});
responsiveLayout = bindResponsiveLayout({
  app: elements.app,
  scrim: elements.overlayScrim,
  primaryController: primarySidebar,
  secondaryController: secondarySidebar,
  terminalController: terminalPanel,
  onLayoutChange: scheduleViewportCenterPreservation
});
panelResize = bindPanelResize({
  app: elements.app,
  workbench: elements.workbench,
  primaryPanel: elements.sidebar,
  secondaryPanel: elements.chatPanel,
  terminalPanel: elements.terminalPanel,
  primaryController: primarySidebar,
  secondaryController: secondarySidebar,
  terminalController: terminalPanel,
  primaryHandle: elements.primarySidebarResizeHandle,
  secondaryHandle: elements.secondarySidebarResizeHandle,
  terminalHandle: elements.terminalPanelResizeHandle,
  onLayoutChange: () => {
    scheduleViewportCenterPreservation();
    responsiveLayout.sync();
    durablePersistence?.queue();
  }
});

durablePersistence = createDurablePersistence({
  workspaceStore: workbench.store,
  getDocument: () => state,
  restoreDocument: (document) => { replaceState(document); update(); },
  getEditorSession: workbench.editor.getSession,
  restoreEditorSession: workbench.editor.restoreSession,
  settingsStore,
  getPanelLayout: panelResize.getState,
  restorePanelLayout: (layout) => { panelResize.applyLayout(layout, false); responsiveLayout.sync(); },
  notify: (message) => showToast(elements.toast, message)
});
workbench.setSessionChangeHandler(durablePersistence.queueSession);
const layoutPresets = createLayoutPresets({
  panelResize,
  settingsStore,
  notify: (message) => showToast(elements.toast, message)
});
const backupManager = createBackupManager({
  durablePersistence,
  update,
  onRestore: () => commandEngine.clear(),
  notify: (message) => showToast(elements.toast, message)
});

let previewRunner = null;
const bottomPanel = bindBottomPanel({
  store: workbench.store,
  extensionHost,
  tabs: elements.terminalTabs,
  views: {
    problems: elements.problemsPanelView,
    output: elements.outputPanelView,
    debug: elements.debugPanelView,
    terminal: elements.terminalBody,
    ports: elements.portsPanelView
  },
  problemsView: elements.problemsPanelView,
  outputView: elements.outputPanelView,
  debugView: elements.debugPanelView,
  debugOutput: elements.debugConsoleOutput,
  debugForm: elements.debugConsoleForm,
  debugInput: elements.debugConsoleInput,
  terminalOutput: elements.terminalOutput,
  terminalForm: elements.terminalForm,
  terminalInput: elements.terminalInput,
  terminalSessionSelect: elements.terminalSessionSelect,
  newTerminalButton: elements.newTerminalBtn,
  clearButton: elements.clearTerminalBtn,
  closeButton: elements.closeTerminalPanelBtn,
  terminalBranch: elements.terminalBranch,
  portsView: elements.portsPanelView,
  editor: workbench.editor,
  runPreview: () => previewRunner?.run(),
  closePanel: () => terminalPanel.setVisible(false),
  statusProblems: elements.statusProblems,
  statusWarnings: elements.statusWarnings,
  notify: (message) => showToast(elements.toast, message)
});
previewRunner = bindPreviewRunner({
  store: workbench.store,
  frame: elements.previewFrame,
  status: elements.previewStatus,
  refreshButton: elements.refreshPreviewBtn,
  openButton: elements.openPreviewWindowBtn,
  showPreview: workbench.editor.showPreview,
  notify: (message) => showToast(elements.toast, message),
  logOutput: bottomPanel.logOutput
});
workbench.setRunHandler(previewRunner.run);

const activityBar = bindActivityBar({
  explorerButton: elements.explorerActivityBtn,
  sidebarContent: elements.sidebarContent,
  activityPanel: elements.workbenchActivityPanel,
  title: elements.sidebarViewTitle,
  menuButton: elements.sidebarViewMenuBtn,
  ensureSidebarVisible: () => primarySidebar.setVisible(true),
  openCommands: workbench.quickOpen.open,
  views: {
    search: {
      button: elements.searchActivityBtn,
      title: () => i18n.t("search"),
      render: createWorkspaceSearchView({
        store: workbench.store,
        openFile: workbench.editor.openFile,
        notify: (message) => showToast(elements.toast, message)
      })
    },
    sourceControl: {
      button: elements.sourceControlActivityBtn,
      title: () => i18n.t("sourceControl"),
      render: createSourceControlView({
        store: workbench.store,
        openFile: workbench.editor.openFile,
        notify: (message) => showToast(elements.toast, message),
        logOutput: bottomPanel.logOutput
      })
    },
    run: {
      button: elements.runActivityBtn,
      title: () => i18n.t("run"),
      render: createRunView({
        runPreview: previewRunner.run,
        showPreview: workbench.editor.showPreview,
        showBottomView: bottomPanel.showView
      })
    },
    extensions: {
      button: elements.extensionsActivityBtn,
      title: () => i18n.t("extensions"),
      render: createExtensionsView({ extensionHost, openCommands: workbench.quickOpen.open })
    },
    github: {
      button: elements.githubActivityBtn,
      title: "GitHub",
      render: createGitHubView({ notify: (message) => showToast(elements.toast, message) })
    },
    account: {
      button: elements.accountActivityBtn,
      title: "Account",
      render: createAccountView({ store: workbench.store, notify: (message) => showToast(elements.toast, message) })
    },
    settings: {
      button: elements.settingsActivityBtn,
      title: () => i18n.t("settings"),
      render: createSettingsView({
        settingsStore,
        layoutPresets,
        backupManager,
        pwa,
        notify: (message) => showToast(elements.toast, message)
      })
    }
  }
});
settingsStore.subscribe(() => activityBar.refreshTitle());
if (location.hash === "#search") activityBar.show("search");

bindAccessibility({
  activityBar: elements.activityBar,
  sidebarTabs: elements.sidebarMenuTabs,
  editorTabs: elements.editorTabs,
  bottomTabs: elements.bottomPanelTabs,
  quickOpenDialog: elements.quickOpenDialog,
  announcer: elements.a11yAnnouncer
});

const workspaceAssistant = createLocalWorkspaceAssistant({
  store: workbench.store,
  getActiveFile: workbench.editor.getActiveFile,
  openFile: workbench.editor.openFile
});
bindContextualChat({
  messages: elements.chatMessages,
  form: elements.chatForm,
  input: elements.chatInput,
  newButton: elements.newChatBtn,
  clearButton: elements.clearChatBtn,
  closeButton: elements.closeChatBtn,
  assistant: workspaceAssistant,
  closePanel: () => secondarySidebar.setVisible(false),
  notify: (message) => showToast(elements.toast, message)
});

registerCoreExtension({
  extensionHost,
  workbench,
  preview: previewRunner,
  bottomPanel,
  activityBar,
  canvasState: state
}).catch((error) => showToast(elements.toast, `Core extension failed: ${error.message}`));

window.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === "`") {
    event.preventDefault();
    terminalPanel.toggle();
    if (terminalPanel.isVisible()) bottomPanel.terminal.focus();
  }
});
bindResetControls({
  canvasButton: elements.canvasResetBtn,
  infiniteButton: elements.infiniteResetBtn,
  state,
  canvas: elements.canvas,
  update,
  persist,
  commandEngine,
  beforeCanvasReset: () => durablePersistence.createRecovery("before-canvas-reset").catch(() => null),
  beforeInfiniteReset: () => durablePersistence.createRecovery("before-infinite-reset").catch(() => null),
  notify: (message) => showToast(elements.toast, message),
  onInfiniteReset: async () => {
    await durablePersistence.clearWorkspace();
    settingsStore.reset();
    primarySidebar.setVisible(true, false);
    secondarySidebar.setVisible(true, false);
    terminalPanel.setVisible(true, false);
    panelResize.reset(false);
    responsiveLayout.sync();
    durablePersistence.queue();
  }
});
window.addEventListener("resize", () => { lastSize = preserveCenterOnResize({ state, canvas: elements.canvas, oldSize: lastSize, update, persist }); });
window.addEventListener("pagehide", () => { flushStateSave(); durablePersistence.flush().catch(() => null); });
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") durablePersistence.flush().catch(() => null);
});
requestAnimationFrame(initializePosition);
