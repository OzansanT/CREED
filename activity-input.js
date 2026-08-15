function button(label, handler, primary = false) {
  const node = document.createElement("button");
  node.type = "button";
  node.textContent = label;
  if (primary) node.className = "primary";
  node.addEventListener("click", handler);
  return node;
}

export function createRunView({ runPreview, showPreview, showBottomView }) {
  return function renderRun(container) {
    const section = document.createElement("section");
    section.className = "activity-section";
    const heading = document.createElement("h2");
    heading.textContent = "Run and Debug";
    const copy = document.createElement("p");
    copy.textContent = "Build all browser-workspace HTML, CSS and JavaScript into an isolated preview. Module imports are remapped to generated object URLs.";
    const actions = document.createElement("div");
    actions.className = "activity-actions";
    actions.append(
      button("Run workspace", runPreview, true),
      button("Show preview", showPreview),
      button("Debug console", () => showBottomView("debug"))
    );
    section.append(heading, copy, actions);
    container.replaceChildren(section);
  };
}

export function createExtensionsView({ extensionHost, openCommands }) {
  return function renderExtensions(container) {
    const root = document.createElement("div");
    const heading = document.createElement("h2");
    heading.textContent = "Extensions";
    const summary = document.createElement("p");
    const list = document.createElement("div");
    list.className = "extension-list";
    const extensions = extensionHost.listExtensions();
    summary.textContent = `${extensions.length} installed · ${extensionHost.listCommands().length} commands · ${extensionHost.listTerminalCommands().length} terminal contributions`;
    extensions.forEach((extension) => {
      const item = document.createElement("article");
      item.className = "extension-item";
      const title = document.createElement("strong");
      title.textContent = `${extension.name} ${extension.version}`;
      const description = document.createElement("p");
      description.textContent = extension.description || "No description";
      const status = document.createElement("small");
      status.textContent = extension.error ? `Activation error: ${extension.error}` : extension.active ? "Active · built-in" : "Inactive";
      item.append(title, description, status);
      list.append(item);
    });
    const actions = document.createElement("div");
    actions.className = "activity-actions";
    actions.append(button("Browse contributed commands", () => openCommands({ commands: true })));
    root.append(heading, summary, actions, list);
    container.replaceChildren(root);
  };
}

export function createAccountView({ store, notify }) {
  return function renderAccount(container) {
    const section = document.createElement("section");
    section.className = "activity-section";
    const heading = document.createElement("h2");
    heading.textContent = "Local workspace profile";
    const detail = document.createElement("p");
    detail.textContent = `Browser session · branch ${store.getBranch()} · ${store.listFiles().length} files. No credentials are stored by CREED.`;
    const actions = document.createElement("div");
    actions.className = "activity-actions";
    actions.append(button("Copy session summary", async () => {
      const summary = JSON.stringify({ branch: store.getBranch(), files: store.listFiles().length, changes: store.listChanges().length }, null, 2);
      try { await navigator.clipboard.writeText(summary); notify?.("Session summary copied"); }
      catch { notify?.(summary); }
    }));
    section.append(heading, detail, actions);
    container.replaceChildren(section);
  };
}

export function createSettingsView({ settingsStore, layoutPresets, backupManager, pwa, notify }) {
  return function renderSettings(container) {
    const root = document.createElement("div");
    const section = document.createElement("section");
    section.className = "activity-section";
    const heading = document.createElement("h2");
    heading.textContent = "Workbench settings";
    const form = document.createElement("form");
    form.className = "activity-form activity-form--column";
    const themeLabel = document.createElement("label");
    themeLabel.textContent = "Theme";
    const theme = document.createElement("select");
    [["system", "System"], ["light", "Light"], ["dark", "Dark"], ["contrast", "High contrast"]].forEach(([value, label]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      option.selected = settingsStore.get().theme === value;
      theme.append(option);
    });
    themeLabel.append(theme);
    const localeLabel = document.createElement("label");
    localeLabel.textContent = "Language";
    const locale = document.createElement("select");
    [["en", "English"], ["tr", "Türkçe"]].forEach(([value, label]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      option.selected = settingsStore.get().locale === value;
      locale.append(option);
    });
    localeLabel.append(locale);
    const motionLabel = document.createElement("label");
    const motion = document.createElement("input");
    motion.type = "checkbox";
    motion.checked = settingsStore.get().reduceMotion;
    motionLabel.append(motion, document.createTextNode(" Reduce motion"));
    const fontLabel = document.createElement("label");
    fontLabel.textContent = "Editor font size ";
    const fontValue = document.createElement("output");
    fontValue.textContent = settingsStore.get().editorFontSize + "px";
    const font = document.createElement("input");
    font.type = "range";
    font.min = "10";
    font.max = "20";
    font.value = String(settingsStore.get().editorFontSize);
    font.addEventListener("input", () => { fontValue.textContent = font.value + "px"; });
    fontLabel.append(fontValue, font);
    const apply = button("Apply settings", () => {
      settingsStore.set({
        theme: theme.value,
        locale: locale.value,
        reduceMotion: motion.checked,
        editorFontSize: Number(font.value)
      });
      notify?.("Workbench settings applied");
    }, true);
    const reset = button("Reset settings", () => {
      const next = settingsStore.reset();
      theme.value = next.theme;
      locale.value = next.locale;
      motion.checked = next.reduceMotion;
      font.value = String(next.editorFontSize);
      fontValue.textContent = next.editorFontSize + "px";
      notify?.("Workbench settings reset");
    });
    form.append(themeLabel, localeLabel, motionLabel, fontLabel, apply, reset);
    const shortcuts = document.createElement("p");
    shortcuts.textContent = "Keybindings: Ctrl+P Quick Open · F1 Commands · Ctrl+S Save · Ctrl+F Find · Ctrl+Shift+T Reopen tab · Ctrl+` Terminal.";
    const layoutHeading = document.createElement("h3");
    layoutHeading.textContent = "Layout presets";
    const layoutActions = document.createElement("div");
    layoutActions.className = "activity-actions";
    [["full", "Full"], ["canvas", "Canvas focus"], ["code", "Code"], ["compact", "Compact"]].forEach(([id, label]) => {
      layoutActions.append(button(label, () => layoutPresets.apply(id), settingsStore.get().layoutPreset === id));
    });
    const install = button("Install CREED", () => pwa.install(), true);
    install.hidden = !pwa.canInstall();
    const unsubscribe = pwa.subscribe((status) => { install.hidden = !status.canInstall; });
    section.append(heading, form, shortcuts, layoutHeading, layoutActions, install);
    root.append(section);
    container.replaceChildren(root);
    backupManager.render(root).catch((error) => notify?.(error.message));
    return unsubscribe;
  };
}

export function bindActivityBar({
  explorerButton,
  explorerTitle = "Explorer",
  views,
  sidebarContent,
  activityPanel,
  title,
  menuButton,
  ensureSidebarVisible,
  openCommands
}) {
  let activeId = "explorer";
  let cleanup = null;
  const entries = new Map([["explorer", { button: explorerButton, title: explorerTitle }], ...Object.entries(views).map(([id, view]) => [id, view])]);

  function show(id) {
    const entry = entries.get(id);
    if (!entry) return;
    cleanup?.();
    cleanup = null;
    activeId = id;
    const explorer = id === "explorer";
    if (!explorer) ensureSidebarVisible?.();
    entries.forEach((candidate, candidateId) => {
      candidate.button.classList.toggle("active", candidateId === id);
      candidate.button.setAttribute("aria-pressed", String(candidateId === id));
    });
    title.textContent = typeof entry.title === "function" ? entry.title() : entry.title;
    sidebarContent.hidden = !explorer;
    activityPanel.hidden = explorer;
    if (!explorer) {
      cleanup = entry.render?.(activityPanel) || null;
    }
  }

  explorerButton.addEventListener("click", () => show("explorer"));
  Object.entries(views).forEach(([id, entry]) => entry.button.addEventListener("click", () => show(id)));
  menuButton.addEventListener("click", () => openCommands({ commands: true }));
  show("explorer");
  return Object.freeze({ show, getActive: () => activeId, refreshTitle: () => {
    const entry = entries.get(activeId);
    title.textContent = typeof entry?.title === "function" ? entry.title() : entry?.title || "";
  } });
}
