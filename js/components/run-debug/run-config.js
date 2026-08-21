export const DEFAULT_RUN_CONFIG = Object.freeze({
  version: 1,
  name: "Preview index.html",
  type: "preview",
  entry: "index.html",
  autoReload: true
});

export const RUN_CONFIG_PATH = ".creed/run.json";
export const TASK_CONFIG_PATH = ".creed/tasks.json";

function normalizeTask(task, index) {
  if (!task || typeof task !== "object") return null;
  const type = ["preview", "javascript"].includes(task.type) ? task.type : null;
  const entry = typeof task.entry === "string" && task.entry.trim() ? task.entry.trim() : null;
  if (!type || !entry) return null;
  return {
    name: typeof task.name === "string" && task.name.trim() ? task.name.trim() : `Task ${index + 1}`,
    type,
    entry,
    autoReload: task.autoReload !== false
  };
}

export function normalizeRunConfig(value = {}) {
  if (!value || typeof value !== "object") return { ...DEFAULT_RUN_CONFIG };
  const type = ["preview", "javascript"].includes(value.type) ? value.type : DEFAULT_RUN_CONFIG.type;
  return {
    version: 1,
    name: typeof value.name === "string" && value.name.trim() ? value.name.trim() : DEFAULT_RUN_CONFIG.name,
    type,
    entry: typeof value.entry === "string" && value.entry.trim() ? value.entry.trim() : DEFAULT_RUN_CONFIG.entry,
    autoReload: value.autoReload !== false
  };
}

export async function loadRunConfig(workspace) {
  if (!workspace?.readFile) return { ...DEFAULT_RUN_CONFIG };
  if (!workspace.hasFile?.(RUN_CONFIG_PATH)) return { ...DEFAULT_RUN_CONFIG };
  try {
    return normalizeRunConfig(JSON.parse(await workspace.readFile(RUN_CONFIG_PATH)));
  } catch (error) {
    throw new Error("Invalid " + RUN_CONFIG_PATH + ": " + (error instanceof Error ? error.message : String(error)));
  }
}

export async function loadTasks(workspace) {
  const defaults = [
    { name: "Preview", type: "preview", entry: "index.html", autoReload: true },
    { name: "Run active JavaScript", type: "javascript", entry: "js/main.js", autoReload: false }
  ];
  if (!workspace?.hasFile?.(TASK_CONFIG_PATH)) return defaults;
  try {
    const parsed = JSON.parse(await workspace.readFile(TASK_CONFIG_PATH));
    const source = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.tasks) ? parsed.tasks : [];
    const tasks = source.map(normalizeTask).filter(Boolean);
    return tasks.length ? tasks : defaults;
  } catch (error) {
    throw new Error("Invalid " + TASK_CONFIG_PATH + ": " + (error instanceof Error ? error.message : String(error)));
  }
}
