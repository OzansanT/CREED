export function getCanvasCenter(canvas) {
  return { x: canvas.clientWidth / 2, y: canvas.clientHeight / 2 };
}

export function screenToWorld(screenX, screenY, state) {
  return {
    x: (screenX - state.viewport.x) / state.viewport.zoom,
    y: (screenY - state.viewport.y) / state.viewport.zoom
  };
}

export function localToWorld(point, state) {
  return {
    x: point.x + (state.worldOrigin?.x || 0),
    y: point.y + (state.worldOrigin?.y || 0)
  };
}

export function worldToLocal(point, state) {
  return {
    x: point.x - (state.worldOrigin?.x || 0),
    y: point.y - (state.worldOrigin?.y || 0)
  };
}

export function getViewportLocalCenter(canvas, state) {
  const center = getCanvasCenter(canvas);
  return screenToWorld(center.x, center.y, state);
}

// Returns the logical world coordinate currently under the viewport center.
// viewport.x/viewport.y remain renderer translation offsets and are not exposed as world position.
export function getViewportWorldCenter(canvas, state) {
  return localToWorld(getViewportLocalCenter(canvas, state), state);
}
