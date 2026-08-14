import { SOURCE_FILES } from "./source-files.js";

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
  const minimapFragment = document.createDocumentFragment();
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const extension = getFileExtension(fileName);

  lines.forEach((line, index) => {
    const row = document.createElement("div");
    row.className = "source-line";

    const number = document.createElement("span");
    number.className = "source-line__number";
    number.textContent = String(index + 1);

    const code = document.createElement("span");
    code.className = "source-line__code";
    appendHighlightedCode(line, code, extension);

    const minimapLine = document.createElement("div");
    minimapLine.className = "minimap-line " + extension;
    minimapLine.style.width = Math.min(94, Math.max(4, line.trim().length * 0.72)) + "px";

    row.append(number, code);
    codeFragment.append(row);
    minimapFragment.append(minimapLine);
  });

  target.replaceChildren(codeFragment);
  minimap.replaceChildren(minimapFragment);
}

export function bindWorkbenchFiles({
  fileButtons,
  canvasTab,
  codeTab,
  codeTabKind,
  codeTabName,
  breadcrumbKind,
  breadcrumbName,
  canvasView,
  codeView,
  codeContent,
  codeMinimap,
  chatContextKind,
  chatContextName,
  statusLanguage,
  onCanvasShow,
  onError
}) {
  let openedFile = "";
  let requestController = null;

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

  function showCanvas() {
    requestController?.abort();
    canvasView.hidden = false;
    codeView.hidden = true;
    canvasTab.classList.add("active");
    canvasTab.setAttribute("aria-selected", "true");
    codeTab.classList.remove("active");
    codeTab.setAttribute("aria-selected", "false");
    codeTab.hidden = true;
    setFileContext("◇", "Infinite Canvas", "{ } Canvas");
    setSelectedFile("");
    onCanvasShow?.();
  }

  function showCode() {
    if (!openedFile) return;
    canvasView.hidden = true;
    codeView.hidden = false;
    canvasTab.classList.remove("active");
    canvasTab.setAttribute("aria-selected", "false");
    codeTab.hidden = false;
    codeTab.classList.add("active");
    codeTab.setAttribute("aria-selected", "true");
  }

  async function openFile(button) {
    const fileName = button.dataset.file;
    if (!fileName) return;

    requestController?.abort();
    requestController = new AbortController();
    openedFile = fileName;
    setSelectedFile(fileName);

    const fileKind = getFileKind(fileName);
    codeTab.hidden = false;
    codeTabKind.textContent = fileKind;
    codeTabName.textContent = fileName;
    setFileContext(fileKind, fileName, getLanguageLabel(fileName));
    const fallbackSource = SOURCE_FILES[fileName];
    const hasFallback = typeof fallbackSource === "string";
    codeContent.setAttribute("aria-busy", "true");
    codeMinimap.replaceChildren();
    showCode();

    if (hasFallback) {
      renderCode(fallbackSource, codeContent, codeMinimap, fileName);
    } else {
      codeContent.textContent = "Loading…";
    }

    try {
      const response = await fetch("./" + encodeURIComponent(fileName), {
        cache: "no-store",
        signal: requestController.signal
      });
      if (!response.ok) throw new Error("Unable to load " + fileName + " (" + response.status + ")");
      renderCode(await response.text(), codeContent, codeMinimap, fileName);
    } catch (error) {
      if (error.name === "AbortError") return;
      if (!hasFallback) {
        codeContent.textContent = "Unable to display " + fileName + ".";
        onError?.(error.message);
      }
    } finally {
      codeContent.removeAttribute("aria-busy");
    }
  }

  fileButtons.forEach((button) => {
    button.addEventListener("click", () => openFile(button));
  });
  canvasTab.addEventListener("click", showCanvas);
  codeTab.addEventListener("click", showCode);
  codeMinimap.addEventListener("pointerdown", (event) => {
    const bounds = codeMinimap.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height));
    codeView.scrollTop = ratio * Math.max(0, codeView.scrollHeight - codeView.clientHeight);
  });

  return { showCanvas, showCode };
}
