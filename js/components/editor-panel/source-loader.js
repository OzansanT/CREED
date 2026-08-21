async function defaultReadFile(fileName, { signal } = {}) {
  const filePath = fileName.split("/").map(encodeURIComponent).join("/");
  const response = await fetch("./" + filePath, {
    cache: "no-store",
    signal
  });
  if (!response.ok) throw new Error("Unable to load " + fileName + " (" + response.status + ")");
  return response.text();
}

export function createSourceLoader({ readFile = defaultReadFile, onLoading, onLoaded, onError, onSettled }) {
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
      const source = await readFile(fileName, { signal: requestController.signal });
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

  function set(fileName, source) {
    if (typeof source !== "string") throw new TypeError("Source cache value must be text.");
    requestControllers.get(fileName)?.abort();
    requestControllers.delete(fileName);
    sourceCache.set(fileName, source);
  }

  function rename(oldName, newName) {
    if (!sourceCache.has(oldName)) return false;
    sourceCache.set(newName, sourceCache.get(oldName));
    sourceCache.delete(oldName);
    requestControllers.get(oldName)?.abort();
    requestControllers.delete(oldName);
    return true;
  }

  return Object.freeze({
    load,
    release,
    set,
    rename,
    has: (fileName) => sourceCache.has(fileName),
    get: (fileName) => sourceCache.get(fileName)
  });
}
