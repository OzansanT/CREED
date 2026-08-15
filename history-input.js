function isEditingTarget(target) {
  return target instanceof Element && Boolean(
    target.closest("input, textarea, select, button, a, [contenteditable='true'], [role='textbox']")
  );
}

export function bindHistoryInput({ engine, target = window }) {
  function onKeyDown(event) {
    if (isEditingTarget(event.target) || event.altKey) return;
    const modifier = event.ctrlKey || event.metaKey;
    if (!modifier) return;
    const key = event.key.toLowerCase();
    const wantsUndo = key === "z" && !event.shiftKey;
    const wantsRedo = (key === "z" && event.shiftKey) || key === "y";
    if (!wantsUndo && !wantsRedo) return;
    event.preventDefault();
    if (wantsUndo) engine.undo();
    else engine.redo();
  }
  target.addEventListener("keydown", onKeyDown);
  return () => target.removeEventListener("keydown", onKeyDown);
}
