export function createWorkspaceContextEngine({
  workspace,
  semanticIndex,
  getActiveFile = () => "",
  getOpenFiles = () => [],
  getProblems = () => [],
  getGraph = () => ({ nodes: [], edges: [] })
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

  function graphNeighbors(fileName) {
    const graph = getGraph() || { nodes: [], edges: [] };
    const nodeId = `file:${fileName}`;
    const neighbors = new Set();
    for (const edge of graph.edges || []) {
      if (edge.from === nodeId && edge.to.startsWith("file:")) neighbors.add(edge.to.slice(5));
      if (edge.to === nodeId && edge.from.startsWith("file:")) neighbors.add(edge.from.slice(5));
    }
    return [...neighbors].slice(0, 20);
  }

  async function build(prompt, { maxRelevantFiles = 8, maxExcerptChars = 5000 } = {}) {
    const activeFile = getActiveFile() || "";
    const openFiles = [...new Set((getOpenFiles() || []).filter(Boolean))];
    const semanticMatches = semanticIndex.search(prompt, { limit: maxRelevantFiles });
    const candidateFiles = [...new Set([
      activeFile,
      ...openFiles,
      ...semanticMatches.map((match) => match.fileName),
      ...graphNeighbors(activeFile)
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
    const graph = getGraph() || { nodes: [], edges: [] };
    return Object.freeze({
      prompt: String(prompt || ""),
      activeFile,
      openFiles,
      relevantFiles: semanticMatches,
      excerpts,
      problems,
      graphSummary: {
        nodes: graph.nodes?.length || 0,
        edges: graph.edges?.length || 0,
        neighbors: activeFile ? graphNeighbors(activeFile) : []
      }
    });
  }

  return Object.freeze({ build, graphNeighbors, fileExcerpt });
}
