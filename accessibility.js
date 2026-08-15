function bindRovingNavigation(container, selector, orientation = "horizontal") {
  function items() {
    return [...container.querySelectorAll(selector)].filter((item) => !item.hidden && !item.disabled && item.getClientRects().length);
  }
  container.addEventListener("keydown", (event) => {
    const controls = items();
    const index = controls.indexOf(event.target.closest(selector));
    if (index < 0) return;
    const previousKey = orientation === "vertical" ? "ArrowUp" : "ArrowLeft";
    const nextKey = orientation === "vertical" ? "ArrowDown" : "ArrowRight";
    let next = null;
    if (event.key === previousKey) next = controls[(index - 1 + controls.length) % controls.length];
    else if (event.key === nextKey) next = controls[(index + 1) % controls.length];
    else if (event.key === "Home") next = controls[0];
    else if (event.key === "End") next = controls.at(-1);
    if (!next) return;
    event.preventDefault();
    next.focus();
  });
}

export function bindAccessibility({
  activityBar,
  sidebarTabs,
  editorTabs,
  bottomTabs,
  quickOpenDialog,
  announcer
}) {
  bindRovingNavigation(activityBar, ".activity-button", "vertical");
  bindRovingNavigation(sidebarTabs, "[role='tab']", "vertical");
  bindRovingNavigation(editorTabs, "[role='tab']", "horizontal");
  bindRovingNavigation(bottomTabs, "[role='tab']", "horizontal");
  document.querySelectorAll("[title]").forEach((element) => {
    if (!element.getAttribute("aria-label") && !element.textContent.trim()) element.setAttribute("aria-label", element.title);
  });
  document.getElementById("commandCenterBtn")?.setAttribute("aria-keyshortcuts", "Control+P Meta+P");
  document.getElementById("editorSaveBtn")?.setAttribute("aria-keyshortcuts", "Control+S Meta+S");
  document.getElementById("editorFindInput")?.setAttribute("aria-keyshortcuts", "Control+F Meta+F");
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && quickOpenDialog.open) quickOpenDialog.close();
  });
  return Object.freeze({
    announce(message) {
      announcer.textContent = "";
      requestAnimationFrame(() => { announcer.textContent = String(message || ""); });
    }
  });
}
