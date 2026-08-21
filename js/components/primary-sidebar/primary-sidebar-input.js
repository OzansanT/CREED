export function bindPrimarySidebar({
  app,
  sidebar,
  layoutButton,
  explorerButton,
  searchButton,
  explorerView,
  searchView,
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

    const explorerActive = visible && activeView === "explorer";
    explorerButton.setAttribute("aria-expanded", String(explorerActive));
    explorerButton.classList.toggle("is-active", explorerActive);
    if (searchButton) {
      const searchActive = visible && activeView === "search";
      searchButton.setAttribute("aria-expanded", String(searchActive));
      searchButton.classList.toggle("is-active", searchActive);
    }
    if (explorerView) explorerView.hidden = activeView !== "explorer";
    if (searchView) searchView.hidden = activeView !== "search";
  }

  function setVisible(nextVisible, notify = true) {
    visible = Boolean(nextVisible);
    synchronize();
    if (notify) onLayoutChange?.(visible);
  }

  function setActiveView(viewName, { ensureVisible = true, notify = true } = {}) {
    if (!["explorer", "search"].includes(viewName)) return false;
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
  synchronize();

  return Object.freeze({
    isVisible: () => visible,
    setVisible,
    toggle,
    setActiveView,
    getActiveView: () => activeView
  });
}
