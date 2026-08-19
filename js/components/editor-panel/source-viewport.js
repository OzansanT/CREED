import { getFileExtension } from "./file-metadata.js";
import { createSourceAnalysisClient } from "./source-analysis-client.js";
import { createMinimapSample, createSourceLineRow } from "./source-renderer.js";

const DEFAULT_LINE_HEIGHT = 19;
export const SOURCE_OVERSCAN_LINES = 12;
const WIDTH_GUTTER_COLUMNS = 12;

function getLineHeight(target) {
  const value = Number.parseFloat(getComputedStyle(target).lineHeight);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_LINE_HEIGHT;
}

function getPaddingTop(target) {
  const value = Number.parseFloat(getComputedStyle(target).paddingTop);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function createSpacer(height) {
  const spacer = document.createElement("div");
  spacer.setAttribute("aria-hidden", "true");
  spacer.style.height = Math.max(0, height) + "px";
  spacer.style.pointerEvents = "none";
  return spacer;
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

export function createSourceViewport({ target, minimap, scroller }) {
  const analysisClient = createSourceAnalysisClient();
  let sourceText = "";
  let lineStarts = new Uint32Array(0);
  let lineEnds = new Uint32Array(0);
  let minimapSamples = [];
  let extension = "";
  let lineHeight = DEFAULT_LINE_HEIGHT;
  let paddingTop = 0;
  let renderFrame = 0;
  let sourceGeneration = 0;
  let lastStart = -1;
  let lastEnd = -1;

  function getLine(index) {
    return sourceText.slice(lineStarts[index], lineEnds[index]);
  }

  function renderWindow(force = false) {
    renderFrame = 0;
    const lineCount = lineStarts.length;
    if (lineCount === 0) {
      target.replaceChildren();
      lastStart = -1;
      lastEnd = -1;
      return;
    }

    const { start, end } = calculateSourceWindow({
      lineCount,
      scrollTop: scroller.scrollTop,
      clientHeight: scroller.clientHeight,
      lineHeight,
      paddingTop
    });
    if (!force && start === lastStart && end === lastEnd) return;

    const fragment = document.createDocumentFragment();
    fragment.append(createSpacer(start * lineHeight));
    for (let index = start; index < end; index += 1) {
      fragment.append(createSourceLineRow({ line: getLine(index), index, extension }));
    }
    fragment.append(createSpacer((lineCount - end) * lineHeight));
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

    overview.className = "source-editor__minimap-lines";
    overview.style.gridTemplateRows = "repeat(" + minimapSamples.length + ", minmax(0, 1fr))";
    viewport.className = "source-editor__minimap-viewport";

    for (const sample of minimapSamples) {
      overview.append(createMinimapSample({ sample, extension }));
    }

    minimap.replaceChildren(overview, viewport);
    minimap.dataset.sampleCount = String(minimapSamples.length);
  }

  async function setSource({ source, fileName }) {
    const generation = sourceGeneration + 1;
    sourceGeneration = generation;
    const analysis = await analysisClient.analyze(fileName, source);
    if (generation !== sourceGeneration) return false;

    sourceText = source;
    lineStarts = analysis.lineStarts;
    lineEnds = analysis.lineEnds;
    minimapSamples = analysis.minimapSamples;
    extension = getFileExtension(fileName);
    lineHeight = getLineHeight(target);
    paddingTop = getPaddingTop(target);
    lastStart = -1;
    lastEnd = -1;
    target.dataset.lineCount = String(analysis.lineCount);
    target.style.minWidth = "max(100%, " + (analysis.maximumColumns + WIDTH_GUTTER_COLUMNS) + "ch)";
    renderMinimapOverview();
    renderWindow(true);
    return true;
  }

  function clear() {
    sourceGeneration += 1;
    if (renderFrame) cancelAnimationFrame(renderFrame);
    renderFrame = 0;
    sourceText = "";
    lineStarts = new Uint32Array(0);
    lineEnds = new Uint32Array(0);
    minimapSamples = [];
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
    release: analysisClient.release,
    refresh: () => renderWindow(true),
    getRenderedRange: () => ({ start: lastStart, end: lastEnd, total: lineStarts.length })
  });
}
