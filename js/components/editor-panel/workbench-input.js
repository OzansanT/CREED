import { createEditorTabs } from "./editor-tabs.js";
import { createExplorerController } from "./explorer-controller.js";
import { getFileKind, getLanguageLabel } from "./file-metadata.js";
import { createMinimapController } from "./minimap-controller.js";
import { createSourceLoader } from "./source-loader.js";
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
  let tabs = null;

  function setFileContext(kind, name, language) {
    breadcrumbKind.textContent = kind;
    breadcrumbName.textContent = name;
    chatContextKind.textContent = kind;
    chatContextName.textContent = name;
    statusLanguage.textContent = language;
  }

  const minimap = createMinimapController({
    minimap: codeMinimap,
    scroller: sourceScroller
  });

  const sourceViewport = createSourceViewport({
    target: codeContent,
    minimap: codeMinimap,
    scroller: sourceScroller
  });

  const explorer = createExplorerController({
    rootToggle,
    fileTree,
    onOpen: (fileName) => tabs?.open(fileName, getFileKind(fileName))
  });

  function showCanvasPanel() {
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
      codeContent.removeAttribute("aria-busy");
      requestAnimationFrame(() => {
        sourceViewport.refresh();
        minimap.updateViewport();
      });
    } catch (error) {
      if (activeFile !== fileName) return;
      sourceViewport.clear();
      codeContent.removeAttribute("aria-busy");
      codeContent.textContent = "Unable to index " + fileName + ".";
      onError?.(error instanceof Error ? error.message : String(error));
    }
  }

  const sourceLoader = createSourceLoader({
    onLoading: (fileName) => {
      if (activeFile !== fileName) return;
      sourceViewport.clear();
      codeContent.setAttribute("aria-busy", "true");
      codeContent.textContent = "Loading…";
    },
    onLoaded: renderLoadedFile,
    onError: (fileName, message) => {
      if (activeFile === fileName) {
        sourceViewport.clear();
        codeContent.removeAttribute("aria-busy");
        codeContent.textContent = "Unable to display " + fileName + ".";
      }
      onError?.(message);
    }
  });

  function showFilePanel(fileName) {
    activeFile = fileName;
    sourceViewport.clear();
    canvasView.hidden = true;
    codeView.hidden = false;
    explorer.setSelected(fileName);
    setFileContext(getFileKind(fileName), fileName, getLanguageLabel(fileName));

    if (sourceLoader.has(fileName)) {
      renderLoadedFile(fileName, sourceLoader.get(fileName));
    } else {
      sourceLoader.load(fileName);
    }
  }

  tabs = createEditorTabs({
    container: fileTabs,
    canvasTab,
    codeView,
    onActivate: (fileName) => {
      if (fileName) showFilePanel(fileName);
      else showCanvasPanel();
    },
    onClose: (fileName) => {
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
