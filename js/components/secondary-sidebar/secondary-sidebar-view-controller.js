export function bindSecondarySidebarViews({ panel, state, registry, componentManager, persist } = {}) {
  if (!panel || !state || !registry || !componentManager) throw new TypeError("Secondary sidebar views require panel, state, registry and component manager.");
  const header = panel.querySelector("#secondarySidebarHeader");
  const content = panel.querySelector("#secondarySidebarContent");
  const chatView = panel.querySelector("#chatView");
  if (!header || !content || !chatView) throw new Error("Secondary sidebar structure is incomplete.");

  const bar = document.createElement("div");
  bar.id = "secondaryGeneralBar";
  bar.className = "toolbar";
  bar.setAttribute("aria-label", "Secondary sidebar views");
  Object.assign(bar.style, {
    display: "flex", gap: "4px", padding: "6px 8px", borderBottom: "1px solid var(--border, #d4d4d4)",
    background: "var(--panel-bg, #f7f7fa)"
  });

  function makeTab(id, label, controls) {
    const button = document.createElement("button");
    button.id = id;
    button.type = "button";
    button.textContent = label;
    button.setAttribute("role", "tab");
    button.setAttribute("aria-controls", controls);
    Object.assign(button.style, { flex: "1", minHeight: "28px" });
    return button;
  }

  const chatButton = makeTab("generalChatBtn", "Chat", "chatView");
  const componentsButton = makeTab("generalComponentsBtn", "Components", "componentLibraryView");
  bar.append(chatButton, componentsButton);
  header.insertAdjacentElement("afterend", bar);

  const componentView = document.createElement("section");
  componentView.id = "componentLibraryView";
  componentView.setAttribute("aria-label", "Canvas component library");
  Object.assign(componentView.style, { height: "100%", overflow: "auto", padding: "12px", boxSizing: "border-box" });

  const heading = document.createElement("h3");
  heading.textContent = "Components";
  heading.style.margin = "0 0 6px";
  const help = document.createElement("p");
  help.textContent = "Drag a component onto Infinite Canvas, or click it to add at the current view center.";
  Object.assign(help.style, { margin: "0 0 12px", opacity: ".72", lineHeight: "1.4" });
  componentView.append(heading, help);

  const componentList = document.createElement("div");
  Object.assign(componentList.style, { display: "grid", gap: "8px" });
  for (const definition of registry.list()) {
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
    componentList.append(item);
  }
  componentView.append(componentList);
  content.append(componentView);
  componentManager.bindPalette(componentView);

  function setView(view, shouldPersist = true) {
    const next = view === "components" ? "components" : "chat";
    state.secondarySidebarView = next;
    const chatActive = next === "chat";
    chatView.hidden = !chatActive;
    componentView.hidden = chatActive;
    chatButton.classList.toggle("is-active", chatActive);
    componentsButton.classList.toggle("is-active", !chatActive);
    chatButton.setAttribute("aria-selected", String(chatActive));
    componentsButton.setAttribute("aria-selected", String(!chatActive));
    if (shouldPersist) persist?.();
    return next;
  }

  chatButton.addEventListener("click", () => setView("chat"));
  componentsButton.addEventListener("click", () => setView("components"));
  setView(state.secondarySidebarView, false);

  return Object.freeze({
    bar,
    componentView,
    setView,
    getView: () => state.secondarySidebarView
  });
}
