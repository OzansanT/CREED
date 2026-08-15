import { createCommand } from "./command-engine.js";
import { createComponent, getComponentById } from "./component-registry.js";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function bindGroupInput({
  groupButton,
  ungroupButton,
  state,
  commandEngine,
  notify
}) {
  groupButton.addEventListener("click", () => {
    const selected = state.components.filter((component) =>
      state.selection.includes(component.id) && component.type !== "origin"
    );
    if (selected.length < 2) {
      notify?.("Select at least two components to group");
      return;
    }
    const left = Math.min(...selected.map((component) => component.x - component.width / 2));
    const right = Math.max(...selected.map((component) => component.x + component.width / 2));
    const top = Math.min(...selected.map((component) => component.y - component.height / 2));
    const bottom = Math.max(...selected.map((component) => component.y + component.height / 2));
    const group = createComponent("group", {
      name: "Component Group",
      x: (left + right) / 2,
      y: (top + bottom) / 2,
      width: right - left + 32,
      height: bottom - top + 32,
      z: Math.min(...selected.map((component) => component.z)) - 1
    });
    const before = selected.map((component) => ({ id: component.id, parentId: component.parentId }));
    commandEngine.execute(createCommand({
      label: "Group components",
      redo: () => {
        if (!getComponentById(state.components, group.id)) state.components.push(clone(group));
        selected.forEach((component) => component.parentId = group.id);
        state.selection = [group.id, ...selected.map((component) => component.id)];
      },
      undo: () => {
        state.components = state.components.filter((component) => component.id !== group.id);
        before.forEach((item) => {
          const component = getComponentById(state.components, item.id);
          if (component) component.parentId = item.parentId;
        });
        state.selection = selected.map((component) => component.id);
      }
    }));
  });

  ungroupButton.addEventListener("click", () => {
    const groupIds = new Set(state.selection.filter((id) =>
      getComponentById(state.components, id)?.type === "group"
    ));
    state.selection.forEach((id) => {
      const parentId = getComponentById(state.components, id)?.parentId;
      if (parentId && getComponentById(state.components, parentId)?.type === "group") groupIds.add(parentId);
    });
    if (!groupIds.size) {
      notify?.("Select a group or one of its components");
      return;
    }
    const groups = [...groupIds].map((id) => clone(getComponentById(state.components, id))).filter(Boolean);
    const children = state.components
      .filter((component) => groupIds.has(component.parentId))
      .map((component) => ({ id: component.id, parentId: component.parentId }));
    commandEngine.execute(createCommand({
      label: "Ungroup components",
      redo: () => {
        state.components = state.components.filter((component) => !groupIds.has(component.id));
        children.forEach((item) => {
          const component = getComponentById(state.components, item.id);
          if (component) component.parentId = null;
        });
        state.selection = children.map((item) => item.id);
      },
      undo: () => {
        state.components.push(...clone(groups).filter((group) =>
          !getComponentById(state.components, group.id)
        ));
        children.forEach((item) => {
          const component = getComponentById(state.components, item.id);
          if (component) component.parentId = item.parentId;
        });
        state.selection = groups.map((group) => group.id);
      }
    }));
  });
}
