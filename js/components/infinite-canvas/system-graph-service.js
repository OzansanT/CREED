import { buildSystemGraph } from "./system-graph-model.js";

export function createSystemGraphService({ workspace, notify } = {}) {
  if (!workspace?.listFiles || !workspace?.readFile) throw new TypeError("System graph service requires a workspace.");
  let graph = Object.freeze({ nodes: [], edges: [], symbols: [], files: [], sources: new Map() });
  let generation = 0;
  let timer = 0;
  const listeners = new Set();

  async function refresh() {
    const token = ++generation;
    const next = await buildSystemGraph({ workspace });
    if (token !== generation) return graph;
    graph = next;
    listeners.forEach((listener) => {
      try { listener(graph); } catch {}
    });
    return graph;
  }

  function scheduleRefresh() {
    clearTimeout(timer);
    timer = setTimeout(() => refresh().catch((error) => notify?.(error instanceof Error ? error.message : String(error))), 160);
  }

  const unsubscribeWorkspace = workspace.subscribe?.(scheduleRefresh) || (() => {});

  return Object.freeze({
    refresh,
    getGraph: () => graph,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    destroy() {
      clearTimeout(timer);
      listeners.clear();
      unsubscribeWorkspace?.();
    }
  });
}
