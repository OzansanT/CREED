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
  const header = panel.querySelector("#secondarySidebarHeader");
  const actions = panel.querySelector(".secondary-sidebar__actions");
  if (header && actions && actions.parentElement === header) {
    panel.insertBefore(actions, header);
  }

  let preferredVisible = !panel.hidden;
  let responsiveHidden = responsiveQuery.matches;
  let maximized = false;

  function isRenderedVisible() {
    return preferredVisible && !responsiveHidden;
  }

  function setMaximized(nextMaximized, notify = true) {
    const next = Boolean(nextMaximized) && isRenderedVisible();
    if (maximized === next) return false;
    maximized = next;
    panel.classList.toggle("is-maximized", maximized);
    maximizeButton?.setAttribute("aria-pressed", String(maximized));
    if (notify) onLayoutChange?.(isRenderedVisible());
    return true;
  }

  function render(notify = true) {
    const visible = isRenderedVisible();

    if (!visible && maximized) setMaximized(false, false);

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
    setMaximized(!maximized);
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
    setMaximized,
    toggle
  });
}
