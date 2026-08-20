const INTERACTIVE_SELECTOR = [
  "input",
  "textarea",
  "select",
  "button",
  "a[href]",
  "[contenteditable]:not([contenteditable='false'])",
  "[role='textbox']",
  "[role='combobox']",
  "[role='searchbox']",
  "[role='slider']",
  "[role='spinbutton']",
  "[role='menuitem']",
  "[role='option']",
  "[role='tab']"
].join(",");

function isInteractiveTarget(target) {
  return target instanceof Element && Boolean(target.closest(INTERACTIVE_SELECTOR));
}

export function bindKeyboard({ onHome, onSetAnchor, onGoAnchor, onUndo, onRedo, onFitContent }) {
  window.addEventListener("keydown", (event) => {
    if (
      event.defaultPrevented ||
      event.isComposing ||
      isInteractiveTarget(event.target) ||
      isInteractiveTarget(document.activeElement)
    ) {
      return;
    }

    const primaryModifier = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();

    if (primaryModifier && !event.altKey && (key === "z" || key === "y")) {
      event.preventDefault();
      if (key === "y" || event.shiftKey) onRedo?.();
      else onUndo?.();
      return;
    }

    if (event.ctrlKey || event.metaKey || event.altKey) return;

    if (event.key === "0") {
      event.preventDefault();
      onHome();
      return;
    }

    if (key === "f" && !event.shiftKey) {
      event.preventDefault();
      onFitContent?.();
      return;
    }

    if (key !== "a") return;

    event.preventDefault();
    if (event.shiftKey) onGoAnchor();
    else onSetAnchor();
  });
}
