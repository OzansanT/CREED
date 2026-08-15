export function getDescendantIds(components, parentIds) {
  const expanded = new Set(parentIds);
  let changed = true;
  while (changed) {
    changed = false;
    components.forEach((component) => {
      if (component.parentId && expanded.has(component.parentId) && !expanded.has(component.id)) {
        expanded.add(component.id);
        changed = true;
      }
    });
  }
  return [...expanded];
}

export function selectedWithDescendants(state) {
  const ids = new Set(getDescendantIds(state.components, state.selection));
  return state.components.filter((component) => ids.has(component.id));
}

export function getAncestors(components, component) {
  const ancestors = [];
  const visited = new Set();
  let current = component;
  while (current?.parentId && !visited.has(current.parentId)) {
    visited.add(current.parentId);
    current = components.find((candidate) => candidate.id === current.parentId) || null;
    if (current) ancestors.push(current);
  }
  return ancestors;
}

export function isEffectivelyVisible(components, component) {
  return component.visible && getAncestors(components, component).every((ancestor) => ancestor.visible);
}

export function isEffectivelyLocked(components, component) {
  return component.locked || getAncestors(components, component).some((ancestor) => ancestor.locked);
}
