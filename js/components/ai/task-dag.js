export function createTaskDag(tasks = []) {
  const nodes = new Map();
  for (const raw of tasks) {
    const id = String(raw?.id || "").trim();
    if (!id || nodes.has(id) || typeof raw.run !== "function") throw new Error("Task DAG requires unique runnable task ids.");
    nodes.set(id, { id, dependencies: [...new Set(raw.dependencies || [])].map(String), run: raw.run });
  }
  for (const task of nodes.values()) {
    for (const dependency of task.dependencies) if (!nodes.has(dependency)) throw new Error(`Unknown task dependency: ${dependency}`);
  }

  function topologicalOrder() {
    const temporary = new Set();
    const permanent = new Set();
    const order = [];
    function visit(id) {
      if (permanent.has(id)) return;
      if (temporary.has(id)) throw new Error("Task DAG contains a cycle involving " + id);
      temporary.add(id);
      for (const dependency of nodes.get(id).dependencies) visit(dependency);
      temporary.delete(id);
      permanent.add(id);
      order.push(id);
    }
    for (const id of nodes.keys()) visit(id);
    return order;
  }

  async function execute(context = {}) {
    const results = new Map();
    const events = [];
    for (const id of topologicalOrder()) {
      const task = nodes.get(id);
      events.push({ type: "started", id });
      try {
        const dependencyResults = Object.fromEntries(task.dependencies.map((dependency) => [dependency, results.get(dependency)]));
        const result = await task.run({ context, dependencies: dependencyResults, results });
        results.set(id, result);
        events.push({ type: "completed", id });
      } catch (error) {
        events.push({ type: "failed", id, error: error instanceof Error ? error.message : String(error) });
        throw Object.assign(error instanceof Error ? error : new Error(String(error)), { taskId: id, events });
      }
    }
    return Object.freeze({ order: topologicalOrder(), results: Object.fromEntries(results), events });
  }

  return Object.freeze({
    order: topologicalOrder,
    execute,
    tasks: () => [...nodes.values()].map((task) => ({ id: task.id, dependencies: [...task.dependencies] }))
  });
}
