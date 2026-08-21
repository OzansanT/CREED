const DEFAULT_TAB_SIZE = 2;
const OPENING_BRACKETS = "([{<";
const CLOSING_BRACKETS = ")]}>".slice(0, 4);
const QUOTES = "\"'`";

function clampOffset(text, value) {
  return Math.min(text.length, Math.max(0, Math.trunc(Number(value) || 0)));
}

function normalizeSelection(text, value = {}) {
  const anchor = clampOffset(text, value.anchor ?? value.start ?? 0);
  const head = clampOffset(text, value.head ?? value.end ?? anchor);
  return { anchor, head };
}

function selectionBounds(selection) {
  return { start: Math.min(selection.anchor, selection.head), end: Math.max(selection.anchor, selection.head) };
}

function normalizeSelections(text, values) {
  const seen = new Set();
  const result = [];
  for (const value of values || []) {
    const selection = normalizeSelection(text, value);
    const key = `${selection.anchor}:${selection.head}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(selection);
  }
  return result.length ? result.sort((a, b) => selectionBounds(a).start - selectionBounds(b).start) : [{ anchor: 0, head: 0 }];
}

export function offsetToPosition(text, offset) {
  const safe = clampOffset(text, offset);
  const before = text.slice(0, safe);
  const line = before.split("\n").length - 1;
  return { line, column: safe - (before.lastIndexOf("\n") + 1) };
}

export function positionToOffset(text, line, column) {
  const lines = text.split("\n");
  const safeLine = Math.min(lines.length - 1, Math.max(0, Math.trunc(Number(line) || 0)));
  const safeColumn = Math.min(lines[safeLine].length, Math.max(0, Math.trunc(Number(column) || 0)));
  let offset = 0;
  for (let index = 0; index < safeLine; index += 1) offset += lines[index].length + 1;
  return offset + safeColumn;
}

function lineRange(text, selection) {
  const { start, end } = selectionBounds(selection);
  return { start: offsetToPosition(text, start).line, end: offsetToPosition(text, end).line };
}

function lineIndent(text, offset) {
  const position = offsetToPosition(text, offset);
  const start = positionToOffset(text, position.line, 0);
  return (text.slice(start, offset).match(/^\s*/) || [""])[0];
}

function lineCommentToken(extension) {
  return ["js", "mjs", "cjs", "ts", "tsx", "jsx", "jsonc"].includes(extension) ? "//" : null;
}

function isEscaped(text, index) {
  let slashes = 0;
  for (let cursor = index - 1; cursor >= 0 && text[cursor] === "\\"; cursor -= 1) slashes += 1;
  return slashes % 2 === 1;
}

export function findMatchingDelimiter(text, offset) {
  if (!text) return null;
  let index = clampOffset(text, offset);
  let character = text[index];
  const isDelimiter = (value) => OPENING_BRACKETS.includes(value) || CLOSING_BRACKETS.includes(value) || QUOTES.includes(value);
  if (!isDelimiter(character) && index > 0) {
    index -= 1;
    character = text[index];
  }
  if (QUOTES.includes(character)) {
    for (let cursor = index + 1; cursor < text.length; cursor += 1) {
      if (text[cursor] === character && !isEscaped(text, cursor)) return { offset: index, matchOffset: cursor, character };
    }
    for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
      if (text[cursor] === character && !isEscaped(text, cursor)) return { offset: index, matchOffset: cursor, character };
    }
    return null;
  }
  const openingIndex = OPENING_BRACKETS.indexOf(character);
  const closingIndex = CLOSING_BRACKETS.indexOf(character);
  if (openingIndex >= 0) {
    const closing = CLOSING_BRACKETS[openingIndex];
    let depth = 0;
    for (let cursor = index; cursor < text.length; cursor += 1) {
      if (text[cursor] === character) depth += 1;
      if (text[cursor] === closing && --depth === 0) return { offset: index, matchOffset: cursor, character };
    }
  }
  if (closingIndex >= 0) {
    const opening = OPENING_BRACKETS[closingIndex];
    let depth = 0;
    for (let cursor = index; cursor >= 0; cursor -= 1) {
      if (text[cursor] === character) depth += 1;
      if (text[cursor] === opening && --depth === 0) return { offset: index, matchOffset: cursor, character };
    }
  }
  return null;
}

export function createEditorTextModel(initialText = "", { tabSize = DEFAULT_TAB_SIZE } = {}) {
  let text = String(initialText ?? "").replace(/\r\n?/g, "\n");
  let selections = [{ anchor: 0, head: 0 }];
  const indentUnit = " ".repeat(Math.max(1, Math.trunc(tabSize)));
  const getSelections = () => selections.map((selection) => ({ ...selection }));

  function setText(value, { preserveSelections = false } = {}) {
    text = String(value ?? "").replace(/\r\n?/g, "\n");
    selections = preserveSelections ? normalizeSelections(text, selections) : [{ anchor: 0, head: 0 }];
    return text;
  }

  function setSelections(values) {
    selections = normalizeSelections(text, values);
    return getSelections();
  }

  function setPrimarySelection(anchor, head = anchor, { keepSecondary = false } = {}) {
    const primary = normalizeSelection(text, { anchor, head });
    selections = keepSecondary ? normalizeSelections(text, [primary, ...selections.slice(1)]) : [primary];
    return { ...selections[0] };
  }

  function replaceSelections(insertionValue) {
    const insertion = String(insertionValue ?? "");
    const entries = selections.map((selection, index) => ({ ...selectionBounds(selection), index }));
    const nextHeads = new Map();
    for (const entry of [...entries].sort((a, b) => b.start - a.start)) {
      text = text.slice(0, entry.start) + insertion + text.slice(entry.end);
      nextHeads.set(entry.index, entry.start + insertion.length);
    }
    for (const entry of entries) {
      const shift = entries.filter((other) => other.start < entry.start)
        .reduce((sum, other) => sum + insertion.length - (other.end - other.start), 0);
      nextHeads.set(entry.index, nextHeads.get(entry.index) + shift);
    }
    selections = selections.map((_selection, index) => {
      const head = clampOffset(text, nextHeads.get(index));
      return { anchor: head, head };
    });
    return text;
  }

  function deleteDirection(direction) {
    selections = normalizeSelections(text, selections.map((selection) => {
      const { start, end } = selectionBounds(selection);
      if (start !== end) return selection;
      if (direction < 0 && start > 0) return { anchor: start - 1, head: start };
      if (direction > 0 && end < text.length) return { anchor: end, head: end + 1 };
      return selection;
    }));
    return replaceSelections("");
  }

  function transformLines(transform) {
    const affected = new Set();
    for (const selection of selections) {
      const range = lineRange(text, selection);
      for (let line = range.start; line <= range.end; line += 1) affected.add(line);
    }
    const positions = selections.map((selection) => ({ anchor: offsetToPosition(text, selection.anchor), head: offsetToPosition(text, selection.head) }));
    const lines = text.split("\n");
    for (const line of affected) lines[line] = transform(lines[line], line);
    text = lines.join("\n");
    selections = positions.map((selection) => ({
      anchor: positionToOffset(text, selection.anchor.line, selection.anchor.column),
      head: positionToOffset(text, selection.head.line, selection.head.column)
    }));
    return text;
  }

  function insertNewlineWithIndent() {
    const start = selectionBounds(selections[0]).start;
    const indent = lineIndent(text, start);
    const extra = /[\[{(:]$/.test(text.slice(0, start).trimEnd()) ? indentUnit : "";
    return replaceSelections("\n" + indent + extra);
  }

  function indentSelections({ outdent = false } = {}) {
    return transformLines((line) => {
      if (!outdent) return indentUnit + line;
      if (line.startsWith("\t")) return line.slice(1);
      const count = Math.min(indentUnit.length, (line.match(/^ +/) || [""])[0].length);
      return line.slice(count);
    });
  }

  function toggleLineComments(extension) {
    const token = lineCommentToken(extension);
    if (!token) return false;
    const affected = new Set();
    for (const selection of selections) {
      const range = lineRange(text, selection);
      for (let line = range.start; line <= range.end; line += 1) affected.add(line);
    }
    const lines = text.split("\n");
    const uncomment = [...affected].every((line) => lines[line].trimStart().startsWith(token));
    for (const line of affected) {
      lines[line] = uncomment ? lines[line].replace(/^(\s*)\/\/ ?/, "$1") : lines[line].replace(/^(\s*)/, "$1// ");
    }
    text = lines.join("\n");
    selections = normalizeSelections(text, selections);
    return text;
  }

  function addCursorVertical(delta) {
    const lineCount = text.split("\n").length;
    const next = [...selections];
    for (const selection of selections) {
      const position = offsetToPosition(text, selection.head);
      const targetLine = position.line + delta;
      if (targetLine < 0 || targetLine >= lineCount) continue;
      const offset = positionToOffset(text, targetLine, position.column);
      next.push({ anchor: offset, head: offset });
    }
    return setSelections(next);
  }

  function createColumnSelectionsFromPrimary() {
    const { start, end } = selectionBounds(selections[0]);
    const startPosition = offsetToPosition(text, start);
    const endPosition = offsetToPosition(text, end);
    if (startPosition.line === endPosition.line) return getSelections();
    const left = Math.min(startPosition.column, endPosition.column);
    const right = Math.max(startPosition.column, endPosition.column);
    const next = [];
    for (let line = startPosition.line; line <= endPosition.line; line += 1) {
      next.push({ anchor: positionToOffset(text, line, left), head: positionToOffset(text, line, right) });
    }
    return setSelections(next);
  }

  function surroundSelections(opening, closing = opening) {
    const entries = selections.map((selection) => selectionBounds(selection));
    for (const entry of [...entries].sort((a, b) => b.start - a.start)) {
      const selected = text.slice(entry.start, entry.end);
      text = text.slice(0, entry.start) + opening + selected + closing + text.slice(entry.end);
    }
    selections = normalizeSelections(text, entries.map((entry) => ({ anchor: entry.start + opening.length, head: entry.end + opening.length })));
    return text;
  }

  return Object.freeze({
    setText,
    getText: () => text,
    setSelections,
    setPrimarySelection,
    getSelections,
    getPrimarySelection: () => ({ ...selections[0] }),
    replaceSelections,
    deleteBackward: () => deleteDirection(-1),
    deleteForward: () => deleteDirection(1),
    insertNewlineWithIndent,
    indentSelections,
    toggleLineComments,
    addCursorVertical,
    createColumnSelectionsFromPrimary,
    surroundSelections,
    findMatchingDelimiter: () => findMatchingDelimiter(text, selections[0].head),
    getCursorPosition: () => offsetToPosition(text, selections[0].head)
  });
}
