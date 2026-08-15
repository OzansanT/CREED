export function bindPwa({ installButton, notify }) {
  const listeners = new Set();
  let installPrompt = null;
  let installed = window.matchMedia?.("(display-mode: standalone)").matches === true;
  let registration = null;

  function status() {
    return { canInstall: Boolean(installPrompt) && !installed, installed, registered: Boolean(registration) };
  }

  function emit() {
    const current = status();
    installButton.hidden = !current.canInstall;
    listeners.forEach((listener) => listener(current));
  }

  async function install() {
    if (!installPrompt) {
      notify?.(installed ? "CREED is already installed" : "Install is available from the browser menu on this device");
      return false;
    }
    installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    installPrompt = null;
    emit();
    if (choice.outcome === "accepted") notify?.("CREED installation accepted");
    return choice.outcome === "accepted";
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installPrompt = event;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    installed = true;
    installPrompt = null;
    emit();
    notify?.("CREED installed");
  });
  installButton.addEventListener("click", install);

  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1")) {
    window.addEventListener("load", async () => {
      try {
        registration = await navigator.serviceWorker.register("./service-worker.js", { type: "module", scope: "./" });
        registration.addEventListener("updatefound", () => {
          const worker = registration.installing;
          worker?.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller) notify?.("A CREED offline update is ready for the next reload");
          });
        });
        emit();
      } catch (error) {
        notify?.(`Offline support unavailable: ${error.message}`);
      }
    }, { once: true });
  }
  emit();

  return Object.freeze({
    install,
    canInstall: () => status().canInstall,
    getStatus: status,
    subscribe(listener) { listeners.add(listener); listener(status()); return () => listeners.delete(listener); }
  });
}
