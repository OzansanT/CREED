export function bindPrimarySidebar({
  app,
  sidebar,
  layoutButton,
  explorerButton,
  onLayoutChange
}) {
  let visible = !sidebar.hidden;

  function setVisible(nextVisible, notify = true) {
    visible = Boolean(nextVisible);
    sidebar.hidden = !visible;
    app.classList.toggle("primary-sidebar-collapsed", !visible);
    layoutButton.setAttribute("aria-expanded", String(visible));
    explorerButton.setAttribute("aria-expanded", String(visible));
    explorerButton.classList.toggle("active", visible);
    if (notify) onLayoutChange?.(visible);
  }

  function toggle() {
    setVisible(!visible);
  }

  layoutButton.addEventListener("click", toggle);
  explorerButton.addEventListener("click", toggle);
  setVisible(visible, false);

  return Object.freeze({
    isVisible: () => visible,
    setVisible,
    toggle
  });
}
