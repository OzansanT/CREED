import { getViewportWorldCenter } from "./coordinates.js";

export function bindSidebarToggle({ button, state, update, persist }) {
  button.addEventListener("click", () => {
    state.sidebarCollapsed = !state.sidebarCollapsed;
    update();
    persist?.();
  });
}

function playCardClick(card) {
  card.classList.remove("was-clicked");
  void card.offsetWidth;
  card.classList.add("was-clicked");
}

export function bindSidebarMenu({
  canvasButton,
  componentsButton,
  addJsonCardButton,
  canvas,
  jsonCard,
  state,
  update,
  persist
}) {
  function setView(view) {
    state.sidebarView = view;
    update();
    persist?.();
  }

  canvasButton.addEventListener("click", () => setView("canvas"));
  componentsButton.addEventListener("click", () => setView("components"));

  addJsonCardButton.addEventListener("click", () => {
    const center = getViewportWorldCenter(canvas, state);
    state.sidebarView = "components";
    state.jsonCard = { visible: true, worldX: center.x, worldY: center.y };
    update();
    persist?.();
    requestAnimationFrame(() => {
      jsonCard.focus({ preventScroll: true });
      playCardClick(jsonCard);
    });
  });
}
