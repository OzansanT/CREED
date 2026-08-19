export const MAX_MINIMAP_SAMPLES = 240;

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
