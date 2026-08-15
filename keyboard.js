function isInteractiveTarget(target) {
  return target instanceof Element && Boolean(
    target.closest("input, textarea, select, button, a, [contenteditable='true'], [role='textbox']")
  );
}

export function bindKeyboard({ onHome, onSetAnchor, onGoAnchor }) {
  window.addEventListener("keydown", (event) => {
    if (isInteractiveTarget(event.target) || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === "0") {
      event.preventDefault();
      onHome();
      return;
    }
    if (event.key.toLowerCase() !== "a") return;
    event.preventDefault();
    if (event.shiftKey) onGoAnchor();
    else onSetAnchor();
  });
}
