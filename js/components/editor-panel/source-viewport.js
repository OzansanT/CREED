import { getFileExtension } from "./file-metadata.js";
import { createMinimapSample, createSourceLineRow } from "./source-renderer.js";

const DEFAULT_LINE_HEIGHT = 19;
export const SOURCE_OVERSCAN_LINES = 12;
export const MAX_MINIMAP_SAMPLES = 240;
const WIDTH_GUTTER_COLUMNS = 12;

function splitSourceLines(source) {
  return source.replace(/\r\n/g, "\n").split("\n");
}

function getLineHeight(target) {
  const value = Number.parseFloat(getComputedStyle(target).lineHeight);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_LINE_HEIGHT;
}

function getPaddingTop(target) {
  const value = Number.parseFloat(getComputedStyle(target).paddingTop);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function getMaximumColumns(lines) {
  return lines.reduce((maximum, line) => Math.max(maximum, line.length), 0);
}

function createSpacer(height) {
  const spacer = document.createElement("div");
  spacer.setAttribute("aria-hidden", "true");
  spacer.style.height = Math.max(0, height) + "px";
  spacer.style.pointerEvents = "none";
  return spacer;
}

function chooseRepresentativeLine(lines, start, end) {
  let representativeIndex = start;
  for (let index = start + 1; index <= end; index += 1) {
    if (lines[index].trim().length > lines[representativeIndex].trim().length) {
      representativeIndex = index;
    }
  }
  return representativeIndex;
}

export function calculateSourceWindow({
  lineCount,
  scrollTop,
  clientHeight,
  lineHeight = DEFAULT_LINE_HEIGHT,
  paddingTop = 0,
  overscan = SOURCE_OVERSCAN_LINES
}) {
  const safeLineCount = Math.max(0, lineCount);
  if (safeLineCount === 0) return { start: 0, end: 0 };

  const safeLineHeight = Math.max(1, lineHeight);
  const safeOverscan = Math.max(0, overscan);
  const viewportLines = Math.max(1, Math.ceil(clientHeight / safeLineHeight));
  const firstVisible = Math.min(
    safeLineCount - 1,
    Math.max(0, Math.floor((scrollTop - paddingTop) / safeLineHeight))
  );
  return {
    start: Math.max(0, firstVisible - safeOverscan),
    end: Math.min(safeLineCount, firstVisible + viewportLines + safeOverscan)
  };
}

export function calculateMinimapRanges(lineCount, maximumSamples = MAX_MINIMAP_SAMPLES) {
  const sampleCount = Math.min(Math.max(0, lineCount), Math.max(1, maximumSamples));
  return Array.from({ length: sampleCount }, (_, sampleIndex) => {
    const start = Math.floor(sampleIndex * lineCount / sampleCount);
    const end = Math.max(start, Math.floor((sampleIndex + 1) * lineCount / sampleCount) - 1);
    return { start, end };
  });
}

export function createSourceViewport({ target, minimap, scroller }) {
  let lines = [];
  let extension = "";
  let lineHeight = DEFAULT_LINE_HEIGHT;
  let paddingTop = 0;
  let renderFrame = 0;
  let lastStart = -1;
  let lastEnd = -1;

  function renderWindow(force = false) {
    renderFrame = 0;
    if (lines.length === 0) {
      target.replaceChildren();
      lastStart = -1;
      lastEnd = -1;
      return;
    }

    const { start, end } = calculateSourceWindow({
      lineCount: lines.length,
      scrollTop: scroller.scrollTop,
      clientHeight: scroller.clientHeight,
      lineHeight,
      paddingTop
    });
    if (!force && start === lastStart && end === lastEnd) return;

    const fragment = document.createDocumentFragment();
    fragment.append(createSpacer(start * lineHeight));
    for (let index = start; index < end; index += 1) {
      fragment.append(createSourceLineRow({ line: lines[index], index, extension }));
    }
    fragment.append(createSpacer((lines.length - end) * lineHeight));
    target.replaceChildren(fragment);
    target.dataset.renderedStart = String(start + 1);
    target.dataset.renderedEnd = String(end);
    target.dataset.renderedCount = String(end - start);
    lastStart = start;
    lastEnd = end;
  }

  function scheduleRender() {
    if (renderFrame) return;
    renderFrame = requestAnimationFrame(() => renderWindow());
  }

  function renderMinimapOverview() {
    const overview = document.createElement("div");
    const viewport = document.createElement("div");
    const ranges = calculateMinimapRanges(lines.length);

    overview.className = "source-editor__minimap-lines";
    overview.style.gridTemplateRows = "repeat(" + ranges.length + ", minmax(0, 1fr))";
    viewport.className = "source-editor__minimap-viewport";

    for (const { start, end } of ranges) {
      const representativeIndex = chooseRepresentativeLine(lines, start, end);
      overview.append(createMinimapSample({
        line: lines[representativeIndex],
        index: representativeIndex,
        extension,
        startLine: start,
        endLine: end
      }));
    }

    minimap.replaceChildren(overview, viewport);
    minimap.dataset.sampleCount = String(ranges.length);
  }

  function setSource({ source, fileName }) {
    lines = splitSourceLines(source);
    extension = getFileExtension(fileName);
    lineHeight = getLineHeight(target);
    paddingTop = getPaddingTop(target);
    lastStart = -1;
    lastEnd = -1;
    target.dataset.lineCount = String(lines.length);
    target.style.minWidth = "max(100%, " + (getMaximumColumns(lines) + WIDTH_GUTTER_COLUMNS) + "ch)";
    renderMinimapOverview();
    renderWindow(true);
    return lines.length;
  }

  function clear() {
    if (renderFrame) cancelAnimationFrame(renderFrame);
    renderFrame = 0;
    lines = [];
    extension = "";
    lastStart = -1;
    lastEnd = -1;
    delete target.dataset.lineCount;
    delete target.dataset.renderedStart;
    delete target.dataset.renderedEnd;
    delete target.dataset.renderedCount;
    target.style.removeProperty("min-width");
    target.replaceChildren();
    minimap.replaceChildren();
    delete minimap.dataset.sampleCount;
  }

  scroller.style.overflowAnchor = "none";
  scroller.addEventListener("scroll", scheduleRender, { passive: true });
  const resizeObserver = typeof ResizeObserver === "function"
    ? new ResizeObserver(scheduleRender)
    : null;
  resizeObserver?.observe(scroller);
  if (!resizeObserver) window.addEventListener("resize", scheduleRender, { passive: true });

  return Object.freeze({
    setSource,
    clear,
    refresh: () => renderWindow(true),
    getRenderedRange: () => ({ start: lastStart, end: lastEnd, total: lines.length })
  });
}
