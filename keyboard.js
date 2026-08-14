export function bindKeyboard({ onHome, onSetAnchor, onGoAnchor }) {
  window.addEventListener("keydown", event => { const tag = document.activeElement?.tagName; if (tag === "INPUT" || tag === "TEXTAREA") return; if (event.key === "0") { onHome(); return; } if (event.key.toLowerCase() === "a" && !event.shiftKey) { onSetAnchor(); return; } if (event.key.toLowerCase() === "a" && event.shiftKey) onGoAnchor(); });
}
