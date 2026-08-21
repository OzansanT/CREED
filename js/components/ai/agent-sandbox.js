import { normalizeAIPatch } from "./ai-patch.js";

export function createAgentToolSandbox({ workspace, semanticIndex, contextEngine } = {}) {
  if (!workspace?.readFile || !workspace?.listFiles) throw new TypeError("Agent sandbox requires a workspace.");
  const tools = new Map();

  function register(name, handler) {
    if (!/^[a-z][a-z0-9-]*$/.test(name) || typeof handler !== "function") throw new TypeError("Invalid sandbox tool.");
    tools.set(name, handler);
  }

  register("list-files", async ({ prefix = "" } = {}) => workspace.listFiles().filter((fileName) => fileName.startsWith(String(prefix))).slice(0, 500));
  register("read-file", async ({ path, maxChars = 20000 } = {}) => {
    if (!workspace.hasFile?.(path)) throw new Error("Workspace file not found: " + path);
    return String(await workspace.readFile(path)).slice(0, Math.max(1, Math.min(100000, Number(maxChars) || 20000)));
  });
  register("semantic-search", async ({ query, limit = 12 } = {}) => semanticIndex?.search?.(query, { limit }) || []);
  register("workspace-context", async ({ prompt } = {}) => contextEngine?.build?.(prompt) || null);
  register("propose-patch", async ({ patch } = {}) => normalizeAIPatch(patch));

  async function invoke(name, args = {}) {
    const handler = tools.get(String(name));
    if (!handler) throw new Error("Agent tool is not allowlisted: " + name);
    return handler(args);
  }

  return Object.freeze({
    invoke,
    listTools: () => [...tools.keys()],
    hasTool: (name) => tools.has(name)
  });
}
