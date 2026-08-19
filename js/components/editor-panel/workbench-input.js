import { createEditorSessionStore } from "./editor-session-state.js";
import { createEditorTabs } from "./editor-tabs.js";
import { createExplorerController } from "./explorer-controller.js";
import { getFileKind, getLanguageLabel } from "./file-metadata.js";
import { createMinimapController } from "./minimap-controller.js";
import { createSourceLoader } from "./source-loader.js";
import { bindSourceNavigation } from "./source-navigation.js";
import { createSourceViewport } from "./source-viewport.js";

export function bindWorkbenchFiles({
  rootToggle,
  fileTree,
  fileTabs,
  canvasTab,
  breadcrumbKind,
  breadcrumbName,
  canvasView,
  codeView,
  sourceScroller,
  codeContent,
  codeMinimap,
  chatContextKind,
  chatContextName,
  statusLanguage,
  onCanvasShow,
  onError
}) {
  let activeFile = "";
  let baseStatusLanguage = "{ } Canvas";
  let tabs = null;

  function setNavigationStatus(status) {
    statusLanguage.textContent = status ? baseStatusLanguage + " · " + status : baseStatusLanguage;
  }

  function setFileContext(kind, name, language) {
    baseStatusLanguage = language;
    breadcrumbKind.textContent = kind;
    breadcrumbName.textContent = name;
    chatContextKind.textContent = kind;
    chatContextName.textContent = name;
    setNavigationStatus("");
  }

  const minimap = createMinimapController({ minimap: codeMinimap, scroller: sourceScroller });
  const sourceViewport = createSourceViewport({ target: codeContent, minimap: codeMinimap, scroller: sourceScroller });
  const sourceNavigation = bindSourceNavigation({
    host: sourceScroller.parentElement,
    viewport: sourceViewport,
    isSourceActive: () => Boolean(activeFile) && !codeView.hidden,
    getActiveFile: () => activeFile,
    onStatus: setNavigationStatus
  });
  const sessions = createEditorSessionStore();
  const explorer = createExplorerController({
    rootToggle,
    fileTree,
    onOpen: (fileName) => tabs?.open(fileName, getFileKind(fileName))
  });

  function captureActiveSession() {
    if (!activeFile || !sourceViewport.isReady()) return null;
    return sessions.save(activeFile, {
      viewport: {
        scrollTop: sourceScroller.scrollTop,
        scrollLeft: sourceScroller.scrollLeft
      },
      navigation: sourceNavigation.getSessionState()
    });
  }

  async function restoreFileSession(fileName) {
    const session = sessions.get(fileName);
    if (!session) {
      sourceScroller.scrollTop = 0;
      sourceScroller.scrollLeft = 0;
      return true;
    }

    await sourceNavigation.restoreSessionState(session.navigation);
    if (activeFile !== fileName) return false;
    sourceScroller.scrollTop = session.viewport.scrollTop;
    sourceScroller.scrollLeft = session.viewport.scrollLeft;
    sourceViewport.refresh();
    return true;
  }

  function showCanvasPanel() {
    captureActiveSession();
    sourceNavigation.reset();
    activeFile = "";
    sourceViewport.clear();
    codeContent.removeAttribute("aria-busy");
    canvasView.hidden = false;
    codeView.hidden = true;
    explorer.setSelected("");
    setFileContext("◇", "Infinite Canvas", "{ } Canvas");
    onCanvasShow?.();
  }

  async function renderLoadedFile(fileName, source) {
    if (activeFile !== fileName) return;
    codeContent.setAttribute("aria-busy", "true");
    codeContent.textContent = "Indexing…";
    sourceScroller.scrollTop = 0;
    sourceScroller.scrollLeft = 0;
    try {
      const rendered = await sourceViewport.setSource({ source, fileName });
      if (!rendered || activeFile !== fileName) return;
      const restored = await restoreFileSession(fileName);
      if (!restored || activeFile !== fileName) return;
      codeContent.removeAttribute("aria-busy");
      requestAnimationFrame(() => {
        sourceViewport.refresh();
        minimap.updateViewport();
      });
    } catch (error) {
      if (activeFile !== fileName) return;
      sourceNavigation.reset();
      sourceViewport.clear();
      codeContent.removeAttribute("aria-busy");
      codeContent.textContent = "Unable to index " + fileName + ".";
      onError?.(error instanceof Error ? error.message : String(error));
    }
  }

  const sourceLoader = createSourceLoader({
    onLoading: (fileName) => {
      if (activeFile !== fileName) return;
      sourceNavigation.reset();
      sourceViewport.clear();
      sourceScroller.scrollTop = 0;
      sourceScroller.scrollLeft = 0;
      codeContent.setAttribute("aria-busy", "true");
      codeContent.textContent = "Loading…";
    },
    onLoaded: renderLoadedFile,
    onError: (fileName, message) => {
      if (activeFile === fileName) {
        sourceNavigation.reset();
        sourceViewport.clear();
        codeContent.removeAttribute("aria-busy");
        codeContent.textContent = "Unable to display " + fileName + ".";
      }
      onError?.(message);
    }
  });

  function showFilePanel(fileName) {
    if (activeFile === fileName && !codeView.hidden) return;
    captureActiveSession();
    sourceNavigation.reset();
    activeFile = fileName;
    sourceViewport.clear();
    sourceScroller.scrollTop = 0;
    sourceScroller.scrollLeft = 0;
    canvasView.hidden = true;
    codeView.hidden = false;
    explorer.setSelected(fileName);
    setFileContext(getFileKind(fileName), fileName, getLanguageLabel(fileName));
    if (sourceLoader.has(fileName)) renderLoadedFile(fileName, sourceLoader.get(fileName));
    else sourceLoader.load(fileName);
  }

  tabs = createEditorTabs({
    container: fileTabs,
    canvasTab,
    codeView,
    onActivate: (fileName) => fileName ? showFilePanel(fileName) : showCanvasPanel(),
    onClose: (fileName) => {
      if (activeFile === fileName) {
        sourceNavigation.reset();
        activeFile = "";
        sourceViewport.clear();
        codeContent.removeAttribute("aria-busy");
      }
      sessions.remove(fileName);
      sourceLoader.release(fileName);
      sourceViewport.release(fileName);
    }
  });

  showCanvasPanel();
  return Object.freeze({
    showCanvas: tabs.showCanvas,
    showCode: () => {
      const fileName = tabs.getActiveFile();
      if (fileName) tabs.activate(fileName);
    }
  });
}
