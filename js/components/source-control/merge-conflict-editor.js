function markerText(conflict) {
  return [
    "<<<<<<< CURRENT",
    conflict.current,
    "=======",
    conflict.incoming,
    ">>>>>>> INCOMING"
  ].join("\n");
}

export function renderMergeConflictEditor({ container, conflicts, provider, onResolved, notify } = {}) {
  container.replaceChildren();
  const pending = new Map((conflicts || []).map((conflict) => [conflict.path, conflict]));

  function removeResolved(path) {
    pending.delete(path);
    container.querySelector(`[data-conflict-path="${CSS.escape(path)}"]`)?.remove();
    onResolved?.(path, pending.size);
  }

  async function resolve(path, content) {
    try {
      await provider.resolveConflict(path, content);
      removeResolved(path);
      notify?.("Resolved merge conflict: " + path);
      return true;
    } catch (error) {
      notify?.(error instanceof Error ? error.message : String(error));
      return false;
    }
  }

  for (const conflict of pending.values()) {
    const card = document.createElement("section");
    card.dataset.conflictPath = conflict.path;
    card.style.borderBlockEnd = "1px solid var(--border-subtle, #ddd)";
    card.style.padding = "8px";

    const title = document.createElement("strong");
    title.textContent = "Conflict: " + conflict.path;
    const textarea = document.createElement("textarea");
    textarea.value = markerText(conflict);
    textarea.setAttribute("aria-label", "Merge resolution for " + conflict.path);
    Object.assign(textarea.style, { width: "100%", minHeight: "180px", fontFamily: "monospace" });

    const actions = document.createElement("div");
    actions.className = "toolbar";
    const choices = [
      ["Accept Current", conflict.currentDeleted ? null : conflict.current],
      ["Accept Incoming", conflict.incomingDeleted ? null : conflict.incoming],
      ["Accept Both", [conflict.current, conflict.incoming].filter(Boolean).join("\n")]
    ];
    for (const [label, content] of choices) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.addEventListener("click", () => resolve(conflict.path, content));
      actions.append(button);
    }
    const edited = document.createElement("button");
    edited.type = "button";
    edited.textContent = "Resolve Edited";
    edited.addEventListener("click", () => resolve(conflict.path, textarea.value));
    actions.append(edited);

    card.append(title, textarea, actions);
    container.append(card);
  }

  if (!pending.size) {
    const empty = document.createElement("p");
    empty.textContent = "No merge conflicts.";
    container.append(empty);
  }

  return Object.freeze({
    pendingCount: () => pending.size,
    resolve
  });
}
