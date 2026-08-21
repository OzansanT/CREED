const DEFAULT_TAB_SIZE = 2;
const OPENING_BRACKETS = "([{<";
const CLOSING_BRACKETS = ")]}>":
const QUOTES = "\"'`";

function clampOffset(text, value) {
  return Math.min(text.length, Math.max(0, Math.trunc(Number(value) || 0)));
}

function normalizeSelection(text, value = {}) {
  const anchor = clampOffset(text, value.anchor ?? value.start ?? 0);
  const head = clampOffset(text, value.head ?? value.end ?? anchor);
  return { anchor, head };
}

function bounds(selection) {
  return { start: Math.min(selection.anchor, selection.head), end: Math.max(selection.anchor, selection.head) };
}

function uniqueSelections(text, values) {
  const seen = new Set();
  return values.map((value) => normalizeSelection(text, value)).filter((selection) => {
    const key = `${selection.anchor}:${selection.head}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((left, right) => bounds(left).start - bounds(right).start);
}

export function offsetToPosition(text, offset) {
  const safeOffset = clampOffset(text, offset);
  const before = text.slice(0, safeOffset);
  const line = before.split("\n").length - 1;
  const lineStart = before.lastIndexOf("\n") + 1;
  return { line, column: safeOffset - lineStart };
}

export function positionToOffset(text, line, column) {
  const lines = text.split("\n");
  const safeLine = Math.min(lines.length - 1, Math.max(0, Math.trunc(Number(line) || 0)));
  const safeColumn = Math.min(lines[safeLine].length, Math.max(0, Math.trunc(Number(column) || 0)));
  let offset = 0;
  for (let index = 0; index < safeLine; index += 1) offset += lines[index].length + 1;
  return offset + safeColumn;
}

function lineRangeForSelection(text, selection) {
  const { start, end } = bounds(selection);
  const startPosition = offsetToPosition(text, start);
  const endPosition = offsetToPosition(text, end);
  return { startLine: startPosition.line, endLine: endPosition.line };
}

function getLineIndent(text, offset) {
  const position = offsetToPosition(text, offset);
  const lineStart = positionToOffset(text, position.line, 0);
  return (text.slice(lineStart, offset).match(/^\s*/) || [""])[0];
}

function lineCommentToken(extension) {
  return ["js", "mjs", "cjs", "ts", "tsx", "jsx", "jsonc"].includes(extension) ? "//" : null;
}

function findMatchingQuote(text, index, quote) {
  const escaped = (offset) => {
    let slashes = 0;
    for (let cursor = offset - 1; cursor >= 0 && text[cursor] === "\\"; cursor -= 1) slashes += 1;
    return slashes % 2 === 1;
  };
  for (let cursor = index + 1; cursor < text.length; cursor += 1) {
    if (text[cursor] === quote && !escaped(cursor)) return cursor;
  }
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    if (text[cursor] === quote && !escaped(cursor)) return cursor;
  }
  return null;
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
    const matchOffset = findMatchingQuote(text, index, character);
    return matchOffset == null ? null : { offset: index, matchOffset, character };
  }
  const openingIndex = OPENING_BRACKETS.indexOf(character);
  const closingIndex = CLOSING_BRACKETS.indexOf(character);
  if (openingIndex >= 0) {
    const closing = CLOSING_BRACKETS[openingIndex];
    let depth = 0;
    for (let cursor = index; cursor < text.length; cursor += 1) {
      if (text[cursor] === character) depth += 1;
      else if (text[cursor] === closing && --depth === 0) return { offset: index, matchOffset: cursor, character };
    }
  } else if (closingIndex >= 0) {
    const opening = OPENING_BRACKETS[closingIndex];
    let depth = 0;
    for (let cursor = index; cursor >= 0; cursor -= 1) {
      if (text[cursor] === character) depth += 1;
      else if (text[cursor] === opening && --depth === 0) return { offset: index, matchOffset: cursor, character };
    }
  }
  return null;
}

export function createEditorTextModel(initialText = "", { tabSize = DEFAULT_TAB_SIZE } = {}) {
  let text = String(initialText ?? "").replace(/\r\n?/g, "\n");
  let selections = [{ anchor: 0, head: 0 }];
  const indentUnit = " ".repeat(Math.max(1, Math.trunc(tabSize)));

  function getSelections() {
    return selections.map((selection) => ({ ...selection }));
  }

  function setText(nextText, { preserveSelections = false } = {}) {
    text = String(nextText ?? "").replace(/\r\n?/g, "\n");
    selections = preserveSelections ? uniqueSelections(text, selections) : [{ anchor: 0, head: 0 }];
    return text;
  }

  function setSelections(nextSelections) {
    const values = Array.isArray(nextSelections) && nextSelections.length ? nextSelections : [{ anchor: 0, head: 0 }];
    selections = uniqueSelections(text, values);
    if (!selections.length) selections = [{ anchor: 0, head: 0 }];
    return getSelections();
  }

  function setPrimarySelection(anchor, head = anchor, { keepSecondary = false } = {}) {
    const primary = normalizeSelection(text, { anchor, head });
    selections = keepSecondary ? uniqueSelections(text, [primary, ...selections.slice(1)]) : [primary];
    return { ...selections[0] };
  }

  function replaceSelections(insertText) {
    const insertion = String(insertText ?? "");
    const ordered = selections.map((selection, index) => ({ ...bounds(selection), index }))
      .sort((left, right) => right.start - left.start);
    const endpoints = new Map();
    for (const selection of ordered) {
      text = text.slice(0, selection.start) + insertion + text.slice(selection.end);
      endpoints.set(selection.index, selection.start + insertion.length);
    }
    const ascending = [...ordered].sort((left, right) => left.start - right.start);
    let shift = 0;
    for (const item of ascending) {
      endpoints.set(item.index, endpoints.get(item.index) + shift);
      shift += insertion.length - (item.end - item.start);
    }
    selections = selections.map((_selection, index) => {
      const offset = clampOffset(text, endpoints.get(index));
      return { anchor: offset, head: offset };
    });
    return text;
  }

  function deleteByDirection(direction) {
    setSelections(selections.map((selection) => {
      const { start, end } = bounds(selection);
      if (start !== end) return selection;
      if (direction < 0 && start > 0) return { anchor: start - 1, head: start };
      if (direction > 0 && end < text.length) return { anchor: end, head: end + 1 };
      return selection;
    }));
    return replaceSelections("");
  }

  function insertNewlineWithIndent() {
    const replacements = selections.map((selection) => {
      const { start } = bounds(selection);
      const indent = getLineIndent(text, start);
      const before = text.slice(0, start).trimEnd();
      const extraIndent = /[\[{(:]$/.test(before) ? indentUnit : "";
      return "\n" + indent + extraIndent;
    });
    if (new Set(replacements).size === 1) return replaceSelections(replacements[0]);
    const original = getSelections();
    const ordered = original.map((selection, index) => ({ ...bounds(selection), index })).sort((a, b) => b.start - a.start);
    for (const item of ordered) {
      const insertion = replacements[item.index];
      text = text.slice(0, item.start) + insertion + text.slice(item.end);
    }
    selections = original.map((selection, index) => {
      const start = bounds(selection).start;
      const prior = original.filter((other) => bounds(other).start < start);
      const shift = prior.reduce((sum, other, priorIndex) => sum + replacements[priorIndex].length - (bounds(other).end - bounds(other).start), 0);
      const offset = start + shift + replacements[index].length;
      return { anchor: offset, head: offset };
    });
    return text;
  }

  function transformSelectedLines(transform) {
    const affected = new Set();
    selections.forEach((selection) => {
      const range = lineRangeForSelection(text, selection);
      for (let line = range.startLine; line <= range.endLine; line += 1) affected.add(line);
    });
    const positions = selections.map((selection) => ({
      anchor: offsetToPosition(text, selection.anchor),
      head: offsetToPosition(text, selection.head)
    }));
    const lines = text.split("\n");
    for (const line of [...affected].sort((a, b) => a - b)) lines[line] = transform(lines[line], line);
    text = lines.join("\n");
    selections = positions.map((selection) => ({
      anchor: positionToOffset(text, selection.anchor.line, selection.anchor.column),
      head: positionToOffset(text, selection.head.line, selection.head.column)
    }));
    return text;
  }

  function indentSelections({ outdent = false } = {}) {
    return transformSelectedLines((line) => {
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
    selections.forEach((selection) => {
      const range = lineRangeForSelection(text, selection);
      for (let line = range.startLine; line <= range.endLine; line += 1) affected.add(line);
    });
    const lines = text.split("\n");
    const shouldUncomment = [...affected].every((line) => lines[line].trimStart().startsWith(token));
    for (const line of affected) {
      lines[line] = shouldUncomment
        ? lines[line].replace(new RegExp(`^(\\s*)${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} ?`), "$1")
        : lines[line].replace(/^(\s*)/, `$1${token} `);
    }
    text = lines.join("\n");
    selections = uniqueSelections(text, selections);
    return text;
  }

  function addCursorVertical(delta) {
    const lines = text.split("\n");
    const next = [...selections];
    for (const selection of selections) {
      const position = offsetToPosition(text, selection.head);
      const targetLine = position.line + delta;
      if (targetLine < 0 || targetLine >= lines.length) continue;
      const offset = positionToOffset(text, targetLine, position.column);
      next.push({ anchor: offset, head: offset });
    }
    return setSelections(next);
  }

  function createColumnSelectionsFromPrimary() {
    const primary = selections[0];
    const start = offsetToPosition(text, bounds(primary).start);
    const end = offsetToPosition(text, bounds(primary).end);
    if (start.line === end.line) return getSelections();
    const left = Math.min(start.column, end.column);
    const right = Math.max(start.column, end.column);
    const next = [];
    for (let line = start.line; line <= end.line; line += 1) {
      next.push({ anchor: positionToOffset(text, line, left), head: positionToOffset(text, line, right) });
    }
    return setSelections(next);
  }

  function surroundSelections(opening, closing = opening) {
    const original = getSelections();
    const ordered = original.map((selection, index) => ({ ...bounds(selection), index })).sort((a, b) => b.start - a.start);
    for (const item of ordered) {
      const selected = text.slice(item.start, item.end);
      text = text.slice(0, item.start) + opening + selected + closing + text.slice(item.end);
    }
    selections = uniqueSelections(text, original.map((selection) => {
      const range = bounds(selection);
      return { anchor: range.start + opening.length, head: range.end + opening.length };
    }));
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
    deleteBackward: () => deleteByDirection(-1),
    deleteForward: () => deleteByDirection(1),
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
