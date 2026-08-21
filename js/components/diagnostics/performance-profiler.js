function defaultNow() {
  return typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
}

export function createPerformanceProfiler({ now = defaultNow, limit = 100 } = {}) {
  const records = [];
  const listeners = new Set();

  function push(label, duration, metadata = {}) {
    const record = Object.freeze({
      label: String(label),
      duration: Math.max(0, Number(duration) || 0),
      timestamp: Date.now(),
      metadata: { ...metadata }
    });
    records.push(record);
    if (records.length > limit) records.splice(0, records.length - limit);
    listeners.forEach((listener) => listener(record, snapshot()));
    return record;
  }

  async function measure(label, task, metadata = {}) {
    const start = now();
    try {
      const result = await task();
      push(label, now() - start, { ...metadata, status: "success" });
      return result;
    } catch (error) {
      push(label, now() - start, { ...metadata, status: "failure" });
      throw error;
    }
  }

  function snapshot() {
    return records.map((record) => ({ ...record, metadata: { ...record.metadata } }));
  }

  function summary() {
    const groups = new Map();
    for (const record of records) {
      if (!groups.has(record.label)) groups.set(record.label, []);
      groups.get(record.label).push(record.duration);
    }
    return [...groups].map(([label, values]) => ({
      label,
      count: values.length,
      last: values.at(-1),
      average: values.reduce((sum, value) => sum + value, 0) / values.length,
      max: Math.max(...values)
    })).sort((a, b) => b.last - a.last);
  }

  return Object.freeze({
    measure,
    mark: (label, duration, metadata) => push(label, duration, metadata),
    snapshot,
    summary,
    clear: () => { records.length = 0; },
    subscribe(listener) {
      if (typeof listener !== "function") throw new TypeError("Profiler listener must be a function.");
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  });
}
