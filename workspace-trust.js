export function bindWorkspaceTrust({
  settingsStore,
  banner,
  bannerText,
  manageButton,
  infoButton,
  statusButton,
  dialog,
  trustButton,
  restrictedButton,
  notify
}) {
  function render() {
    const trusted = settingsStore.get().workspaceTrusted;
    banner.classList.toggle("is-trusted", trusted);
    bannerText.textContent = trusted
      ? "Trusted workspace. Built-in and explicitly installed extensions may activate; previews remain sandboxed."
      : "Restricted Mode keeps untrusted extensions disabled and previews sandboxed.";
    manageButton.textContent = trusted ? "Review" : "Manage";
    statusButton.textContent = trusted ? "♢ Trusted" : "♢ Restricted";
    trustButton.hidden = trusted;
    restrictedButton.textContent = trusted ? "Return to Restricted Mode" : "Keep Restricted Mode";
  }

  function open() {
    if (!dialog.open) dialog.showModal();
  }

  manageButton.addEventListener("click", open);
  infoButton.addEventListener("click", open);
  statusButton.addEventListener("click", open);
  trustButton.addEventListener("click", () => {
    settingsStore.set({ workspaceTrusted: true });
    notify?.("Workspace trusted; preview isolation remains enabled");
  });
  restrictedButton.addEventListener("click", () => {
    if (settingsStore.get().workspaceTrusted) {
      settingsStore.set({ workspaceTrusted: false });
      notify?.("Restricted Mode enabled");
    }
  });
  const unsubscribe = settingsStore.subscribe(render);
  render();
  return Object.freeze({ open, isTrusted: () => settingsStore.get().workspaceTrusted, destroy: unsubscribe });
}
