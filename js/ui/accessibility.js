export function getRovingTargetIndex({ index, length, key, orientation = "horizontal" }) {
  if (!Number.isInteger(index) || index < 0 || !Number.isInteger(length) || length <= 0) return null;
  const previousKey = orientation === "vertical" ? "ArrowUp" : "ArrowLeft";
  const nextKey = orientation === "vertical" ? "ArrowDown" : "ArrowRight";

  if (key === previousKey) return (index - 1 + length) % length;
  if (key === nextKey) return (index + 1) % length;
  if (key === "Home") return 0;
  if (key === "End") return length - 1;
  return null;
}

export function bindRovingNavigation(container, selector, orientation = "horizontal") {
  if (!container) return () => {};

  function items() {
    return [...container.querySelectorAll(selector)]
      .filter((item) => !item.hidden && !item.disabled && item.getClientRects().length);
  }

  function handleKeydown(event) {
    const controls = items();
    const current = event.target instanceof Element ? event.target.closest(selector) : null;
    const index = controls.indexOf(current);
    const nextIndex = getRovingTargetIndex({
      index,
      length: controls.length,
      key: event.key,
      orientation
    });
    if (nextIndex == null) return;
    event.preventDefault();
    controls[nextIndex]?.focus();
  }

  container.addEventListener("keydown", handleKeydown);
  return () => container.removeEventListener("keydown", handleKeydown);
}

export function bindAccessibilityNavigation({
  activityBar,
  sidebarTabs,
  editorTabs,
  bottomTabs
}) {
  const dispose = [
    bindRovingNavigation(activityBar, ".activity-button", "vertical"),
    bindRovingNavigation(sidebarTabs, "[role='tab']", "vertical"),
    bindRovingNavigation(editorTabs, "[role='tab']", "horizontal"),
    bindRovingNavigation(bottomTabs, "[role='tab']", "horizontal")
  ];

  return Object.freeze({
    dispose: () => dispose.forEach((unbind) => unbind())
  });
}
