export function bindSecondarySidebar({
  app,
  panel,
  layoutButton,
  onLayoutChange
}) {
  let visible = !panel.hidden;

  function setVisible(nextVisible, notify = true) {
    visible = Boolean(nextVisible);
    panel.hidden = !visible;
    app.classList.toggle("secondary-sidebar-collapsed", !visible);
    layoutButton.setAttribute("aria-expanded", String(visible));
    if (notify) onLayoutChange?.(visible);
  }

  function toggle() {
    setVisible(!visible);
  }

  layoutButton.addEventListener("click", toggle);
  setVisible(visible, false);

  return Object.freeze({
    isVisible: () => visible,
    setVisible,
    toggle
  });
}
