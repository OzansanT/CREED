import { getViewportWorldCenter } from "../../core/coordinates.js";

function playCardClick(card) {
  card.classList.remove("was-clicked");
  void card.offsetWidth;
  card.classList.add("was-clicked");
}

export function bindSidebarMenu({
  canvasButton,
  infiniteCanvasButton,
  componentsButton,
  addJsonCardButton,
  canvas,
  jsonCard,
  showCanvas,
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
  infiniteCanvasButton.addEventListener("click", () => {
    setView("infiniteCanvas");
    showCanvas?.();
  });
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
