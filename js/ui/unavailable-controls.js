export function disableUnavailableControls() {
  const selectors = [
    ".navigation-controls__button",
    "#activityMenuBtn",
    "#activityExtensionsBtn",
    "#activityGitHubBtn",
    "#activityAccountBtn",
    "#activitySettingsBtn",
    "button[aria-label='More Explorer actions']",
    "#editorActionsBtn",
    "button[aria-label='More terminal actions']"
  ];

  document.querySelectorAll(selectors.join(",")).forEach((control) => {
    if (!(control instanceof HTMLButtonElement || control instanceof HTMLTextAreaElement)) return;
    control.disabled = true;
    control.setAttribute("aria-disabled", "true");
    if (control.title) control.title += " — not implemented yet";
  });
}
