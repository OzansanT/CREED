import { openGeneratedJsonFile } from "./json-file.js";

export function registerDefaultCanvasComponents(registry) {
  registry.register({
    type: "json-file",
    title: "JSON File",
    description: "Generate and open a CREED JSON component file.",
    singleton: true,
    defaultWidth: 320,
    defaultHeight: 180,
    mount({ content }) {
      Object.assign(content.style, { display: "grid", placeItems: "center", padding: "8px 0 0" });
      const button = document.createElement("button");
      button.type = "button";
      button.className = "button--primary";
      button.textContent = "Open JSON File";
      button.addEventListener("pointerdown", (event) => event.stopPropagation());
      button.addEventListener("click", (event) => { event.stopPropagation(); openGeneratedJsonFile(); });
      content.append(button);
      return () => {};
    }
  });

  return registry;
}
