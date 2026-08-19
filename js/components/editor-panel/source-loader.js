export function createSourceLoader({ onLoading, onLoaded, onError, onSettled }) {
  const sourceCache = new Map();
  const requestControllers = new Map();

  async function load(fileName) {
    if (sourceCache.has(fileName)) {
      onLoaded?.(fileName, sourceCache.get(fileName));
      return;
    }

    if (requestControllers.has(fileName)) {
      onLoading?.(fileName);
      return;
    }

    const requestController = new AbortController();
    requestControllers.set(fileName, requestController);
    onLoading?.(fileName);

    try {
      const filePath = fileName.split("/").map(encodeURIComponent).join("/");
      const response = await fetch("./" + filePath, {
        cache: "no-store",
        signal: requestController.signal
      });
      if (!response.ok) throw new Error("Unable to load " + fileName + " (" + response.status + ")");

      const source = await response.text();
      if (requestControllers.get(fileName) !== requestController) return;
      sourceCache.set(fileName, source);
      onLoaded?.(fileName, source);
    } catch (error) {
      if (error?.name === "AbortError") return;
      const message = error instanceof Error ? error.message : String(error);
      onError?.(fileName, message);
    } finally {
      const isCurrentRequest = requestControllers.get(fileName) === requestController;
      if (isCurrentRequest) {
        requestControllers.delete(fileName);
        onSettled?.(fileName);
      }
    }
  }

  function release(fileName) {
    requestControllers.get(fileName)?.abort();
    requestControllers.delete(fileName);
    sourceCache.delete(fileName);
  }

  return Object.freeze({
    load,
    release,
    has: (fileName) => sourceCache.has(fileName),
    get: (fileName) => sourceCache.get(fileName)
  });
}
