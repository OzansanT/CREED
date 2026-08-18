export function bindSecondarySidebar({
  app,
  panel,
  layoutButton,
  maximizeButton,
  closeButton,
  onLayoutChange
}) {
  let visible = !panel.hidden;
  let maximized = false;

  function setVisible(nextVisible, notify = true) {
    visible = Boolean(nextVisible);
    if (!visible && maximized) {
      maximized = false;
      panel.classList.remove("is-maximized");
      maximizeButton?.setAttribute("aria-pressed", "false");
    }
    panel.hidden = !visible;
    panel.classList.toggle("is-collapsed", !visible);
    app.classList.toggle("is-secondary-sidebar-collapsed", !visible);
    layoutButton.setAttribute("aria-expanded", String(visible));
    if (notify) onLayoutChange?.(visible);
  }

  function toggle() {
    setVisible(!visible);
  }

  layoutButton.addEventListener("click", toggle);
  closeButton?.addEventListener("click", () => setVisible(false));
  maximizeButton?.addEventListener("click", () => {
    maximized = !maximized;
    panel.classList.toggle("is-maximized", maximized);
    maximizeButton.setAttribute("aria-pressed", String(maximized));
    onLayoutChange?.(visible);
  });
  setVisible(visible, false);

  return Object.freeze({
    isVisible: () => visible,
    isMaximized: () => maximized,
    setVisible,
    toggle
  });
}
