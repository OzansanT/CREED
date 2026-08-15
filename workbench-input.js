import { WORKSPACE_FILES } from "./source-files.js?v=20260815-3";
import { createEditorTabs } from "./editor-tabs.js?v=20260815-3";

function getFileExtension(fileName) {
  return fileName.split(".").pop()?.toLowerCase() || "";
}

function getFileKind(fileName) {
  const extension = getFileExtension(fileName);
  if (extension === "css") return "#";
  if (extension === "js") return "JS";
  if (extension === "html") return "<>";
  if (extension === "md") return "◆";
  return "•";
}

function getLanguageLabel(fileName) {
  const extension = getFileExtension(fileName);
  if (extension === "css") return "{ } CSS";
  if (extension === "js") return "{ } JavaScript";
  if (extension === "html") return "<> HTML";
  if (extension === "md") return "◆ Markdown";
  return "Plain Text";
}

function createFileButton(fileName) {
  const button = document.createElement("button");
  const icon = document.createElement("span");
  const extension = getFileExtension(fileName);

  button.className = "file-row";
  button.type = "button";
  button.dataset.file = fileName;
  button.setAttribute("role", "option");
  button.setAttribute("aria-selected", "false");

  icon.className = "file-icon " + (extension || "file");
  icon.textContent = getFileKind(fileName);
  button.append(icon, document.createTextNode(fileName));
  return button;
}

function renderFileTree(fileTree) {
  const fragment = document.createDocumentFragment();
  WORKSPACE_FILES.forEach((fileName) => fragment.append(createFileButton(fileName)));
  fileTree.replaceChildren(fragment);
  return [...fileTree.querySelectorAll(".file-row[data-file]")];
}

const TOKEN_PATTERNS = Object.freeze({
  js: /(\/\/.*$|\/\*.*?\*\/|\x60(?:\\.|[^\x60])*\x60|"(?:\\.|[^"])*"|'(?:\\.|[^'])*'|\b(?:import|from|export|function|return|const|let|var|if|else|for|while|class|new|try|catch|finally|throw|async|await|true|false|null|undefined)\b|\b\d+(?:\.\d+)?\b)/g,
  css: /(\/\*.*?\*\/|"(?:\\.|[^"])*"|'(?:\\.|[^'])*'|#[0-9a-fA-F]{3,8}\b|--[\w-]+|[.#]?-?[\w-]+(?=\s*\{)|\b[a-z-]+(?=\s*:)|-?\b\d+(?:\.\d+)?(?:px|%|em|rem|vh|vw|s|ms)?\b)/g,
  html: /(<!--.*?-->|<!DOCTYPE[^>]*>|<\/?[A-Za-z][^>]*>|&[A-Za-z0-9#]+;)/gi,
  md: /(^#{1,6}\s.*$|\x60[^\x60]+\x60|\*\*[^*]+\*\*)/g
});

function getTokenClass(token, extension) {
  if (token.startsWith("//") || token.startsWith("/*") || token.startsWith("<!--")) {
    return "syntax-comment";
  }
  if (/^["'\x60]/.test(token)) return "syntax-string";

  if (extension === "js") {
    if (/^\d/.test(token)) return "syntax-number";
    return "syntax-keyword";
  }

  if (extension === "css") {
    if (/^#[0-9a-fA-F]{3,8}$/.test(token)) return "syntax-color";
    if (/^-?\d/.test(token)) return "syntax-number";
    if (/^[.#]/.test(token)) return "syntax-selector";
    return "syntax-property";
  }

  if (extension === "html") {
    if (token.startsWith("&")) return "syntax-entity";
    return "syntax-tag";
  }

  if (extension === "md") {
    if (token.startsWith("#")) return "syntax-heading";
    return "syntax-code";
  }

  return "";
}

function appendHighlightedCode(line, target, extension) {
  const pattern = TOKEN_PATTERNS[extension];
  if (!pattern || !line) {
    target.textContent = line || " ";
    return;
  }

  pattern.lastIndex = 0;
  let cursor = 0;

  for (const match of line.matchAll(pattern)) {
    if (match.index > cursor) {
      target.append(document.createTextNode(line.slice(cursor, match.index)));
    }

    const token = document.createElement("span");
    token.className = getTokenClass(match[0], extension);
    token.textContent = match[0];
    target.append(token);
    cursor = match.index + match[0].length;
  }

  if (cursor < line.length) {
    target.append(document.createTextNode(line.slice(cursor)));
  }
  if (!target.hasChildNodes()) target.textContent = " ";
}

function renderCode(source, target, minimap, fileName) {
  const codeFragment = document.createDocumentFragment();
  const minimapLines = document.createElement("div");
  const minimapViewport = document.createElement("div");
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const extension = getFileExtension(fileName);

  minimapLines.className = "source-minimap__lines";
  minimapLines.style.gridTemplateRows = "repeat(" + lines.length + ", minmax(0, 1fr))";
  minimapViewport.className = "source-minimap__viewport";

  lines.forEach((line, index) => {
    const row = document.createElement("div");
    const number = document.createElement("span");
    const code = document.createElement("span");
    const minimapLine = document.createElement("div");

    row.className = "source-line";
    number.className = "source-line__number";
    number.textContent = String(index + 1);
    code.className = "source-line__code";
    appendHighlightedCode(line, code, extension);

    minimapLine.className = "minimap-line " + extension;
    minimapLine.style.width = Math.min(94, Math.max(4, line.trim().length * 0.72)) + "px";

    row.append(number, code);
    codeFragment.append(row);
    minimapLines.append(minimapLine);
  });

  target.replaceChildren(codeFragment);
  minimap.replaceChildren(minimapLines, minimapViewport);
}

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
  const fileButtons = renderFileTree(fileTree);
  const sourceCache = new Map();
  const requestControllers = new Map();
  let activeFile = "";
  let activeMinimapPointer = null;

  function setExplorerExpanded(expanded) {
    rootToggle.setAttribute("aria-expanded", String(expanded));
    rootToggle.title = expanded ? "Collapse CREED files" : "Expand CREED files";
    fileTree.hidden = !expanded;
  }

  function setSelectedFile(fileName) {
    fileButtons.forEach((button) => {
      const selected = button.dataset.file === fileName;
      button.classList.toggle("selected", selected);
      button.setAttribute("aria-selected", String(selected));
    });
  }

  function setFileContext(kind, name, language) {
    breadcrumbKind.textContent = kind;
    breadcrumbName.textContent = name;
    chatContextKind.textContent = kind;
    chatContextName.textContent = name;
    statusLanguage.textContent = language;
  }

  function updateMinimapViewport() {
    const viewport = codeMinimap.querySelector(".source-minimap__viewport");
    const maximum = Math.max(0, sourceScroller.scrollHeight - sourceScroller.clientHeight);
    const viewportRatio = sourceScroller.scrollHeight > 0
      ? Math.min(1, sourceScroller.clientHeight / sourceScroller.scrollHeight)
      : 1;
    const viewportHeight = Math.max(18, codeMinimap.clientHeight * viewportRatio);
    const availableTravel = Math.max(0, codeMinimap.clientHeight - viewportHeight);
    const scrollRatio = maximum > 0 ? sourceScroller.scrollTop / maximum : 0;

    if (viewport) {
      viewport.style.height = viewportHeight + "px";
      viewport.style.transform = "translateY(" + (availableTravel * scrollRatio) + "px)";
    }
    codeMinimap.setAttribute("aria-valuenow", String(Math.round(scrollRatio * 100)));
  }

  function showCanvasPanel() {
    activeFile = "";
    canvasView.hidden = false;
    codeView.hidden = true;
    setSelectedFile("");
    setFileContext("◇", "Infinite Canvas", "{ } Canvas");
    onCanvasShow?.();
  }

  function showLoading(fileName) {
    if (activeFile !== fileName) return;
    codeContent.setAttribute("aria-busy", "true");
    codeContent.textContent = "Loading…";
    codeMinimap.replaceChildren();
  }

  function renderActiveFile(fileName) {
    if (activeFile !== fileName || !sourceCache.has(fileName)) return;
    codeContent.removeAttribute("aria-busy");
    renderCode(sourceCache.get(fileName), codeContent, codeMinimap, fileName);
    sourceScroller.scrollTo({ top: 0, left: 0 });
    requestAnimationFrame(updateMinimapViewport);
  }

  async function loadFile(fileName) {
    if (sourceCache.has(fileName)) {
      renderActiveFile(fileName);
      return;
    }
    if (requestControllers.has(fileName)) {
      showLoading(fileName);
      return;
    }

    const requestController = new AbortController();
    requestControllers.set(fileName, requestController);
    showLoading(fileName);

    try {
      const filePath = fileName.split("/").map(encodeURIComponent).join("/");
      const response = await fetch("./" + filePath, {
        cache: "no-store",
        signal: requestController.signal
      });
      if (!response.ok) throw new Error("Unable to load " + fileName + " (" + response.status + ")");
      const source = await response.text();
      if (requestControllers.get(fileName) !== requestController) return;
      sourceCache.set(fileName, source);
      renderActiveFile(fileName);
    } catch (error) {
      if (error.name === "AbortError") return;
      if (activeFile === fileName) {
        codeContent.removeAttribute("aria-busy");
        codeContent.textContent = "Unable to display " + fileName + ".";
        codeMinimap.replaceChildren();
      }
      onError?.(error.message);
    } finally {
      if (requestControllers.get(fileName) === requestController) {
        requestControllers.delete(fileName);
      }
      if (activeFile === fileName) codeContent.removeAttribute("aria-busy");
    }
  }

  function showFilePanel(fileName) {
    activeFile = fileName;
    canvasView.hidden = true;
    codeView.hidden = false;
    setSelectedFile(fileName);

    const fileKind = getFileKind(fileName);
    setFileContext(fileKind, fileName, getLanguageLabel(fileName));

    if (sourceCache.has(fileName)) renderActiveFile(fileName);
    else loadFile(fileName);
  }

  const tabs = createEditorTabs({
    container: fileTabs,
    canvasTab,
    codeView,
    onActivate: (fileName) => {
      if (fileName) showFilePanel(fileName);
      else showCanvasPanel();
    },
    onClose: (fileName) => {
      requestControllers.get(fileName)?.abort();
      requestControllers.delete(fileName);
      sourceCache.delete(fileName);
    }
  });

  fileButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const fileName = button.dataset.file;
      if (fileName) tabs.open(fileName, getFileKind(fileName));
    });
  });

  rootToggle.addEventListener("click", () => {
    setExplorerExpanded(rootToggle.getAttribute("aria-expanded") !== "true");
  });

  function scrollFromMinimapPointer(event) {
    const bounds = codeMinimap.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height));
    const maximum = Math.max(0, sourceScroller.scrollHeight - sourceScroller.clientHeight);
    sourceScroller.scrollTop = ratio * maximum;
  }

  codeMinimap.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    activeMinimapPointer = event.pointerId;
    codeMinimap.setPointerCapture?.(event.pointerId);
    scrollFromMinimapPointer(event);
  });
  codeMinimap.addEventListener("pointermove", (event) => {
    if (event.pointerId !== activeMinimapPointer) return;
    scrollFromMinimapPointer(event);
  });

  function finishMinimapPointer(event) {
    if (event.pointerId !== activeMinimapPointer) return;
    activeMinimapPointer = null;
  }

  codeMinimap.addEventListener("pointerup", finishMinimapPointer);
  codeMinimap.addEventListener("pointercancel", finishMinimapPointer);
  codeMinimap.addEventListener("lostpointercapture", finishMinimapPointer);
  codeMinimap.addEventListener("keydown", (event) => {
    const maximum = Math.max(0, sourceScroller.scrollHeight - sourceScroller.clientHeight);
    const step = Math.max(40, sourceScroller.clientHeight * 0.1);
    const next = {
      ArrowUp: sourceScroller.scrollTop - step,
      ArrowDown: sourceScroller.scrollTop + step,
      PageUp: sourceScroller.scrollTop - sourceScroller.clientHeight,
      PageDown: sourceScroller.scrollTop + sourceScroller.clientHeight,
      Home: 0,
      End: maximum
    }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    sourceScroller.scrollTop = next;
  });
  sourceScroller.addEventListener("scroll", updateMinimapViewport, { passive: true });

  setExplorerExpanded(true);
  showCanvasPanel();

  return Object.freeze({
    showCanvas: tabs.showCanvas,
    showCode: () => {
      const fileName = tabs.getActiveFile();
      if (fileName) tabs.activate(fileName);
    }
  });
}
