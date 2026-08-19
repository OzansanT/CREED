export const MAX_MINIMAP_SAMPLES = 240;
export const MAX_SEARCH_MATCHES = 5000;

export function calculateMinimapRanges(lineCount, maximumSamples = MAX_MINIMAP_SAMPLES) {
  const safeLineCount = Math.max(0, lineCount);
  const sampleCount = Math.min(safeLineCount, Math.max(1, maximumSamples));
  return Array.from({ length: sampleCount }, (_, sampleIndex) => {
    const start = Math.floor(sampleIndex * safeLineCount / sampleCount);
    const end = Math.max(start, Math.floor((sampleIndex + 1) * safeLineCount / sampleCount) - 1);
    return { start, end };
  });
}

function indexSourceLines(source) {
  const starts = [0];
  const ends = [];
  let lineStart = 0;
  let maximumColumns = 0;

  for (let index = 0; index < source.length; index += 1) {
    if (source.charCodeAt(index) !== 10) continue;
    const lineEnd = index > lineStart && source.charCodeAt(index - 1) === 13
      ? index - 1
      : index;
    ends.push(lineEnd);
    maximumColumns = Math.max(maximumColumns, lineEnd - lineStart);
    lineStart = index + 1;
    starts.push(lineStart);
  }

  ends.push(source.length);
  maximumColumns = Math.max(maximumColumns, source.length - lineStart);

  return {
    lineStarts: Uint32Array.from(starts),
    lineEnds: Uint32Array.from(ends),
    maximumColumns
  };
}

function getTrimmedLength(source, start, end) {
  return source.slice(start, end).trim().length;
}

function createMinimapSamples(source, lineStarts, lineEnds, maximumSamples) {
  const ranges = calculateMinimapRanges(lineStarts.length, maximumSamples);
  return ranges.map(({ start, end }) => {
    let representativeIndex = start;
    let representativeLength = getTrimmedLength(
      source,
      lineStarts[representativeIndex],
      lineEnds[representativeIndex]
    );

    for (let index = start + 1; index <= end; index += 1) {
      const length = getTrimmedLength(source, lineStarts[index], lineEnds[index]);
      if (length > representativeLength) {
        representativeIndex = index;
        representativeLength = length;
      }
    }

    return {
      index: representativeIndex,
      startLine: start,
      endLine: end,
      width: Math.min(94, Math.max(4, representativeLength * 0.72))
    };
  });
}

export function analyzeSource(source, maximumSamples = MAX_MINIMAP_SAMPLES) {
  const text = typeof source === "string" ? source : String(source ?? "");
  const { lineStarts, lineEnds, maximumColumns } = indexSourceLines(text);
  return {
    lineStarts,
    lineEnds,
    lineCount: lineStarts.length,
    maximumColumns,
    minimapSamples: createMinimapSamples(text, lineStarts, lineEnds, maximumSamples)
  };
}

function escapeRegularExpression(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isWordCharacter(character) {
  return Boolean(character) && /[A-Za-z0-9_]/.test(character);
}

function isWholeWordMatch(line, start, length) {
  return !isWordCharacter(line[start - 1]) && !isWordCharacter(line[start + length]);
}

function createSearchExpression(query, { matchCase, useRegex }) {
  const pattern = useRegex ? query : escapeRegularExpression(query);
  try {
    return new RegExp(pattern, matchCase ? "g" : "gi");
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error("Invalid regular expression: " + detail);
  }
}

export function searchSource(source, query, {
  matchCase = false,
  wholeWord = false,
  useRegex = false,
  maxMatches = MAX_SEARCH_MATCHES
} = {}) {
  const text = typeof source === "string" ? source : String(source ?? "");
  const needle = typeof query === "string" ? query : String(query ?? "");
  if (!needle) return { matches: [], truncated: false };

  const safeMaximum = Math.max(1, Number.isFinite(maxMatches) ? Math.floor(maxMatches) : MAX_SEARCH_MATCHES);
  const expression = createSearchExpression(needle, {
    matchCase: Boolean(matchCase),
    useRegex: Boolean(useRegex)
  });
  const matches = [];
  let line = 0;
  let lineStart = 0;

  for (let index = 0; index <= text.length; index += 1) {
    if (index < text.length && text.charCodeAt(index) !== 10) continue;
    const lineEnd = index > lineStart && text.charCodeAt(index - 1) === 13
      ? index - 1
      : index;
    const lineText = text.slice(lineStart, lineEnd);
    expression.lastIndex = 0;

    let match = expression.exec(lineText);
    while (match) {
      const length = match[0].length;
      if (length > 0 && (!wholeWord || isWholeWordMatch(lineText, match.index, length))) {
        matches.push({ line, column: match.index, length });
        if (matches.length >= safeMaximum) return { matches, truncated: true };
      }

      if (length === 0) expression.lastIndex = match.index + 1;
      match = expression.exec(lineText);
    }

    line += 1;
    lineStart = index + 1;
  }

  return { matches, truncated: false };
}
