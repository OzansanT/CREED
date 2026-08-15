import { createCommand } from "./command-engine.js";

function getToken(tokens, path) {
  return path.split(".").reduce((value, key) => value?.[key], tokens);
}

function setToken(tokens, path, value) {
  const keys = path.split(".");
  const last = keys.pop();
  const parent = keys.reduce((target, key) => target[key], tokens);
  parent[last] = value;
}

export function bindDesignTokenInput({ form, state, commandEngine }) {
  let signature = "";

  function sync() {
    const nextSignature = JSON.stringify(state.designTokens);
    if (nextSignature === signature) return;
    signature = nextSignature;
    form.querySelectorAll("[data-token]").forEach((input) => {
      input.value = getToken(state.designTokens, input.dataset.token) ?? "";
    });
  }

  form.addEventListener("change", (event) => {
    const input = event.target.closest?.("[data-token]");
    if (!input) return;
    const path = input.dataset.token;
    const before = getToken(state.designTokens, path);
    const after = input.value;
    commandEngine.execute(createCommand({
      label: "Update design token",
      redo: () => setToken(state.designTokens, path, after),
      undo: () => setToken(state.designTokens, path, before)
    }));
  });

  return Object.freeze({ sync });
}
