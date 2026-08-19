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

function getCharacterWidth(target) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) return 7.2;
  context.font = getComputedStyle(target).font;
  const width = context.measureText("0").width;
  return Number.isFinite(width) && width > 0 ? width : 7.2;
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
  let activeFileName = "";
  let sourceText = "";
  let lineStarts = new Uint32Array(0);
  let lineEnds = new Uint32Array(0);
  let minimapSamples = [];
  let extension = "";
  let lineHeight = DEFAULT_LINE_HEIGHT;
  let characterWidth = 7.2;
  let paddingTop = 0;
  let renderFrame = 0;
  let sourceGeneration = 0;
  let searchMatches = [];
  let searchMatchesByLine = new Map();
  let activeSearchIndex = -1;
  let lastStart = -1;
  let lastEnd = -1;

  function getLine(index) {
    return sourceText.slice(lineStarts[index], lineEnds[index]);
  }

  function getActiveSearchMatch() {
    return activeSearchIndex >= 0 ? searchMatches[activeSearchIndex] || null : null;
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

    const activeSearchMatch = getActiveSearchMatch();
    const fragment = document.createDocumentFragment();
    fragment.append(createSpacer(start * lineHeight));
    for (let index = start; index < end; index += 1) {
      fragment.append(createSourceLineRow({
        line: getLine(index),
        index,
        extension,
        searchMatches: searchMatchesByLine.get(index) || [],
        activeSearchMatch
      }));
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

  function resetSearchState({ render = true } = {}) {
    searchMatches = [];
    searchMatchesByLine = new Map();
    activeSearchIndex = -1;
    if (render && lineStarts.length > 0) renderWindow(true);
  }

  async function setSource({ source, fileName }) {
    const generation = sourceGeneration + 1;
    sourceGeneration = generation;
    const analysis = await analysisClient.analyze(fileName, source);
    if (generation !== sourceGeneration) return false;

    activeFileName = fileName;
    sourceText = source;
    lineStarts = analysis.lineStarts;
    lineEnds = analysis.lineEnds;
    minimapSamples = analysis.minimapSamples;
    extension = getFileExtension(fileName);
    lineHeight = getLineHeight(target);
    characterWidth = getCharacterWidth(target);
    paddingTop = getPaddingTop(target);
    resetSearchState({ render: false });
    lastStart = -1;
    lastEnd = -1;
    target.dataset.lineCount = String(analysis.lineCount);
    target.style.minWidth = "max(100%, " + (analysis.maximumColumns + WIDTH_GUTTER_COLUMNS) + "ch)";
    renderMinimapOverview();
    renderWindow(true);
    return true;
  }

  async function search(query, options) {
    if (!activeFileName || lineStarts.length === 0) {
      throw new Error("Source is not ready for search.");
    }
    return analysisClient.search(activeFileName, query, options);
  }

  function setSearchResults(matches, activeIndex = -1) {
    searchMatches = Array.isArray(matches) ? matches : [];
    searchMatchesByLine = new Map();
    for (const match of searchMatches) {
      const lineMatches = searchMatchesByLine.get(match.line) || [];
      lineMatches.push(match);
      searchMatchesByLine.set(match.line, lineMatches);
    }
    activeSearchIndex = searchMatches.length > 0
      ? Math.min(searchMatches.length - 1, Math.max(0, activeIndex))
      : -1;
    renderWindow(true);
  }

  function setActiveSearchIndex(index) {
    if (searchMatches.length === 0) {
      activeSearchIndex = -1;
      return null;
    }
    activeSearchIndex = (index + searchMatches.length) % searchMatches.length;
    renderWindow(true);
    return searchMatches[activeSearchIndex];
  }

  function goToLocation(line, column = 1) {
    const lineCount = lineStarts.length;
    if (lineCount === 0) return null;

    const safeLine = Math.min(lineCount, Math.max(1, Math.trunc(Number(line) || 1)));
    const lineText = getLine(safeLine - 1);
    const safeColumn = Math.min(lineText.length + 1, Math.max(1, Math.trunc(Number(column) || 1)));
    const lineTop = paddingTop + ((safeLine - 1) * lineHeight);
    scroller.scrollTop = Math.max(0, lineTop - (scroller.clientHeight * 0.45));
    const columnLeft = (safeColumn - 1) * characterWidth;
    scroller.scrollLeft = Math.max(0, columnLeft - (scroller.clientWidth * 0.35));
    renderWindow(true);
    return { line: safeLine, column: safeColumn };
  }

  function clear() {
    sourceGeneration += 1;
    if (renderFrame) cancelAnimationFrame(renderFrame);
    renderFrame = 0;
    activeFileName = "";
    sourceText = "";
    lineStarts = new Uint32Array(0);
    lineEnds = new Uint32Array(0);
    minimapSamples = [];
    extension = "";
    resetSearchState({ render: false });
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
    search,
    setSearchResults,
    setActiveSearchIndex,
    clearSearch: () => resetSearchState(),
    goToLocation,
    clear,
    release: analysisClient.release,
    refresh: () => renderWindow(true),
    isReady: () => Boolean(activeFileName) && lineStarts.length > 0,
    getRenderedRange: () => ({ start: lastStart, end: lastEnd, total: lineStarts.length })
  });
}
