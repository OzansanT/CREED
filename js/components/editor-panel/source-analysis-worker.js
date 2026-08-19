import { analyzeSource } from "./source-analysis.js";

self.addEventListener("message", (event) => {
  const { type, requestId, source, maximumSamples } = event.data || {};
  if (type !== "analyze-source" || !Number.isInteger(requestId)) return;

  try {
    const analysis = analyzeSource(source, maximumSamples);
    self.postMessage(
      {
        type: "source-analysis-result",
        requestId,
        analysis
      },
      [analysis.lineStarts.buffer, analysis.lineEnds.buffer]
    );
  } catch (error) {
    self.postMessage({
      type: "source-analysis-error",
      requestId,
      message: error instanceof Error ? error.message : String(error)
    });
  }
});
