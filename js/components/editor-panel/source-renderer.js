import { getFileExtension } from "./file-metadata.js";

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

export function renderSourceCode({ source, target, minimap, fileName }) {
  const codeFragment = document.createDocumentFragment();
  const minimapLines = document.createElement("div");
  const minimapViewport = document.createElement("div");
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const extension = getFileExtension(fileName);

  minimapLines.className = "source-editor__minimap-lines";
  minimapLines.style.gridTemplateRows = "repeat(" + lines.length + ", minmax(0, 1fr))";
  minimapViewport.className = "source-editor__minimap-viewport";

  lines.forEach((line, index) => {
    const row = document.createElement("div");
    const number = document.createElement("span");
    const code = document.createElement("span");
    const minimapLine = document.createElement("div");

    row.className = "source-editor__line";
    row.dataset.lineNumber = String(index + 1);
    number.className = "source-editor__line-number";
    number.textContent = String(index + 1);
    code.className = "source-editor__line-code";
    appendHighlightedCode(line, code, extension);

    minimapLine.className = "source-editor__minimap-line source-editor__minimap-line--" + extension;
    minimapLine.dataset.lineNumber = String(index + 1);
    minimapLine.style.width = Math.min(94, Math.max(4, line.trim().length * 0.72)) + "px";

    row.append(number, code);
    codeFragment.append(row);
    minimapLines.append(minimapLine);
  });

  target.replaceChildren(codeFragment);
  minimap.replaceChildren(minimapLines, minimapViewport);
}
