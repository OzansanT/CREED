export function bindResponsiveLayout({
  app,
  scrim,
  primaryController,
  secondaryController,
  terminalController,
  breakpoint = 600,
  onLayoutChange
}) {
  const mobile = () => window.innerWidth <= breakpoint;

  function sync() {
    if (mobile() && primaryController.isVisible() && secondaryController.isVisible()) {
      secondaryController.setVisible(false, false);
    }
    const overlayOpen = mobile() && (primaryController.isVisible() || secondaryController.isVisible());
    scrim.hidden = !overlayOpen;
    app.classList.toggle("mobile-overlay-open", overlayOpen);
    app.classList.toggle("mobile-layout", mobile());
  }

  function handleChange(source) {
    if (mobile()) {
      if (source === "primary" && primaryController.isVisible()) secondaryController.setVisible(false, false);
      if (source === "secondary" && secondaryController.isVisible()) primaryController.setVisible(false, false);
    }
    sync();
  }

  function closeOverlays() {
    if (!mobile()) return;
    primaryController.setVisible(false, false);
    secondaryController.setVisible(false, false);
    sync();
    onLayoutChange?.();
  }

  scrim.addEventListener("click", closeOverlays);
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !scrim.hidden) closeOverlays();
  });
  window.addEventListener("resize", sync);
  sync();
  return Object.freeze({ sync, handleChange, closeOverlays, isMobile: mobile, terminalController });
}
