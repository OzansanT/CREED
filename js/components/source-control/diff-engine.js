const MAX_LCS_LINES = 500;

function normalizeLines(value) {
  return String(value ?? "").replace(/\r\n?/g, "\n").split("\n");
}

function createFallbackDiff(beforeLines, afterLines) {
  let prefix = 0;
  while (prefix < beforeLines.length && prefix < afterLines.length && beforeLines[prefix] === afterLines[prefix]) prefix += 1;
  let suffix = 0;
  while (
    suffix < beforeLines.length - prefix
    && suffix < afterLines.length - prefix
    && beforeLines[beforeLines.length - 1 - suffix] === afterLines[afterLines.length - 1 - suffix]
  ) suffix += 1;

  const rows = [];
  let beforeNumber = 1;
  let afterNumber = 1;
  for (let index = 0; index < prefix; index += 1) {
    rows.push({ type: "equal", text: beforeLines[index], beforeLine: beforeNumber++, afterLine: afterNumber++ });
  }
  for (let index = prefix; index < beforeLines.length - suffix; index += 1) {
    rows.push({ type: "delete", text: beforeLines[index], beforeLine: beforeNumber++, afterLine: null });
  }
  for (let index = prefix; index < afterLines.length - suffix; index += 1) {
    rows.push({ type: "insert", text: afterLines[index], beforeLine: null, afterLine: afterNumber++ });
  }
  for (let index = suffix; index > 0; index -= 1) {
    const beforeIndex = beforeLines.length - index;
    const afterIndex = afterLines.length - index;
    rows.push({ type: "equal", text: beforeLines[beforeIndex], beforeLine: beforeNumber++, afterLine: afterNumber++ });
  }
  return rows;
}

export function createLineDiff(before, after) {
  const beforeLines = normalizeLines(before);
  const afterLines = normalizeLines(after);
  if (beforeLines.length > MAX_LCS_LINES || afterLines.length > MAX_LCS_LINES) {
    return createFallbackDiff(beforeLines, afterLines);
  }

  const table = Array.from({ length: beforeLines.length + 1 }, () => new Uint16Array(afterLines.length + 1));
  for (let left = beforeLines.length - 1; left >= 0; left -= 1) {
    for (let right = afterLines.length - 1; right >= 0; right -= 1) {
      table[left][right] = beforeLines[left] === afterLines[right]
        ? table[left + 1][right + 1] + 1
        : Math.max(table[left + 1][right], table[left][right + 1]);
    }
  }

  const rows = [];
  let left = 0;
  let right = 0;
  let beforeLine = 1;
  let afterLine = 1;
  while (left < beforeLines.length || right < afterLines.length) {
    if (left < beforeLines.length && right < afterLines.length && beforeLines[left] === afterLines[right]) {
      rows.push({ type: "equal", text: beforeLines[left], beforeLine: beforeLine++, afterLine: afterLine++ });
      left += 1;
      right += 1;
      continue;
    }
    if (right < afterLines.length && (left >= beforeLines.length || table[left][right + 1] >= table[left + 1][right])) {
      rows.push({ type: "insert", text: afterLines[right], beforeLine: null, afterLine: afterLine++ });
      right += 1;
      continue;
    }
    rows.push({ type: "delete", text: beforeLines[left], beforeLine: beforeLine++, afterLine: null });
    left += 1;
  }
  return rows;
}

export function createSideBySideDiff(before, after) {
  const rows = createLineDiff(before, after);
  const output = [];
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    if (row.type === "equal") {
      output.push({ left: row, right: row });
      continue;
    }
    const next = rows[index + 1];
    if (row.type === "delete" && next?.type === "insert") {
      output.push({ left: row, right: next });
      index += 1;
      continue;
    }
    if (row.type === "insert" && next?.type === "delete") {
      output.push({ left: next, right: row });
      index += 1;
      continue;
    }
    output.push({ left: row.type === "delete" ? row : null, right: row.type === "insert" ? row : null });
  }
  return output;
}

export function summarizeDiff(before, after) {
  const rows = createLineDiff(before, after);
  return {
    additions: rows.filter((row) => row.type === "insert").length,
    deletions: rows.filter((row) => row.type === "delete").length,
    rows
  };
}
