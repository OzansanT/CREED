import { getLanguageInfo } from "./source-language.js";

export function bindQuickOpen({
  dialog,
  input,
  results,
  closeButton,
  commandCenterButton,
  applicationMenuButton,
  store,
  extensionHost,
  openFile,
  notify
}) {
  let entries = [];
  let selectedIndex = 0;

  function close() {
    if (dialog.open) dialog.close();
  }

  function execute(entry) {
    close();
    if (entry.type === "file") openFile(entry.path);
    else {
      try {
        Promise.resolve(extensionHost.executeCommand(entry.id)).catch((error) => notify?.(error.message));
      } catch (error) {
        notify?.(error.message);
      }
    }
  }

  function render() {
    const queryValue = input.value.trim();
    const commandsOnly = queryValue.startsWith(">");
    const query = (commandsOnly ? queryValue.slice(1) : queryValue).trim().toLowerCase();
    const commands = extensionHost.listCommands()
      .filter((command) => !query || command.title.toLowerCase().includes(query) || command.id.toLowerCase().includes(query))
      .map((command) => ({ type: "command", ...command }));
    const files = commandsOnly ? [] : store.listFiles()
      .filter((file) => !query || file.path.toLowerCase().includes(query))
      .slice(0, 80)
      .map((file) => ({ type: "file", path: file.path }));
    entries = commandsOnly ? commands : [...files, ...commands.slice(0, query ? 12 : 6)];
    selectedIndex = Math.min(selectedIndex, Math.max(0, entries.length - 1));
    const fragment = document.createDocumentFragment();
    entries.forEach((entry, index) => {
      const button = document.createElement("button");
      button.className = "quick-open-item";
      button.classList.toggle("selected", index === selectedIndex);
      button.type = "button";
      button.role = "option";
      button.setAttribute("aria-selected", String(index === selectedIndex));
      const icon = document.createElement("span");
      icon.className = "file-kind";
      icon.textContent = entry.type === "file" ? getLanguageInfo(entry.path).kind : ">";
      const label = document.createElement("span");
      label.textContent = entry.type === "file" ? entry.path : entry.title;
      const meta = document.createElement("small");
      meta.textContent = entry.type === "file" ? "file" : entry.keybinding || entry.id;
      button.append(icon, label, meta);
      button.addEventListener("pointermove", () => { selectedIndex = index; render(); });
      button.addEventListener("click", () => execute(entry));
      fragment.append(button);
    });
    if (!entries.length) {
      const empty = document.createElement("div");
      empty.className = "activity-empty";
      empty.textContent = "No matching files or commands.";
      fragment.append(empty);
    }
    results.replaceChildren(fragment);
  }

  function open({ commands = false } = {}) {
    if (!dialog.open) dialog.showModal();
    input.value = commands ? ">" : "";
    selectedIndex = 0;
    render();
    requestAnimationFrame(() => input.focus());
  }

  input.addEventListener("input", () => { selectedIndex = 0; render(); });
  input.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      selectedIndex = Math.min(entries.length - 1, selectedIndex + 1);
      render();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      selectedIndex = Math.max(0, selectedIndex - 1);
      render();
    } else if (event.key === "Enter" && entries[selectedIndex]) {
      event.preventDefault();
      execute(entries[selectedIndex]);
    } else if (event.key === "Escape") {
      close();
    }
  });
  closeButton.addEventListener("click", close);
  commandCenterButton.addEventListener("click", () => open());
  applicationMenuButton.addEventListener("click", () => open({ commands: true }));
  window.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "p") {
      event.preventDefault();
      open();
    } else if (event.key === "F1") {
      event.preventDefault();
      open({ commands: true });
    }
  });
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) close();
  });

  return Object.freeze({ open, close, render });
}
