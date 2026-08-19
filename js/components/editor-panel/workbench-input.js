import { createEditorTabs } from "./editor-tabs.js";
import { createExplorerController } from "./explorer-controller.js";
import { getFileKind, getLanguageLabel } from "./file-metadata.js";
import { createMinimapController } from "./minimap-controller.js";
import { createSourceLoader } from "./source-loader.js";
import { renderSourceCode } from "./source-renderer.js";

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

  const explorer = createExplorerController({
    rootToggle,
    fileTree,
    onOpen: (fileName) => tabs?.open(fileName, getFileKind(fileName))
  });

  function showCanvasPanel() {
    activeFile = "";
    canvasView.hidden = false;
    codeView.hidden = true;
    explorer.setSelected("");
    setFileContext("◇", "Infinite Canvas", "{ } Canvas");
    onCanvasShow?.();
  }

  function renderLoadedFile(fileName, source) {
    if (activeFile !== fileName) return;
    codeContent.removeAttribute("aria-busy");
    renderSourceCode({
      source,
      target: codeContent,
      minimap: codeMinimap,
      fileName
    });
    sourceScroller.scrollTo({ top: 0, left: 0 });
    requestAnimationFrame(minimap.updateViewport);
  }

  const sourceLoader = createSourceLoader({
    onLoading: (fileName) => {
      if (activeFile !== fileName) return;
      codeContent.setAttribute("aria-busy", "true");
      codeContent.textContent = "Loading…";
      codeMinimap.replaceChildren();
    },
    onLoaded: renderLoadedFile,
    onError: (fileName, message) => {
      if (activeFile === fileName) {
        codeContent.removeAttribute("aria-busy");
        codeContent.textContent = "Unable to display " + fileName + ".";
        codeMinimap.replaceChildren();
      }
      onError?.(message);
    },
    onSettled: (fileName) => {
      if (activeFile === fileName) codeContent.removeAttribute("aria-busy");
    }
  });

  function showFilePanel(fileName) {
    activeFile = fileName;
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
    onClose: sourceLoader.release
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
