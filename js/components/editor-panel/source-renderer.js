const TOKEN_PATTERNS = Object.freeze({
  js: /(\/\/.*$|\/\*.*?\*\/|\x60(?:\\.|[^\x60])*\x60|"(?:\\.|[^"])*"|'(?:\\.|[^'])*'|\b(?:import|from|export|function|return|const|let|var|if|else|for|while|switch|case|break|continue|class|extends|new|try|catch|finally|throw|async|await|yield|true|false|null|undefined|this|typeof|instanceof)\b|\b\d+(?:\.\d+)?\b)/g,
  css: /(\/\*.*?\*\/|"(?:\\.|[^"])*"|'(?:\\.|[^'])*'|#[0-9a-fA-F]{3,8}\b|--[\w-]+|[.#]?-?[\w-]+(?=\s*\{)|\b[a-z-]+(?=\s*:)|-?\b\d+(?:\.\d+)?(?:px|%|em|rem|vh|vw|s|ms)?\b)/g,
  html: /(<!--.*?-->|<!DOCTYPE[^>]*>|<\/?[A-Za-z][^>]*>|&[A-Za-z0-9#]+;)/gi,
  json: /("(?:\\.|[^"])*"(?=\s*:)|"(?:\\.|[^"])*"|\b(?:true|false|null)\b|-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b)/g,
  md: /(^#{1,6}\s.*$|\x60[^\x60]+\x60|\*\*[^*]+\*\*|\[[^\]]+\]\([^\)]+\))/g
});

function getTokenClass(token, extension) {
  if (token.startsWith("//") || token.startsWith("/*") || token.startsWith("<!--")) return "syntax-comment";
  if (extension === "json") {
    if (/^"/.test(token)) return /"\s*$/.test(token) ? "syntax-property" : "syntax-string";
    if (/^-?\d/.test(token)) return "syntax-number";
    return "syntax-keyword";
  }
  if (/^["'\x60]/.test(token)) return "syntax-string";
  if (extension === "js") return /^\d/.test(token) ? "syntax-number" : "syntax-keyword";
  if (extension === "css") {
    if (/^#[0-9a-fA-F]{3,8}$/.test(token)) return "syntax-color";
    if (/^-?\d/.test(token)) return "syntax-number";
    if (/^[.#]/.test(token)) return "syntax-selector";
    return "syntax-property";
  }
  if (extension === "html") return token.startsWith("&") ? "syntax-entity" : "syntax-tag";
  if (extension === "md") return token.startsWith("#") ? "syntax-heading" : "syntax-code";
  return "";
}

export function classifySourceTokens(text, extension) {
  const pattern = TOKEN_PATTERNS[extension];
  if (!pattern || !text) return [];
  pattern.lastIndex = 0;
  return [...text.matchAll(pattern)].map((match) => ({
    start: match.index,
    end: match.index + match[0].length,
    text: match[0],
    className: getTokenClass(match[0], extension)
  }));
}

function appendHighlightedCode(text, target, extension, ensureContent = true) {
  const tokens = classifySourceTokens(text, extension);
  if (!tokens.length) {
    if (text) target.append(document.createTextNode(text));
    else if (ensureContent && !target.hasChildNodes()) target.textContent = " ";
    return;
  }
  let cursor = 0;
  for (const item of tokens) {
    if (item.start > cursor) target.append(document.createTextNode(text.slice(cursor, item.start)));
    const token = document.createElement("span");
    token.className = item.className;
    token.textContent = item.text;
    target.append(token);
    cursor = item.end;
  }
  if (cursor < text.length) target.append(document.createTextNode(text.slice(cursor)));
  if (ensureContent && !target.hasChildNodes()) target.textContent = " ";
}

function isSameMatch(left, right) {
  return Boolean(left && right) && left.line === right.line && left.column === right.column && left.length === right.length;
}

function appendCodeWithSearchMatches(line, target, extension, matches, activeMatch) {
  if (!matches?.length) {
    appendHighlightedCode(line, target, extension);
    return;
  }
  let cursor = 0;
  for (const match of matches) {
    const start = Math.min(line.length, Math.max(cursor, match.column));
    const end = Math.min(line.length, Math.max(start, match.column + match.length));
    if (start > cursor) appendHighlightedCode(line.slice(cursor, start), target, extension, false);
    if (end > start) {
      const mark = document.createElement("mark");
      mark.className = "source-editor__search-match";
      if (isSameMatch(match, activeMatch)) {
        mark.classList.add("is-current");
        mark.setAttribute("aria-current", "true");
        const strong = document.createElement("strong");
        strong.textContent = line.slice(start, end);
        mark.append(strong);
      } else {
        mark.textContent = line.slice(start, end);
      }
      target.append(mark);
    }
    cursor = Math.max(cursor, end);
  }
  if (cursor < line.length) appendHighlightedCode(line.slice(cursor), target, extension, false);
  if (!target.hasChildNodes()) target.textContent = " ";
}

export function createSourceLineRow({ line, index, extension, searchMatches = [], activeSearchMatch = null }) {
  const row = document.createElement("div");
  const number = document.createElement("span");
  const code = document.createElement("span");
  row.className = "source-editor__line";
  row.dataset.lineNumber = String(index + 1);
  number.className = "source-editor__line-number";
  number.textContent = String(index + 1);
  code.className = "source-editor__line-code";
  appendCodeWithSearchMatches(line, code, extension, searchMatches, activeSearchMatch);
  row.append(number, code);
  return row;
}

export function createMinimapSample({ sample, extension }) {
  const element = document.createElement("div");
  element.className = "source-editor__minimap-line source-editor__minimap-line--" + extension;
  element.dataset.lineNumber = String(sample.index + 1);
  element.dataset.lineStart = String(sample.startLine + 1);
  element.dataset.lineEnd = String(sample.endLine + 1);
  element.style.width = sample.width + "px";
  return element;
}
