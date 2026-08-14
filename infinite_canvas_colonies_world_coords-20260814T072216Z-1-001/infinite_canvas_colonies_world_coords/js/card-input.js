function playClickAnimation(card) {
  card.classList.remove("was-clicked");
  void card.offsetWidth;
  card.classList.add("was-clicked");
}

function isInteractiveTarget(target) {
  return target instanceof Element && Boolean(target.closest("button,a,input,textarea,select,label"));
}

export function bindCardDrag({ card, state, positionKey = "originCard", update, persist }) {
  let dragging = false;
  let moved = false;
  const dragStart = { x: 0, y: 0 };
  const cardStart = { worldX: 0, worldY: 0 };

  card.addEventListener("animationend", () => card.classList.remove("was-clicked"));

  card.addEventListener("pointerdown", event => {
    if (event.button !== 0) return;
    if (isInteractiveTarget(event.target)) {
      event.stopPropagation();
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    dragging = true;
    moved = false;
    dragStart.x = event.clientX;
    dragStart.y = event.clientY;
    cardStart.worldX = state[positionKey].worldX;
    cardStart.worldY = state[positionKey].worldY;
    card.focus({ preventScroll: true });
    card.classList.add("is-dragging");
    playClickAnimation(card);
    card.setPointerCapture(event.pointerId);
  });

  card.addEventListener("pointermove", event => {
    if (!dragging) return;
    event.stopPropagation();
    const deltaX = event.clientX - dragStart.x;
    const deltaY = event.clientY - dragStart.y;
    moved ||= Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2;
    state[positionKey].worldX = cardStart.worldX + deltaX / state.zoom;
    state[positionKey].worldY = cardStart.worldY + deltaY / state.zoom;
    update();
  });

  function stopDragging(event) {
    if (!dragging) return;
    event?.stopPropagation();
    dragging = false;
    card.classList.remove("is-dragging");
    if (event && card.hasPointerCapture(event.pointerId)) card.releasePointerCapture(event.pointerId);
    if (!moved) playClickAnimation(card);
    persist?.();
  }

  card.addEventListener("pointerup", stopDragging);
  card.addEventListener("pointercancel", stopDragging);
}
