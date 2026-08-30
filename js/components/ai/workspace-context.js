export function createWorkspaceContextEngine({
  workspace,
  semanticIndex,
  getActiveFile = () => "",
  getOpenFiles = () => [],
  getProblems = () => []
} = {}) {
  if (!workspace?.readFile || !workspace?.listFiles) throw new TypeError("Workspace context engine requires a workspace.");
  if (!semanticIndex?.search) throw new TypeError("Workspace context engine requires a semantic index.");

  async function fileExcerpt(fileName, maxChars = 5000) {
    if (!fileName || !workspace.hasFile?.(fileName)) return null;
    try {
      return { fileName, content: String(await workspace.readFile(fileName)).slice(0, maxChars) };
    } catch {
      return null;
    }
  }

  async function build(prompt, { maxRelevantFiles = 8, maxExcerptChars = 5000 } = {}) {
    const activeFile = getActiveFile() || "";
    const openFiles = [...new Set((getOpenFiles() || []).filter(Boolean))];
    const semanticMatches = semanticIndex.search(prompt, { limit: maxRelevantFiles });
    const candidateFiles = [...new Set([
      activeFile,
      ...openFiles,
      ...semanticMatches.map((match) => match.fileName)
    ].filter(Boolean))].slice(0, maxRelevantFiles);
    const excerpts = (await Promise.all(candidateFiles.map((fileName) => fileExcerpt(fileName, maxExcerptChars)))).filter(Boolean);
    const problems = (getProblems() || []).slice(0, 100).map((problem) => ({
      severity: problem.severity,
      code: problem.code,
      message: problem.message,
      fileName: problem.fileName,
      line: problem.line,
      column: problem.column
    }));
    return Object.freeze({
      prompt: String(prompt || ""),
      activeFile,
      openFiles,
      relevantFiles: semanticMatches,
      excerpts,
      problems
    });
  }

  return Object.freeze({ build, fileExcerpt });
}
