export function createRenderScheduler(
  render,
  requestFrame = requestAnimationFrame,
  cancelFrame = cancelAnimationFrame
) {
  if (typeof render !== "function") throw new TypeError("Render scheduler requires a render function");

  let frame = 0;

  function flush() {
    if (frame) cancelFrame(frame);
    frame = 0;
    render();
  }

  function schedule() {
    if (frame) return;
    frame = requestFrame(() => {
      frame = 0;
      render();
    });
  }

  function cancel() {
    if (frame) cancelFrame(frame);
    frame = 0;
  }

  return Object.freeze({
    schedule,
    flush,
    cancel,
    pending: () => Boolean(frame)
  });
}
