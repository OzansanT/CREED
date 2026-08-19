import { analyzeSource, searchSource } from "./source-analysis.js";

const documents = new Map();

self.addEventListener("message", (event) => {
  const { type, requestId, fileName, source, maximumSamples, query, options } = event.data || {};

  if (type === "release-source") {
    if (typeof fileName === "string") documents.delete(fileName);
    return;
  }

  if (!Number.isInteger(requestId)) return;

  try {
    if (type === "analyze-source") {
      const text = typeof source === "string" ? source : String(source ?? "");
      if (typeof fileName === "string") documents.set(fileName, text);
      const analysis = analyzeSource(text, maximumSamples);
      self.postMessage(
        {
          type: "source-analysis-result",
          requestId,
          analysis
        },
        [analysis.lineStarts.buffer, analysis.lineEnds.buffer]
      );
      return;
    }

    if (type === "search-source") {
      const text = documents.get(fileName);
      if (typeof text !== "string") throw new Error("Source document is not indexed in the worker.");
      self.postMessage({
        type: "source-search-result",
        requestId,
        result: searchSource(text, query, options)
      });
    }
  } catch (error) {
    self.postMessage({
      type: type === "search-source" ? "source-search-error" : "source-analysis-error",
      requestId,
      message: error instanceof Error ? error.message : String(error)
    });
  }
});
