import { analyzeSource, MAX_MINIMAP_SAMPLES } from "./source-analysis.js";

function createDefaultWorker() {
  if (typeof Worker !== "function") return null;
  return new Worker(new URL("./source-analysis-worker.js", import.meta.url), {
    type: "module",
    name: "creed-source-analysis"
  });
}

export function createSourceAnalysisClient({
  workerFactory = createDefaultWorker,
  maximumSamples = MAX_MINIMAP_SAMPLES
} = {}) {
  const cache = new Map();
  const pendingByFile = new Map();
  const requests = new Map();
  const generations = new Map();
  let worker = null;
  let workerDisabled = false;
  let nextRequestId = 1;

  function getGeneration(fileName) {
    return generations.get(fileName) || 0;
  }

  function bumpGeneration(fileName) {
    const generation = getGeneration(fileName) + 1;
    generations.set(fileName, generation);
    return generation;
  }

  function cacheIfCurrent(entry, analysis) {
    if (getGeneration(entry.fileName) !== entry.generation) return;
    cache.set(entry.fileName, { source: entry.source, analysis });
  }

  function clearPendingEntry(entry) {
    const pending = pendingByFile.get(entry.fileName);
    if (pending?.requestId === entry.requestId) pendingByFile.delete(entry.fileName);
  }

  function resolveSynchronously(entry) {
    try {
      const analysis = analyzeSource(entry.source, maximumSamples);
      cacheIfCurrent(entry, analysis);
      clearPendingEntry(entry);
      entry.resolve(analysis);
    } catch (error) {
      clearPendingEntry(entry);
      entry.reject(error);
    }
  }

  function disableWorkerAndFallback() {
    workerDisabled = true;
    worker?.terminate();
    worker = null;
    const pending = [...requests.values()];
    requests.clear();
    pending.forEach(resolveSynchronously);
  }

  function ensureWorker() {
    if (workerDisabled) return null;
    if (worker) return worker;

    try {
      worker = workerFactory?.() || null;
    } catch {
      workerDisabled = true;
      return null;
    }
    if (!worker) {
      workerDisabled = true;
      return null;
    }

    worker.addEventListener("message", (event) => {
      const { type, requestId, analysis } = event.data || {};
      const entry = requests.get(requestId);
      if (!entry) return;
      requests.delete(requestId);

      if (type === "source-analysis-error") {
        resolveSynchronously(entry);
        return;
      }
      if (type !== "source-analysis-result" || !analysis) {
        resolveSynchronously(entry);
        return;
      }

      cacheIfCurrent(entry, analysis);
      clearPendingEntry(entry);
      entry.resolve(analysis);
    });
    worker.addEventListener("error", disableWorkerAndFallback);
    worker.addEventListener("messageerror", disableWorkerAndFallback);
    return worker;
  }

  function analyze(fileName, source) {
    const cached = cache.get(fileName);
    if (cached?.source === source) return Promise.resolve(cached.analysis);

    const pending = pendingByFile.get(fileName);
    if (pending?.source === source) return pending.promise;

    const generation = bumpGeneration(fileName);
    const requestId = nextRequestId;
    nextRequestId += 1;

    let resolvePromise;
    let rejectPromise;
    const promise = new Promise((resolve, reject) => {
      resolvePromise = resolve;
      rejectPromise = reject;
    });
    const entry = {
      fileName,
      source,
      generation,
      requestId,
      promise,
      resolve: resolvePromise,
      reject: rejectPromise
    };
    pendingByFile.set(fileName, entry);

    const activeWorker = ensureWorker();
    if (!activeWorker) {
      queueMicrotask(() => resolveSynchronously(entry));
      return promise;
    }

    requests.set(requestId, entry);
    try {
      activeWorker.postMessage({
        type: "analyze-source",
        requestId,
        source,
        maximumSamples
      });
    } catch {
      requests.delete(requestId);
      disableWorkerAndFallback();
      if (pendingByFile.get(fileName)?.requestId === requestId) {
        resolveSynchronously(entry);
      }
    }
    return promise;
  }

  function release(fileName) {
    bumpGeneration(fileName);
    cache.delete(fileName);
    pendingByFile.delete(fileName);
  }

  function destroy() {
    worker?.terminate();
    worker = null;
    workerDisabled = true;
    cache.clear();
    pendingByFile.clear();
    const pending = [...requests.values()];
    requests.clear();
    pending.forEach((entry) => entry.reject(new Error("Source analysis client destroyed.")));
  }

  return Object.freeze({
    analyze,
    release,
    destroy,
    isWorkerEnabled: () => !workerDisabled
  });
}
