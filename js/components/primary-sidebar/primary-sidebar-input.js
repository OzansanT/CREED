export function bindPrimarySidebar({
  app,
  sidebar,
  layoutButton,
  explorerButton,
  searchButton,
  sourceControlButton,
  runButton,
  explorerView,
  searchView,
  sourceControlView,
  runView,
  onLayoutChange,
  onViewChange
}) {
  let visible = !sidebar.hidden;
  let activeView = "explorer";

  function synchronize() {
    sidebar.hidden = !visible;
    sidebar.classList.toggle("is-collapsed", !visible);
    app.classList.toggle("is-primary-sidebar-collapsed", !visible);
    layoutButton.setAttribute("aria-expanded", String(visible));

    const controls = [
      ["explorer", explorerButton, explorerView],
      ["search", searchButton, searchView],
      ["sourceControl", sourceControlButton, sourceControlView],
      ["run", runButton, runView]
    ];
    for (const [viewName, button, view] of controls) {
      if (button) {
        const active = visible && activeView === viewName;
        button.setAttribute("aria-expanded", String(active));
        button.classList.toggle("is-active", active);
      }
      if (view) view.hidden = activeView !== viewName;
    }
  }

  function setVisible(nextVisible, notify = true) {
    visible = Boolean(nextVisible);
    synchronize();
    if (notify) onLayoutChange?.(visible);
  }

  function setActiveView(viewName, { ensureVisible = true, notify = true } = {}) {
    if (!["explorer", "search", "sourceControl", "run"].includes(viewName)) return false;
    const changed = activeView !== viewName;
    activeView = viewName;
    if (ensureVisible) visible = true;
    synchronize();
    if (notify && changed) onViewChange?.(activeView);
    if (notify) onLayoutChange?.(visible);
    return true;
  }

  function toggle() {
    setVisible(!visible);
  }

  function activateFromButton(viewName) {
    if (visible && activeView === viewName) {
      setVisible(false);
      return;
    }
    setActiveView(viewName);
  }

  layoutButton.addEventListener("click", toggle);
  explorerButton.addEventListener("click", () => activateFromButton("explorer"));
  searchButton?.addEventListener("click", () => activateFromButton("search"));
  sourceControlButton?.addEventListener("click", () => activateFromButton("sourceControl"));
  runButton?.addEventListener("click", () => activateFromButton("run"));
  synchronize();

  return Object.freeze({
    isVisible: () => visible,
    setVisible,
    toggle,
    setActiveView,
    getActiveView: () => activeView
  });
}
