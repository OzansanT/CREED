import { createCommand } from "./command-engine.js";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function bindConnectionInput({ button, state, commandEngine, notify }) {
  button.addEventListener("click", () => {
    if (state.selection.length !== 2) {
      notify?.("Select exactly two components to connect");
      return;
    }
    const [from, to] = state.selection;
    if (state.connections.some((connection) => connection.from === from && connection.to === to)) {
      notify?.("Those components are already connected");
      return;
    }
    const connection = {
      id: "connection-" + Date.now().toString(36),
      from,
      to,
      label: "",
      color: "#64748b"
    };
    commandEngine.execute(createCommand({
      label: "Connect components",
      redo: () => state.connections.push(clone(connection)),
      undo: () => {
        state.connections = state.connections.filter((candidate) => candidate.id !== connection.id);
      }
    }));
    notify?.("Components connected");
  });
}
