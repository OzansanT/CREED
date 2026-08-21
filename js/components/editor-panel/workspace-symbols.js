import { getFileExtension } from "./file-metadata.js";
import { searchSource } from "./source-analysis.js";

function pushSymbol(symbols, seen, symbol) {
  const key = `${symbol.name}:${symbol.line}:${symbol.column}:${symbol.kind}`;
  if (!symbol.name || seen.has(key)) return;
  seen.add(key);
  symbols.push(symbol);
}

export function extractSourceSymbols(fileName, source) {
  const extension = getFileExtension(fileName);
  const lines = String(source ?? "").replace(/\r\n?/g, "\n").split("\n");
  const symbols = [];
  const seen = new Set();

  lines.forEach((lineText, line) => {
    if (["js", "mjs", "cjs"].includes(extension)) {
      for (const match of lineText.matchAll(/\b(function|class)\s+([A-Za-z_$][\w$]*)/g)) {
        pushSymbol(symbols, seen, { fileName, name: match[2], kind: match[1], line, column: match.index + match[0].lastIndexOf(match[2]) });
      }
      for (const match of lineText.matchAll(/\b(const|let|var)\s+([A-Za-z_$][\w$]*)/g)) {
        pushSymbol(symbols, seen, { fileName, name: match[2], kind: "variable", line, column: match.index + match[0].lastIndexOf(match[2]) });
      }
    } else if (extension === "css") {
      const match = lineText.match(/^\s*([^@][^{]+)\s*\{/);
      if (match) pushSymbol(symbols, seen, { fileName, name: match[1].trim(), kind: "selector", line, column: lineText.indexOf(match[1]) });
    } else if (["html", "htm"].includes(extension)) {
      for (const match of lineText.matchAll(/\bid=["']([^"']+)["']/g)) {
        pushSymbol(symbols, seen, { fileName, name: match[1], kind: "id", line, column: match.index });
      }
      for (const match of lineText.matchAll(/<h([1-6])\b[^>]*>([^<]+)</gi)) {
        pushSymbol(symbols, seen, { fileName, name: match[2].trim(), kind: `heading-${match[1]}`, line, column: match.index });
      }
    } else if (extension === "md") {
      const match = lineText.match(/^(#{1,6})\s+(.+)$/);
      if (match) pushSymbol(symbols, seen, { fileName, name: match[2].trim(), kind: `heading-${match[1].length}`, line, column: match[1].length + 1 });
    } else if (extension === "json") {
      for (const match of lineText.matchAll(/"([^"\\]+)"\s*:/g)) {
        pushSymbol(symbols, seen, { fileName, name: match[1], kind: "property", line, column: match.index + 1 });
      }
    }
  });

  return symbols;
}

export function createLanguageProviderRegistry() {
  const providers = new Map();

  function register(language, provider) {
    if (!language || !provider || typeof provider !== "object") throw new TypeError("A language provider requires a language and provider object.");
    providers.set(language, provider);
    return () => providers.delete(language);
  }

  async function invoke(method, request) {
    const provider = providers.get(request?.language) || providers.get("*");
    if (!provider || typeof provider[method] !== "function") return null;
    return provider[method](request);
  }

  return Object.freeze({
    register,
    provideDefinition: (request) => invoke("provideDefinition", request),
    provideReferences: (request) => invoke("provideReferences", request),
    provideSymbols: (request) => invoke("provideSymbols", request),
    languages: () => [...providers.keys()]
  });
}

export function createWorkspaceSymbolIndex({ workspace } = {}) {
  if (!workspace?.listFiles || !workspace?.readFile) throw new TypeError("Workspace symbol index requires a workspace file-system.");
  const byFile = new Map();
  let allSymbols = [];

  async function indexFile(fileName) {
    const source = await workspace.readFile(fileName);
    const symbols = extractSourceSymbols(fileName, source);
    byFile.set(fileName, symbols);
    return symbols;
  }

  async function refresh() {
    byFile.clear();
    const files = workspace.listFiles();
    for (const fileName of files) {
      try {
        await indexFile(fileName);
      } catch {
        byFile.set(fileName, []);
      }
    }
    allSymbols = [...byFile.values()].flat().sort((a, b) => a.name.localeCompare(b.name) || a.fileName.localeCompare(b.fileName) || a.line - b.line);
    return allSymbols.map((symbol) => ({ ...symbol }));
  }

  function fileSymbols(fileName) {
    return (byFile.get(fileName) || []).map((symbol) => ({ ...symbol }));
  }

  function searchSymbols(query, { limit = 200 } = {}) {
    const needle = String(query ?? "").trim().toLowerCase();
    const source = needle ? allSymbols.filter((symbol) => symbol.name.toLowerCase().includes(needle)) : allSymbols;
    return source.slice(0, limit).map((symbol) => ({ ...symbol }));
  }

  function findDefinition(name, { fileName } = {}) {
    const candidates = allSymbols.filter((symbol) => symbol.name === name);
    const local = fileName ? candidates.find((symbol) => symbol.fileName === fileName) : null;
    return local ? { ...local } : candidates[0] ? { ...candidates[0] } : null;
  }

  async function findReferences(name, { matchCase = true, limit = 1000 } = {}) {
    const references = [];
    for (const fileName of workspace.listFiles()) {
      let source;
      try {
        source = await workspace.readFile(fileName);
      } catch {
        continue;
      }
      const lines = source.split("\n");
      const result = searchSource(source, name, { wholeWord: true, matchCase, maxMatches: Math.max(1, limit - references.length) });
      for (const match of result.matches) {
        references.push({
          fileName,
          line: match.line,
          column: match.column,
          lineNumber: match.line + 1,
          columnNumber: match.column + 1,
          preview: (lines[match.line] || "").trim().slice(0, 240)
        });
        if (references.length >= limit) return references;
      }
    }
    return references;
  }

  const provider = Object.freeze({
    provideDefinition: ({ symbol, fileName }) => findDefinition(symbol, { fileName }),
    provideReferences: ({ symbol, matchCase }) => findReferences(symbol, { matchCase }),
    provideSymbols: ({ fileName, query } = {}) => fileName ? fileSymbols(fileName) : searchSymbols(query)
  });

  return Object.freeze({ refresh, indexFile, fileSymbols, searchSymbols, findDefinition, findReferences, provider });
}
