function assertCommand(command) {
  if (!command || typeof command.redo !== "function" || typeof command.undo !== "function") {
    throw new TypeError("A command requires redo() and undo() functions");
  }
}

export function createCommand({ label = "Change", redo, undo, isNoop }) {
  return Object.freeze({ label, redo, undo, isNoop });
}

export function createCommandEngine({ update, persist, limit = 200 } = {}) {
  const undoStack = [];
  const redoStack = [];
  const listeners = new Set();
  let engine;

  function notify() {
    const snapshot = engine.getState();
    listeners.forEach((listener) => listener(snapshot));
  }

  function finish() {
    update?.();
    persist?.();
    notify();
  }

  function push(command) {
    if (command.isNoop?.()) return false;
    undoStack.push(command);
    if (undoStack.length > limit) undoStack.shift();
    redoStack.length = 0;
    finish();
    return true;
  }

  engine = Object.freeze({
    execute(command) {
      assertCommand(command);
      command.redo();
      return push(command);
    },
    record(command) {
      assertCommand(command);
      return push(command);
    },
    undo() {
      const command = undoStack.pop();
      if (!command) return false;
      command.undo();
      redoStack.push(command);
      finish();
      return true;
    },
    redo() {
      const command = redoStack.pop();
      if (!command) return false;
      command.redo();
      undoStack.push(command);
      finish();
      return true;
    },
    clear() {
      undoStack.length = 0;
      redoStack.length = 0;
      notify();
    },
    subscribe(listener) {
      listeners.add(listener);
      listener(engine.getState());
      return () => listeners.delete(listener);
    },
    getState() {
      return Object.freeze({
        canUndo: undoStack.length > 0,
        canRedo: redoStack.length > 0,
        undoLabel: undoStack.at(-1)?.label || "",
        redoLabel: redoStack.at(-1)?.label || ""
      });
    }
  });

  return engine;
}
