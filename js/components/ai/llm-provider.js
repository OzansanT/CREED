export function createLLMProviderRegistry() {
  const providers = new Map();
  let activeId = "";

  function register(id, provider) {
    const key = String(id || "").trim();
    if (!key || !provider || typeof provider.complete !== "function") {
      throw new TypeError("LLM providers require an id and complete(request) function.");
    }
    providers.set(key, Object.freeze({ ...provider, id: key }));
    if (!activeId) activeId = key;
    return () => {
      providers.delete(key);
      if (activeId === key) activeId = providers.keys().next().value || "";
    };
  }

  function setActive(id) {
    if (!providers.has(id)) throw new Error("LLM provider not found: " + id);
    activeId = id;
    return activeId;
  }

  async function complete(request = {}) {
    const provider = providers.get(request.providerId || activeId);
    if (!provider) throw new Error("No LLM provider is configured.");
    const response = await provider.complete({ ...request, providerId: provider.id });
    if (typeof response === "string") return { providerId: provider.id, message: response };
    if (!response || typeof response !== "object") throw new Error("LLM provider returned an invalid response.");
    return { providerId: provider.id, ...response };
  }

  return Object.freeze({
    register,
    setActive,
    getActive: () => activeId,
    list: () => [...providers.values()].map((provider) => ({ id: provider.id, label: provider.label || provider.id })),
    complete
  });
}

export function createLocalContextProvider() {
  return Object.freeze({
    label: "Local Context",
    async complete({ prompt, context }) {
      const query = String(prompt || "").trim();
      const relevant = context?.relevantFiles || [];
      const active = context?.activeFile || "none";
      const problems = context?.problems || [];
      const lines = [
        `Local workspace analysis for: ${query || "(empty prompt)"}`,
        `Active file: ${active}`,
        `Relevant files: ${relevant.length ? relevant.map((item) => item.fileName).join(", ") : "none"}`,
        `Diagnostics: ${problems.length}`,
        "No external model is configured; this provider returns deterministic workspace context only."
      ];
      return { message: lines.join("\n"), kind: "context" };
    }
  });
}

export function createHttpLLMProvider({ endpoint, headers = {}, transformRequest, transformResponse, fetchImpl = typeof fetch === "function" ? fetch.bind(globalThis) : null } = {}) {
  const url = String(endpoint || "").trim();
  if (!url || !/^https?:\/\//i.test(url)) throw new Error("HTTP LLM provider requires an http(s) endpoint.");
  if (!fetchImpl) throw new Error("Fetch is unavailable.");
  return Object.freeze({
    label: "HTTP Provider",
    async complete(request) {
      const body = transformRequest ? transformRequest(request) : request;
      const response = await fetchImpl(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(body)
      });
      if (!response.ok) throw new Error(`LLM provider request failed (${response.status})`);
      const payload = await response.json();
      return transformResponse ? transformResponse(payload, request) : payload;
    }
  });
}
