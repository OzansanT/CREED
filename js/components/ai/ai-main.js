import { createAgentToolSandbox } from "./agent-sandbox.js";
import { createLLMProviderRegistry, createLocalContextProvider } from "./llm-provider.js";
import { createSemanticRepositoryIndex } from "./semantic-index.js";
import { createWorkspaceContextEngine } from "./workspace-context.js";

export function bindAIWorkbench({ editorPanel, diagnostics, notify } = {}) {
  const workspace = editorPanel?.workspace;
  if (!workspace) throw new TypeError("AI workbench requires the editor workspace.");

  const semanticIndex = createSemanticRepositoryIndex({ workspace });
  const contextEngine = createWorkspaceContextEngine({
    workspace,
    semanticIndex,
    getActiveFile: editorPanel.getActiveFile,
    getOpenFiles: editorPanel.getOpenFiles,
    getProblems: diagnostics.model.list
  });
  const providers = createLLMProviderRegistry();
  providers.register("local-context", createLocalContextProvider());
  const sandbox = createAgentToolSandbox({ workspace, semanticIndex, contextEngine });

  semanticIndex.refresh().catch((error) => notify?.(error instanceof Error ? error.message : String(error)));

  return Object.freeze({
    providers,
    semanticIndex,
    contextEngine,
    sandbox,
    refreshIndex: semanticIndex.refresh
  });
}
