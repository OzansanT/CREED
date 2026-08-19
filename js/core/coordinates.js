export function getCanvasCenter(canvas) {
  return { x: canvas.clientWidth / 2, y: canvas.clientHeight / 2 };
}

export function screenToWorld(screenX, screenY, state) {
  return {
    x: (screenX - state.x) / state.zoom,
    y: (screenY - state.y) / state.zoom
  };
}

// Returns the logical world coordinate currently under the viewport center.
// state.x/state.y remain renderer translation offsets and are not exposed as world position.
export function getViewportWorldCenter(canvas, state) {
  const center = getCanvasCenter(canvas);
  return screenToWorld(center.x, center.y, state);
}
