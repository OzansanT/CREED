import { searchSource } from "./source-analysis.js";

const DEFAULT_MAX_FILES = 500;
const DEFAULT_MAX_MATCHES_PER_FILE = 500;

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function createWorkspaceSearchPattern(query, options = {}) {
  const sourceQuery = String(query ?? "");
  if (!sourceQuery) return null;
  const source = options.useRegex ? sourceQuery : escapeRegExp(sourceQuery);
  const wrapped = options.wholeWord ? `\\b(?:${source})\\b` : source;
  try {
    return new RegExp(wrapped, options.matchCase ? "g" : "gi");
  } catch (error) {
    throw new Error("Invalid workspace search expression: " + (error instanceof Error ? error.message : String(error)));
  }
}

export function createWorkspaceSearchEngine({ workspace, maxFiles = DEFAULT_MAX_FILES } = {}) {
  if (!workspace?.listFiles || !workspace?.readFile) throw new TypeError("Workspace search requires a workspace file-system.");

  async function search(query, options = {}) {
    const needle = String(query ?? "");
    if (!needle) return { query: needle, groups: [], totalMatches: 0, truncated: false };
    const groups = [];
    let totalMatches = 0;
    let truncated = false;
    const files = workspace.listFiles().slice(0, maxFiles);
    if (workspace.listFiles().length > files.length) truncated = true;

    for (const fileName of files) {
      let source;
      try {
        source = await workspace.readFile(fileName);
      } catch {
        continue;
      }
      const result = searchSource(source, needle, {
        matchCase: Boolean(options.matchCase),
        wholeWord: Boolean(options.wholeWord),
        useRegex: Boolean(options.useRegex),
        maxMatches: options.maxMatchesPerFile || DEFAULT_MAX_MATCHES_PER_FILE
      });
      if (!result.matches.length) continue;
      const lines = source.split("\n");
      const matches = result.matches.map((match) => ({
        ...match,
        fileName,
        lineNumber: match.line + 1,
        columnNumber: match.column + 1,
        preview: (lines[match.line] || "").trim().slice(0, 240)
      }));
      totalMatches += matches.length;
      truncated ||= Boolean(result.truncated);
      groups.push({ fileName, matches, truncated: Boolean(result.truncated) });
    }
    return { query: needle, groups, totalMatches, truncated };
  }

  async function replaceAll(query, replacement, options = {}) {
    const pattern = createWorkspaceSearchPattern(query, options);
    if (!pattern) return { filesChanged: 0, replacements: 0, changedFiles: [] };
    const changedFiles = [];
    let replacements = 0;
    for (const fileName of workspace.listFiles().slice(0, maxFiles)) {
      let source;
      try {
        source = await workspace.readFile(fileName);
      } catch {
        continue;
      }
      pattern.lastIndex = 0;
      const matches = [...source.matchAll(pattern)];
      if (!matches.length) continue;
      pattern.lastIndex = 0;
      const nextSource = source.replace(pattern, String(replacement ?? ""));
      workspace.writeFile(fileName, nextSource);
      replacements += matches.length;
      changedFiles.push(fileName);
    }
    return { filesChanged: changedFiles.length, replacements, changedFiles };
  }

  return Object.freeze({ search, replaceAll });
}
