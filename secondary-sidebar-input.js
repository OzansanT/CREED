const RESPONSIVE_SECONDARY_SIDEBAR_QUERY = "(max-width: 1180px)";

export function bindSecondarySidebar({
  app,
  panel,
  layoutButton,
  maximizeButton,
  closeButton,
  onLayoutChange
}) {
  const responsiveQuery = window.matchMedia(RESPONSIVE_SECONDARY_SIDEBAR_QUERY);
  let preferredVisible = !panel.hidden;
  let responsiveHidden = responsiveQuery.matches;
  let maximized = false;

  function isRenderedVisible() {
    return preferredVisible && !responsiveHidden;
  }

  function render(notify = true) {
    const visible = isRenderedVisible();

    if (!visible && maximized) {
      maximized = false;
      panel.classList.remove("is-maximized");
      maximizeButton?.setAttribute("aria-pressed", "false");
    }

    panel.hidden = !visible;
    panel.classList.toggle("is-collapsed", !visible);
    app.classList.toggle("is-secondary-sidebar-collapsed", !visible);
    layoutButton.setAttribute("aria-expanded", String(visible));
    layoutButton.setAttribute("aria-disabled", String(responsiveHidden));
    layoutButton.disabled = responsiveHidden;
    maximizeButton?.setAttribute("aria-disabled", String(responsiveHidden));
    if (maximizeButton) maximizeButton.disabled = responsiveHidden;

    if (notify) onLayoutChange?.(visible);
  }

  function setVisible(nextVisible, notify = true) {
    preferredVisible = Boolean(nextVisible);
    render(notify);
  }

  function toggle() {
    if (responsiveHidden) return;
    setVisible(!preferredVisible);
  }

  layoutButton.addEventListener("click", toggle);
  closeButton?.addEventListener("click", () => setVisible(false));
  maximizeButton?.addEventListener("click", () => {
    if (responsiveHidden || !isRenderedVisible()) return;
    maximized = !maximized;
    panel.classList.toggle("is-maximized", maximized);
    maximizeButton.setAttribute("aria-pressed", String(maximized));
    onLayoutChange?.(true);
  });

  const handleResponsiveChange = (event) => {
    responsiveHidden = event.matches;
    render(true);
  };

  responsiveQuery.addEventListener?.("change", handleResponsiveChange);
  render(false);

  return Object.freeze({
    isVisible: () => preferredVisible,
    isRenderedVisible,
    isMaximized: () => maximized,
    setVisible,
    toggle
  });
}
