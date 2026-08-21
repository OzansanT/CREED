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

export function getRovingTabIndexes({ activeIndex, length }) {
  if (!Number.isInteger(length) || length <= 0) return [];
  const normalizedIndex = Number.isInteger(activeIndex) && activeIndex >= 0 && activeIndex < length
    ? activeIndex
    : 0;
  return Array.from({ length }, (_, index) => index === normalizedIndex ? 0 : -1);
}

function chooseActiveIndex(controls, preferredControl) {
  const preferredIndex = controls.indexOf(preferredControl);
  if (preferredIndex >= 0) return preferredIndex;

  const selectedIndex = controls.findIndex((control) =>
    control.getAttribute("aria-selected") === "true" || control.classList.contains("is-active")
  );
  if (selectedIndex >= 0) return selectedIndex;

  const existingTabStop = controls.findIndex((control) => control.tabIndex === 0);
  return existingTabStop >= 0 ? existingTabStop : 0;
}

function applyRovingTabIndexes(controls, activeIndex) {
  const tabIndexes = getRovingTabIndexes({ activeIndex, length: controls.length });
  controls.forEach((control, index) => {
    control.tabIndex = tabIndexes[index];
  });
}

export function bindRovingNavigation(container, selector, orientation = "horizontal") {
  if (!container) return () => {};

  function items() {
    return [...container.querySelectorAll(selector)]
      .filter((item) => !item.hidden && !item.disabled && item.getClientRects().length);
  }

  function synchronize(preferredControl = null) {
    const controls = items();
    if (controls.length === 0) return controls;
    applyRovingTabIndexes(controls, chooseActiveIndex(controls, preferredControl));
    return controls;
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
    applyRovingTabIndexes(controls, nextIndex);
    controls[nextIndex]?.focus();
  }

  function handleFocusIn(event) {
    const current = event.target instanceof Element ? event.target.closest(selector) : null;
    if (!current || !container.contains(current)) return;
    synchronize(current);
  }

  container.addEventListener("keydown", handleKeydown);
  container.addEventListener("focusin", handleFocusIn);
  synchronize();

  return () => {
    container.removeEventListener("keydown", handleKeydown);
    container.removeEventListener("focusin", handleFocusIn);
  };
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
