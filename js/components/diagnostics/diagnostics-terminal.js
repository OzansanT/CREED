export function bindDiagnosticsTerminalCommand({ terminalView, runChecks, notify } = {}) {
  if (!terminalView?.addEventListener || typeof runChecks !== "function") return () => {};

  function handleSubmit(event) {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || !terminalView.contains(form)) return;
    const input = form.querySelector('input[aria-label="Terminal command"]');
    if (!(input instanceof HTMLInputElement)) return;
    const command = input.value.trim().replace(/\s+/g, " ").toLowerCase();
    if (command !== "npm check" && command !== "npm run check") return;

    event.preventDefault();
    event.stopImmediatePropagation();
    input.value = "";
    runChecks({ reveal: true })
      .then(({ counts }) => {
        notify?.(`npm check routed to CREED diagnostics: ${counts.error} error(s), ${counts.warning} warning(s)`);
      })
      .catch((error) => notify?.(error instanceof Error ? error.message : String(error)));
  }

  terminalView.addEventListener("submit", handleSubmit, true);
  return () => terminalView.removeEventListener("submit", handleSubmit, true);
}
