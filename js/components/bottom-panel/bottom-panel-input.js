export function bindBottomPanel({
  workbench,
  panel,
  layoutButton,
  tabs,
  views,
  maximizeButton,
  closeButton,
  onLayoutChange
}) {
  let visible = !panel.hidden;
  let maximized = false;
  let activeView = "terminal";

  function setMaximized(nextMaximized, notify = true) {
    const next = Boolean(nextMaximized) && visible;
    if (maximized === next) return false;
    maximized = next;
    panel.classList.toggle("is-maximized", maximized);
    workbench.classList.toggle("is-bottom-panel-maximized", maximized);
    maximizeButton?.setAttribute("aria-pressed", String(maximized));
    if (notify) onLayoutChange?.(visible);
    return true;
  }

  function setVisible(nextVisible, notify = true) {
    visible = Boolean(nextVisible);
    if (!visible && maximized) setMaximized(false, false);
    panel.hidden = !visible;
    panel.classList.toggle("is-collapsed", !visible);
    workbench.classList.toggle("is-bottom-panel-collapsed", !visible);
    layoutButton.setAttribute("aria-expanded", String(visible));
    if (notify) onLayoutChange?.(visible);
  }

  function setActiveView(viewName, focus = false) {
    const targetTab = tabs.find((tab) => tab.dataset.panelView === viewName);
    const targetView = views.find((view) => view.id === targetTab?.getAttribute("aria-controls"));
    if (!targetTab || !targetView) return false;

    activeView = viewName;
    tabs.forEach((tab) => {
      const selected = tab === targetTab;
      tab.classList.toggle("is-active", selected);
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
    });
    views.forEach((view) => { view.hidden = view !== targetView; });
    if (focus) targetTab.focus();
    return true;
  }

  function focusRelative(currentTab, direction) {
    const currentIndex = tabs.indexOf(currentTab);
    const nextIndex = (currentIndex + direction + tabs.length) % tabs.length;
    setActiveView(tabs[nextIndex].dataset.panelView, true);
  }

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => setActiveView(tab.dataset.panelView));
    tab.addEventListener("keydown", (event) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        focusRelative(tab, -1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        focusRelative(tab, 1);
      } else if (event.key === "Home") {
        event.preventDefault();
        setActiveView(tabs[0].dataset.panelView, true);
      } else if (event.key === "End") {
        event.preventDefault();
        setActiveView(tabs.at(-1).dataset.panelView, true);
      }
    });
  });

  layoutButton.addEventListener("click", () => setVisible(!visible));
  closeButton?.addEventListener("click", () => setVisible(false));
  maximizeButton?.addEventListener("click", () => setMaximized(!maximized));

  setActiveView(activeView);
  setVisible(visible, false);

  return Object.freeze({
    isVisible: () => visible,
    isMaximized: () => maximized,
    getActiveView: () => activeView,
    setActiveView,
    setVisible,
    setMaximized,
    toggle: () => setVisible(!visible)
  });
}
