import { getFileExtension } from "./source-language.js";

const KEYWORDS = new Set([
  "as", "async", "await", "break", "case", "catch", "class", "const", "continue", "default",
  "delete", "do", "else", "export", "extends", "false", "finally", "for", "from", "function",
  "if", "import", "in", "instanceof", "let", "new", "null", "of", "return", "static", "super",
  "switch", "this", "throw", "true", "try", "typeof", "undefined", "var", "while", "yield"
]);

function appendToken(segments, text, className = "") {
  if (text) segments.push({ text, className });
}

function tokenizeScriptLine(line, state) {
  const segments = [];
  let cursor = 0;
  while (cursor < line.length) {
    if (state.blockComment) {
      const end = line.indexOf("*/", cursor);
      if (end < 0) {
        appendToken(segments, line.slice(cursor), "syntax-comment");
        return segments;
      }
      appendToken(segments, line.slice(cursor, end + 2), "syntax-comment");
      state.blockComment = false;
      cursor = end + 2;
      continue;
    }
    if (line.startsWith("//", cursor)) {
      appendToken(segments, line.slice(cursor), "syntax-comment");
      break;
    }
    if (line.startsWith("/*", cursor)) {
      state.blockComment = true;
      continue;
    }
    const character = line[cursor];
    if (character === '"' || character === "'" || character === "`") {
      let end = cursor + 1;
      while (end < line.length) {
        if (line[end] === "\\") end += 2;
        else if (line[end] === character) { end += 1; break; }
        else end += 1;
      }
      appendToken(segments, line.slice(cursor, end), "syntax-string");
      cursor = end;
      continue;
    }
    const number = line.slice(cursor).match(/^-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/i);
    if (number) {
      appendToken(segments, number[0], "syntax-number");
      cursor += number[0].length;
      continue;
    }
    const word = line.slice(cursor).match(/^[A-Za-z_$][\w$]*/);
    if (word) {
      appendToken(segments, word[0], KEYWORDS.has(word[0]) ? "syntax-keyword" : "");
      cursor += word[0].length;
      continue;
    }
    appendToken(segments, character);
    cursor += 1;
  }
  return segments;
}

function tokenizeCssLine(line, state) {
  const segments = tokenizeScriptLine(line, state);
  return segments.flatMap((segment) => {
    if (segment.className) return segment;
    const tokens = [];
    let cursor = 0;
    const pattern = /(#[0-9a-fA-F]{3,8}\b|--[\w-]+|-?\d+(?:\.\d+)?(?:px|%|em|rem|vh|vw|s|ms)?\b|[a-z-]+(?=\s*:))/g;
    for (const match of segment.text.matchAll(pattern)) {
      appendToken(tokens, segment.text.slice(cursor, match.index));
      const value = match[0];
      const className = value.startsWith("#")
        ? "syntax-color"
        : /^-?\d/.test(value)
          ? "syntax-number"
          : "syntax-property";
      appendToken(tokens, value, className);
      cursor = match.index + value.length;
    }
    appendToken(tokens, segment.text.slice(cursor));
    return tokens;
  });
}

function tokenizeMarkupLine(line, state, markdown = false) {
  if (markdown) {
    const segments = [];
    const pattern = /(^#{1,6}\s.*$|`[^`]+`|\*\*[^*]+\*\*)/g;
    let cursor = 0;
    for (const match of line.matchAll(pattern)) {
      appendToken(segments, line.slice(cursor, match.index));
      appendToken(segments, match[0], match[0].startsWith("#") ? "syntax-heading" : "syntax-code");
      cursor = match.index + match[0].length;
    }
    appendToken(segments, line.slice(cursor));
    return segments;
  }
  const segments = [];
  let cursor = 0;
  while (cursor < line.length) {
    if (state.htmlComment) {
      const end = line.indexOf("-->", cursor);
      if (end < 0) {
        appendToken(segments, line.slice(cursor), "syntax-comment");
        return segments;
      }
      appendToken(segments, line.slice(cursor, end + 3), "syntax-comment");
      state.htmlComment = false;
      cursor = end + 3;
      continue;
    }
    if (line.startsWith("<!--", cursor)) {
      state.htmlComment = true;
      continue;
    }
    const tag = line.slice(cursor).match(/^<!DOCTYPE[^>]*>|^<\/?[A-Za-z][^>]*>/i);
    if (tag) {
      appendToken(segments, tag[0], "syntax-tag");
      cursor += tag[0].length;
      continue;
    }
    const entity = line.slice(cursor).match(/^&[A-Za-z0-9#]+;/);
    if (entity) {
      appendToken(segments, entity[0], "syntax-entity");
      cursor += entity[0].length;
      continue;
    }
    appendToken(segments, line[cursor]);
    cursor += 1;
  }
  return segments;
}

export function tokenizeSource(source, fileName) {
  const extension = getFileExtension(fileName);
  const state = { blockComment: false, htmlComment: false };
  return String(source).replace(/\r\n/g, "\n").split("\n").map((line) => {
    if (extension === "js" || extension === "mjs" || extension === "json") return tokenizeScriptLine(line, state);
    if (extension === "css") return tokenizeCssLine(line, state);
    if (extension === "html" || extension === "htm") return tokenizeMarkupLine(line, state);
    if (extension === "md") return tokenizeMarkupLine(line, state, true);
    return [{ text: line, className: "" }];
  });
}

function createLine(index, segments) {
  const row = document.createElement("div");
  row.className = "source-line";
  row.dataset.line = String(index + 1);
  const number = document.createElement("span");
  number.className = "source-line__number";
  number.textContent = String(index + 1);
  const code = document.createElement("span");
  code.className = "source-line__code";
  segments.forEach((segment) => {
    if (!segment.className) {
      code.append(document.createTextNode(segment.text));
      return;
    }
    const token = document.createElement("span");
    token.className = segment.className;
    token.textContent = segment.text;
    code.append(token);
  });
  if (!segments.length || !code.hasChildNodes()) code.textContent = " ";
  row.append(number, code);
  return row;
}

export function createVirtualSourceRenderer({
  scroller,
  target,
  minimap,
  minimapViewport,
  lineHeight = 19,
  overscan = 50
}) {
  let lines = [];
  let fileName = "";
  let lastWindow = "";

  function updateMinimapViewport() {
    const totalHeight = Math.max(scroller.scrollHeight, scroller.clientHeight, 1);
    const ratio = scroller.clientHeight / totalHeight;
    const travel = Math.max(0, minimap.clientHeight - minimap.clientHeight * ratio);
    const scrollRatio = scroller.scrollTop / Math.max(1, totalHeight - scroller.clientHeight);
    minimapViewport.style.height = Math.max(14, minimap.clientHeight * ratio) + "px";
    minimapViewport.style.transform = `translateY(${travel * scrollRatio}px)`;
  }

  function renderWindow(force = false) {
    const first = Math.max(0, Math.floor(scroller.scrollTop / lineHeight) - overscan);
    const count = Math.ceil(scroller.clientHeight / lineHeight) + overscan * 2;
    const last = Math.min(lines.length, first + count);
    const key = `${fileName}:${first}:${last}`;
    if (!force && key === lastWindow) {
      updateMinimapViewport();
      return;
    }
    lastWindow = key;
    const fragment = document.createDocumentFragment();
    const top = document.createElement("div");
    top.className = "source-virtual-spacer";
    top.style.height = first * lineHeight + "px";
    fragment.append(top);
    for (let index = first; index < last; index += 1) fragment.append(createLine(index, lines[index]));
    const bottom = document.createElement("div");
    bottom.className = "source-virtual-spacer";
    bottom.style.height = Math.max(0, (lines.length - last) * lineHeight) + "px";
    fragment.append(bottom);
    target.replaceChildren(fragment);
    updateMinimapViewport();
  }

  function renderMinimap(source) {
    const extension = getFileExtension(fileName);
    const fragment = document.createDocumentFragment();
    String(source).replace(/\r\n/g, "\n").split("\n").forEach((line) => {
      const minimapLine = document.createElement("div");
      minimapLine.className = "minimap-line " + extension;
      minimapLine.style.width = Math.min(94, Math.max(4, line.trim().length * 0.72)) + "px";
      fragment.append(minimapLine);
    });
    minimap.replaceChildren(fragment, minimapViewport);
  }

  scroller.addEventListener("scroll", () => renderWindow());
  minimap.addEventListener("pointerdown", (event) => {
    if (event.target === minimapViewport) return;
    const bounds = minimap.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientY - bounds.top) / Math.max(1, bounds.height)));
    scroller.scrollTop = ratio * Math.max(0, scroller.scrollHeight - scroller.clientHeight);
  });

  return Object.freeze({
    setSource(source, nextFileName, line = 1) {
      fileName = nextFileName;
      lines = tokenizeSource(source, fileName);
      renderMinimap(source);
      scroller.scrollTop = Math.max(0, (Number(line) - 1) * lineHeight);
      lastWindow = "";
      renderWindow(true);
    },
    goToLine(line, column = 1) {
      scroller.scrollTop = Math.max(0, (Math.max(1, Number(line)) - 1) * lineHeight);
      renderWindow(true);
      requestAnimationFrame(() => {
        const row = target.querySelector(`[data-line="${Math.max(1, Number(line))}"]`);
        row?.classList.add("source-line--target");
        setTimeout(() => row?.classList.remove("source-line--target"), 1200);
      });
      return { line: Math.max(1, Number(line)), column: Math.max(1, Number(column)) };
    },
    refresh: () => renderWindow(true),
    getLineCount: () => lines.length
  });
}
