import { openGeneratedJsonFile } from "./json-file.js";
import { bindSystemGraph } from "./system-graph-view.js";

export function registerDefaultCanvasComponents(registry) {
  registry.register({
    type: "json-file",
    title: "JSON File",
    description: "Generate and open a CREED JSON component file.",
    singleton: true,
    defaultWidth: 320,
    defaultHeight: 180,
    mount({ content }) {
      Object.assign(content.style, { display: "grid", placeItems: "center", padding: "18px" });
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

  registry.register({
    type: "system-graph",
    title: "System Graph",
    description: "Visualize files, DOM IDs, imports and ownership relationships.",
    singleton: true,
    defaultWidth: 920,
    defaultHeight: 620,
    mount({ content, context, notify }) {
      const graph = bindSystemGraph({
        host: content,
        service: context.systemGraphService,
        openFile: context.openFile,
        notify,
        storage: context.storage
      });
      context.onSystemGraphMounted?.(graph);
      return () => {
        context.onSystemGraphUnmounted?.(graph);
        graph.destroy();
      };
    }
  });

  return registry;
}
