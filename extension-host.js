import { registerComponentType } from "./component-registry.js";

function requireId(value, label) {
  const id = String(value || "").trim();
  if (!/^[a-z0-9][a-z0-9._-]*$/i.test(id)) throw new Error(`${label} requires a stable ID.`);
  return id;
}

export function createExtensionHost({ isTrusted = () => false } = {}) {
  const extensions = new Map();
  const commands = new Map();
  const terminalCommands = new Map();
  const activityViews = new Map();
  const listeners = new Set();

  function emit(type, detail) {
    listeners.forEach((listener) => listener({ type, ...detail }));
  }

  function contributionApi(extensionId) {
    return Object.freeze({
      commands: Object.freeze({
        register(idValue, title, handler, options = {}) {
          const id = requireId(idValue, "Command");
          if (commands.has(id)) throw new Error(`Command ${id} is already registered.`);
          if (typeof handler !== "function") throw new Error(`Command ${id} needs a handler.`);
          const command = Object.freeze({ id, title: String(title || id), handler, extensionId, keybinding: options.keybinding || "" });
          commands.set(id, command);
          emit("command", { command });
          return () => commands.delete(id);
        }
      }),
      terminal: Object.freeze({
        register(nameValue, description, handler) {
          const name = requireId(nameValue, "Terminal command").toLowerCase();
          if (terminalCommands.has(name)) throw new Error(`Terminal command ${name} is already registered.`);
          const command = Object.freeze({ name, description: String(description || ""), handler, extensionId });
          terminalCommands.set(name, command);
          emit("terminal-command", { command });
          return () => terminalCommands.delete(name);
        }
      }),
      activityViews: Object.freeze({
        register(idValue, title, render) {
          const id = requireId(idValue, "Activity view");
          if (activityViews.has(id)) throw new Error(`Activity view ${id} is already registered.`);
          if (typeof render !== "function") throw new Error(`Activity view ${id} needs a renderer.`);
          const view = Object.freeze({ id, title: String(title || id), render, extensionId });
          activityViews.set(id, view);
          emit("activity-view", { view });
          return () => activityViews.delete(id);
        }
      }),
      components: Object.freeze({ register: registerComponentType })
    });
  }

  async function registerExtension(manifest) {
    const id = requireId(manifest?.id, "Extension");
    if (extensions.has(id)) throw new Error(`Extension ${id} is already installed.`);
    if (manifest.builtIn === false && !isTrusted()) throw new Error(`Trust this workspace before activating extension ${id}.`);
    const extension = {
      id,
      name: String(manifest.name || id),
      version: String(manifest.version || "1.0.0"),
      description: String(manifest.description || ""),
      builtIn: manifest.builtIn !== false,
      active: false,
      error: ""
    };
    extensions.set(id, extension);
    try {
      await manifest.activate?.(contributionApi(id));
      extension.active = true;
    } catch (error) {
      extension.error = error.message;
      throw error;
    } finally {
      emit("extension", { extension: { ...extension } });
    }
    return { ...extension };
  }

  return Object.freeze({
    registerExtension,
    executeCommand(id, ...args) {
      const command = commands.get(id);
      if (!command) throw new Error(`Command ${id} is not registered.`);
      const extension = extensions.get(command.extensionId);
      if (extension?.builtIn === false && !isTrusted()) throw new Error(`Restricted Mode blocked command ${id}.`);
      return command.handler(...args);
    },
    executeTerminalCommand(name, args, context) {
      const command = terminalCommands.get(String(name).toLowerCase());
      if (!command) return { handled: false };
      const extension = extensions.get(command.extensionId);
      if (extension?.builtIn === false && !isTrusted()) throw new Error(`Restricted Mode blocked terminal command ${name}.`);
      return { handled: true, value: command.handler(args, context) };
    },
    renderActivityView(id, container, context) {
      const view = activityViews.get(id);
      if (!view) throw new Error(`Activity view ${id} is not registered.`);
      const extension = extensions.get(view.extensionId);
      if (extension?.builtIn === false && !isTrusted()) throw new Error(`Restricted Mode blocked activity view ${id}.`);
      return view.render(container, context);
    },
    listCommands: () => [...commands.values()].map(({ handler, ...command }) => command).sort((a, b) => a.title.localeCompare(b.title)),
    listTerminalCommands: () => [...terminalCommands.values()].map(({ handler, ...command }) => command).sort((a, b) => a.name.localeCompare(b.name)),
    listActivityViews: () => [...activityViews.values()].map(({ render, ...view }) => view).sort((a, b) => a.title.localeCompare(b.title)),
    listExtensions: () => [...extensions.values()].map((extension) => ({ ...extension })),
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  });
}
