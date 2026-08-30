export function bindSecondarySidebarViews({ panel, state, registry, componentManager, persist } = {}) {
  if (!panel || !state || !registry || !componentManager) throw new TypeError("Secondary sidebar views require panel, state, registry and component manager.");
  const header = panel.querySelector("#secondarySidebarHeader");
  const content = panel.querySelector("#secondarySidebarContent");
  const chatView = panel.querySelector("#chatView");
  const chatPromptInput = panel.querySelector("#chatPromptInput");
  const chatSettingsAction = panel.querySelector("#chatSettingsBtn");
  if (!header || !content || !chatView) throw new Error("Secondary sidebar structure is incomplete.");

  const bar = document.createElement("div");
  bar.id = "secondaryGeneralBar";
  bar.className = "toolbar";
  bar.setAttribute("role", "tablist");
  bar.setAttribute("aria-label", "Secondary sidebar views");
  Object.assign(bar.style, {
    display: "flex", gap: "4px", padding: "6px 8px", borderBottom: "1px solid var(--border, #d4d4d4)",
    background: "var(--panel-bg, #f7f7fa)"
  });

  const subBar = document.createElement("div");
  subBar.id = "secondarySubBar";
  subBar.className = "toolbar";
  subBar.setAttribute("role", "tablist");
  subBar.setAttribute("aria-label", "Secondary sidebar sub views");
  Object.assign(subBar.style, {
    display: "flex", gap: "4px", padding: "5px 8px", borderBottom: "1px solid var(--border, #d4d4d4)",
    background: "var(--panel-bg, #fbfbfd)"
  });

  function makeTab(id, label, controls, group) {
    const button = document.createElement("button");
    button.id = id;
    button.type = "button";
    button.textContent = label;
    button.setAttribute("role", "tab");
    button.setAttribute("aria-controls", controls);
    if (group) button.dataset.secondarySubGroup = group;
    Object.assign(button.style, { flex: "1 1 0%", minHeight: "28px" });
    return button;
  }

  const chatButton = makeTab("generalChatBtn", "Chat", "chatView");
  const componentsButton = makeTab("generalComponentsBtn", "Components", "componentLibraryView");
  bar.append(chatButton, componentsButton);

  const chatConversationButton = makeTab("chatConversationBtn", "Conversation", "chatView", "chat");
  const chatSettingsButton = makeTab("chatSettingsViewBtn", "Settings", "chatView", "chat");
  const componentLibraryButton = makeTab("componentLibraryBtn", "Library", "componentLibraryView", "components");
  const componentInstancesButton = makeTab("componentInstancesBtn", "Instances", "componentLibraryView", "components");
  subBar.append(chatConversationButton, chatSettingsButton, componentLibraryButton, componentInstancesButton);

  header.insertAdjacentElement("afterend", bar);
  bar.insertAdjacentElement("afterend", subBar);

  const componentView = document.createElement("section");
  componentView.id = "componentLibraryView";
  componentView.setAttribute("aria-label", "Canvas component library");
  Object.assign(componentView.style, { height: "100%", overflow: "auto", padding: "12px", boxSizing: "border-box" });
  content.append(componentView);

  function createComponentItem(definition) {
    const item = document.createElement("button");
    item.type = "button";
    item.dataset.canvasComponentType = definition.type;
    item.setAttribute("aria-label", `Add ${definition.title} to Infinite Canvas`);
    Object.assign(item.style, {
      display: "grid", gap: "3px", width: "100%", padding: "10px", textAlign: "left", cursor: "grab",
      border: "1px solid var(--border, #c9c9c9)", borderRadius: "5px", background: "var(--panel-bg, #fff)"
    });
    const title = document.createElement("strong");
    title.textContent = `⠿ ${definition.title}`;
    const description = document.createElement("small");
    description.textContent = definition.description || "Canvas component";
    description.style.opacity = ".7";
    item.append(title, description);
    return item;
  }

  function renderComponentLibrary() {
    componentView.replaceChildren();
    componentView.setAttribute("aria-label", "Canvas component library");
    const heading = document.createElement("h3");
    heading.textContent = "Components";
    heading.style.margin = "0 0 6px";
    const help = document.createElement("p");
    help.textContent = "Drag a component onto Infinite Canvas, or click it to add at the current view center.";
    Object.assign(help.style, { margin: "0 0 12px", opacity: ".72", lineHeight: "1.4" });
    const list = document.createElement("div");
    Object.assign(list.style, { display: "grid", gap: "8px" });
    for (const definition of registry.list()) list.append(createComponentItem(definition));
    componentView.append(heading, help, list);
    componentManager.bindPalette(componentView);
  }

  function renderComponentInstances() {
    componentView.replaceChildren();
    componentView.setAttribute("aria-label", "Canvas component instances");
    const heading = document.createElement("h3");
    heading.textContent = "Instances";
    heading.style.margin = "0 0 6px";
    const help = document.createElement("p");
    help.textContent = "Components currently placed on Infinite Canvas.";
    Object.assign(help.style, { margin: "0 0 12px", opacity: ".72", lineHeight: "1.4" });
    const list = document.createElement("div");
    Object.assign(list.style, { display: "grid", gap: "8px" });
    const records = componentManager.getRecords();
    if (!records.length) {
      const empty = document.createElement("p");
      empty.textContent = "No component instances on the canvas.";
      empty.style.opacity = ".72";
      list.append(empty);
    } else {
      records.forEach((record, index) => {
        const definition = registry.get(record.type);
        const item = document.createElement("button");
        item.type = "button";
        item.textContent = `${definition?.title || record.type} · ${index + 1}`;
        item.setAttribute("aria-label", `Focus ${definition?.title || record.type} instance ${index + 1}`);
        Object.assign(item.style, { width: "100%", minHeight: "32px", textAlign: "left" });
        item.addEventListener("click", () => componentManager.getMountedElement(record.id)?.focus({ preventScroll: true }));
        list.append(item);
      });
    }
    componentView.append(heading, help, list);
  }

  function updateTab(button, active) {
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", String(active));
    button.tabIndex = active ? 0 : -1;
  }

  function renderSubButtons(group) {
    for (const button of [chatConversationButton, chatSettingsButton, componentLibraryButton, componentInstancesButton]) {
      button.hidden = button.dataset.secondarySubGroup !== group;
    }
  }

  function setSubView(group, view, shouldPersist = true) {
    if (group === "components") {
      const next = view === "instances" ? "instances" : "library";
      state.secondarySidebarComponentsSubView = next;
      updateTab(componentLibraryButton, next === "library");
      updateTab(componentInstancesButton, next === "instances");
      if (state.secondarySidebarView === "components") {
        if (next === "instances") renderComponentInstances();
        else renderComponentLibrary();
      }
      if (shouldPersist) persist?.();
      return next;
    }

    const next = view === "settings" ? "settings" : "conversation";
    state.secondarySidebarChatSubView = next;
    updateTab(chatConversationButton, next === "conversation");
    updateTab(chatSettingsButton, next === "settings");
    if (state.secondarySidebarView === "chat") {
      if (next === "settings") chatSettingsAction?.click();
      else {
        chatView.querySelector("[data-provider-settings]")?.remove();
        chatPromptInput?.focus({ preventScroll: true });
      }
    }
    if (shouldPersist) persist?.();
    return next;
  }

  function setView(view, shouldPersist = true) {
    const next = view === "components" ? "components" : "chat";
    state.secondarySidebarView = next;
    const chatActive = next === "chat";
    chatView.hidden = !chatActive;
    componentView.hidden = chatActive;
    updateTab(chatButton, chatActive);
    updateTab(componentsButton, !chatActive);
    renderSubButtons(next);
    if (chatActive) setSubView("chat", state.secondarySidebarChatSubView, false);
    else setSubView("components", state.secondarySidebarComponentsSubView, false);
    if (shouldPersist) persist?.();
    return next;
  }

  chatButton.addEventListener("click", () => setView("chat"));
  componentsButton.addEventListener("click", () => setView("components"));
  chatConversationButton.addEventListener("click", () => setSubView("chat", "conversation"));
  chatSettingsButton.addEventListener("click", () => setSubView("chat", "settings"));
  componentLibraryButton.addEventListener("click", () => setSubView("components", "library"));
  componentInstancesButton.addEventListener("click", () => setSubView("components", "instances"));

  renderComponentLibrary();
  setView(state.secondarySidebarView, false);

  return Object.freeze({
    bar,
    subBar,
    componentView,
    setView,
    setSubView,
    getView: () => state.secondarySidebarView,
    getSubView: (group) => group === "components" ? state.secondarySidebarComponentsSubView : state.secondarySidebarChatSubView
  });
}
