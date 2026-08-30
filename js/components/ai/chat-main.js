import { applyAIPatch, renderPatchApproval } from "./ai-patch.js";

function appendMessage(container, role, text) {
  const article = document.createElement("article");
  article.className = `chat-message chat-message--${role}`;
  article.dataset.role = role;
  const label = document.createElement("strong");
  label.textContent = role === "user" ? "You" : "CREED";
  const body = document.createElement("pre");
  body.style.whiteSpace = "pre-wrap";
  body.style.margin = "4px 0";
  body.textContent = String(text || "");
  article.append(label, body);
  container.append(article);
  container.scrollTop = container.scrollHeight;
  return article;
}

export function bindAIChat({
  messages,
  emptyState,
  promptInput,
  sendButton,
  newChatButton,
  settingsButton,
  providerRegistry,
  contextEngine,
  toolSandbox,
  workspace,
  notify
} = {}) {
  if (!messages || !promptInput || !sendButton || !providerRegistry || !contextEngine) {
    throw new TypeError("AI chat requires its DOM controls, provider registry, and context engine.");
  }
  let running = false;
  let generation = 0;

  function synchronize() {
    promptInput.disabled = running;
    sendButton.disabled = running;
    sendButton.setAttribute("aria-disabled", String(running));
    emptyState.hidden = messages.children.length > 0;
  }

  function clear() {
    generation += 1;
    running = false;
    messages.replaceChildren();
    promptInput.value = "";
    synchronize();
    promptInput.focus();
  }

  async function executeToolCalls(toolCalls = []) {
    const results = [];
    for (const call of toolCalls.slice(0, 12)) {
      const name = String(call?.name || "");
      try {
        const value = await toolSandbox?.invoke?.(name, call?.arguments || {});
        results.push({ name, ok: true, value });
      } catch (error) {
        results.push({ name, ok: false, error: error instanceof Error ? error.message : String(error) });
      }
    }
    return results;
  }

  async function handlePatch(response, article) {
    if (!response.patch) return null;
    const approvalHost = document.createElement("div");
    article.append(approvalHost);
    return renderPatchApproval({
      container: approvalHost,
      patch: response.patch,
      workspace,
      onApprove: async (patch) => {
        const applied = await applyAIPatch(patch, workspace, { approved: true });
        appendMessage(messages, "assistant", `Approved patch applied to ${applied.length} file(s).`);
        return applied;
      },
      onReject: () => appendMessage(messages, "assistant", "Patch rejected; workspace was not modified.")
    });
  }

  async function send() {
    const prompt = promptInput.value.trim();
    if (!prompt || running) return false;
    const token = ++generation;
    promptInput.value = "";
    appendMessage(messages, "user", prompt);
    running = true;
    synchronize();
    try {
      const context = await contextEngine.build(prompt);
      if (token !== generation) return false;
      let response = await providerRegistry.complete({
        prompt,
        context,
        tools: toolSandbox?.listTools?.() || []
      });
      if (token !== generation) return false;
      const toolResults = await executeToolCalls(response.toolCalls);
      if (token !== generation) return false;
      if (toolResults.length && response.continueWithTools) {
        response = await providerRegistry.complete({
          prompt,
          context,
          tools: toolSandbox?.listTools?.() || [],
          toolResults
        });
      }
      if (token !== generation) return false;
      const article = appendMessage(messages, "assistant", response.message || "No textual response.");
      await handlePatch(response, article);
      return true;
    } catch (error) {
      if (token === generation) {
        const message = error instanceof Error ? error.message : String(error);
        appendMessage(messages, "assistant", `Error: ${message}`);
        notify?.(message);
      }
      return false;
    } finally {
      if (token === generation) running = false;
      synchronize();
      promptInput.focus();
    }
  }

  function showSettings() {
    const existing = messages.querySelector("[data-provider-settings]");
    existing?.remove();
    const row = document.createElement("div");
    row.dataset.providerSettings = "true";
    row.className = "toolbar";
    const label = document.createElement("span");
    label.textContent = "Provider";
    const select = document.createElement("select");
    select.setAttribute("aria-label", "Chat provider");
    for (const provider of providerRegistry.list()) {
      const option = document.createElement("option");
      option.value = provider.id;
      option.textContent = provider.label;
      option.selected = provider.id === providerRegistry.getActive();
      select.append(option);
    }
    select.addEventListener("change", () => {
      providerRegistry.setActive(select.value);
      notify?.("Chat provider: " + select.selectedOptions[0]?.textContent);
    });
    row.append(label, select);
    messages.prepend(row);
    synchronize();
  }

  sendButton.addEventListener("click", send);
  promptInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      send();
    }
  });
  newChatButton?.addEventListener("click", clear);
  settingsButton?.addEventListener("click", showSettings);
  promptInput.disabled = false;
  sendButton.disabled = false;
  newChatButton && (newChatButton.disabled = false);
  settingsButton && (settingsButton.disabled = false);
  [promptInput, sendButton, newChatButton, settingsButton].filter(Boolean).forEach((control) => control.setAttribute("aria-disabled", "false"));
  synchronize();

  return Object.freeze({ send, clear, showSettings, isRunning: () => running });
}
