export function registerCoreExtension({ extensionHost, workbench, preview, bottomPanel, activityBar, canvasState }) {
  return extensionHost.registerExtension({
    id: "creed.core-workbench",
    name: "CREED Core Workbench",
    version: "2.0.0",
    description: "Explorer, source editor, canvas, preview, source control and browser terminal contributions.",
    builtIn: true,
    activate(api) {
      api.commands.register("workbench.quickOpen", "Quick Open", () => workbench.quickOpen.open(), { keybinding: "Ctrl+P" });
      api.commands.register("workbench.commands", "Show All Commands", () => workbench.quickOpen.open({ commands: true }), { keybinding: "F1" });
      api.commands.register("workbench.canvas", "Show Infinite Canvas", () => workbench.editor.showCanvas());
      api.commands.register("workbench.preview", "Run Workspace Preview", () => preview.run());
      api.commands.register("workbench.save", "Save Active Source Buffer", () => workbench.editor.saveActive(), { keybinding: "Ctrl+S" });
      api.commands.register("workbench.find", "Find in Active File", () => workbench.editor.openFind(), { keybinding: "Ctrl+F" });
      api.commands.register("workbench.back", "Navigate Back", () => workbench.editor.goBack());
      api.commands.register("workbench.forward", "Navigate Forward", () => workbench.editor.goForward());
      api.commands.register("workbench.reopen", "Reopen Closed Editor", () => workbench.editor.reopenClosed(), { keybinding: "Ctrl+Shift+T" });
      api.commands.register("view.explorer", "View: Explorer", () => activityBar.show("explorer"));
      api.commands.register("view.search", "View: Search", () => activityBar.show("search"));
      api.commands.register("view.sourceControl", "View: Source Control", () => activityBar.show("sourceControl"));
      api.commands.register("view.run", "View: Run and Debug", () => activityBar.show("run"));
      api.commands.register("view.extensions", "View: Extensions", () => activityBar.show("extensions"));
      api.commands.register("panel.problems", "Panel: Problems", () => bottomPanel.showView("problems"));
      api.commands.register("panel.output", "Panel: Output", () => bottomPanel.showView("output"));
      api.commands.register("panel.debug", "Panel: Debug Console", () => bottomPanel.showView("debug"));
      api.commands.register("panel.terminal", "Panel: Terminal", () => bottomPanel.showView("terminal"), { keybinding: "Ctrl+`" });
      api.commands.register("panel.ports", "Panel: Ports", () => bottomPanel.showView("ports"));
      api.terminal.register("canvas", "Show the infinite canvas", () => {
        workbench.editor.showCanvas();
        return "Infinite canvas opened";
      });
      api.terminal.register("components", "List canvas components", () => canvasState.components.map((component) => `${component.id}\t${component.type}\t${component.name}`).join("\n"));
      api.terminal.register("views", "List saved canvas views", () => canvasState.savedViews.length
        ? canvasState.savedViews.map((view) => `${view.name}\t${view.worldX},${view.worldY}\t${Math.round(view.zoom * 100)}%`).join("\n")
        : "No saved canvas views");
      api.activityViews.register("creed.architecture", "CREED Architecture", (container) => {
        const pre = document.createElement("pre");
        pre.textContent = "document → commands → state → scheduled renderer\nworkspace → editor/search/source-control/preview\nextension host → commands/terminal/activity/components";
        container.replaceChildren(pre);
      });
    }
  });
}
