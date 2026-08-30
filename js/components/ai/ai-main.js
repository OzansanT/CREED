import { createAgentToolSandbox } from "./agent-sandbox.js";
import { bindAIChat } from "./chat-main.js";
import { createLLMProviderRegistry, createLocalContextProvider } from "./llm-provider.js";
import { createSemanticRepositoryIndex } from "./semantic-index.js";
import { createWorkspaceContextEngine } from "./workspace-context.js";

export function bindAIWorkbench({ elements, editorPanel, diagnostics, notify } = {}) {
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
  const chat = bindAIChat({
    messages: elements.chatMessages,
    emptyState: elements.chatEmptyState,
    promptInput: elements.chatPromptInput,
    sendButton: elements.sendChatMessageBtn,
    newChatButton: elements.newChatBtn,
    settingsButton: elements.chatSettingsBtn,
    providerRegistry: providers,
    contextEngine,
    toolSandbox: sandbox,
    workspace,
    notify
  });

  semanticIndex.refresh().catch((error) => notify?.(error instanceof Error ? error.message : String(error)));

  return Object.freeze({
    chat,
    providers,
    semanticIndex,
    contextEngine,
    sandbox,
    refreshIndex: semanticIndex.refresh
  });
}
