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

export function bindKeyboard({ onHome, onSetAnchor, onGoAnchor }) {
  window.addEventListener("keydown", (event) => {
    if (
      event.defaultPrevented ||
      event.isComposing ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      isInteractiveTarget(event.target) ||
      isInteractiveTarget(document.activeElement)
    ) {
      return;
    }

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
