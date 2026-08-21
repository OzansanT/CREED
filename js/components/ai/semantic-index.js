const TOKEN_PATTERN = /[A-Za-z_$][\w$-]{1,63}/g;
const DEFAULT_MAX_FILE_CHARS = 120000;

export function tokenizeSemanticText(value) {
  const counts = new Map();
  for (const match of String(value || "").toLowerCase().matchAll(TOKEN_PATTERN)) {
    const token = match[0];
    counts.set(token, (counts.get(token) || 0) + 1);
  }
  return counts;
}

export function createSemanticRepositoryIndex({ workspace, maxFileChars = DEFAULT_MAX_FILE_CHARS } = {}) {
  if (!workspace?.listFiles || !workspace?.readFile) throw new TypeError("Semantic index requires a workspace.");
  const documents = new Map();
  const postings = new Map();
  let generation = 0;

  function removeDocument(fileName) {
    const existing = documents.get(fileName);
    if (!existing) return;
    for (const token of existing.tokens.keys()) {
      const files = postings.get(token);
      files?.delete(fileName);
      if (!files?.size) postings.delete(token);
    }
    documents.delete(fileName);
  }

  async function indexFile(fileName) {
    removeDocument(fileName);
    let source = "";
    try { source = await workspace.readFile(fileName); } catch { return null; }
    source = String(source).slice(0, maxFileChars);
    const tokens = tokenizeSemanticText(`${fileName}\n${source}`);
    const document = { fileName, source, tokens, length: [...tokens.values()].reduce((sum, value) => sum + value, 0) || 1 };
    documents.set(fileName, document);
    for (const token of tokens.keys()) {
      if (!postings.has(token)) postings.set(token, new Set());
      postings.get(token).add(fileName);
    }
    return document;
  }

  async function refresh() {
    const token = ++generation;
    documents.clear();
    postings.clear();
    for (const fileName of workspace.listFiles()) {
      if (token !== generation) return [];
      await indexFile(fileName);
    }
    return listDocuments();
  }

  function listDocuments() {
    return [...documents.values()].map((document) => ({ fileName: document.fileName, length: document.length }));
  }

  function search(query, { limit = 12 } = {}) {
    const queryTokens = tokenizeSemanticText(query);
    if (!queryTokens.size) return [];
    const totalDocuments = Math.max(1, documents.size);
    const candidates = new Set();
    for (const token of queryTokens.keys()) for (const fileName of postings.get(token) || []) candidates.add(fileName);
    const results = [];
    for (const fileName of candidates) {
      const document = documents.get(fileName);
      let score = 0;
      const matches = [];
      for (const [token, queryWeight] of queryTokens) {
        const frequency = document.tokens.get(token) || 0;
        if (!frequency) continue;
        const documentFrequency = postings.get(token)?.size || 1;
        const inverseDocumentFrequency = Math.log(1 + (totalDocuments / documentFrequency));
        score += queryWeight * (frequency / Math.sqrt(document.length)) * inverseDocumentFrequency;
        matches.push(token);
      }
      if (score > 0) results.push({ fileName, score, matches });
    }
    return results.sort((a, b) => b.score - a.score || a.fileName.localeCompare(b.fileName)).slice(0, limit);
  }

  const unsubscribe = workspace.subscribe?.((change) => {
    if (change?.type === "workspace-reset") {
      refresh().catch(() => {});
      return;
    }
    if (change?.path) indexFile(change.path).catch(() => {});
    if (change?.target) indexFile(change.target).catch(() => {});
  });

  return Object.freeze({
    refresh,
    indexFile,
    search,
    listDocuments,
    dispose: () => unsubscribe?.()
  });
}
