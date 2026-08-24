import { createCommand } from "../../core/command-engine.js";
import { getViewportWorldCenter } from "../../core/coordinates.js";

function playCardClick(card) {
  card?.classList.remove("was-clicked");
  if (!card) return;
  void card.offsetWidth;
  card.classList.add("was-clicked");
}

function applyJsonCardState(state, snapshot) {
  state.sidebarView = snapshot.sidebarView;
  state.jsonCard = { ...snapshot.jsonCard };
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
  persist,
  history,
  onAddJsonCard
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

  addJsonCardButton?.addEventListener("click", () => {
    if (onAddJsonCard) {
      setView("components");
      showCanvas?.();
      onAddJsonCard();
      return;
    }

    const center = getViewportWorldCenter(canvas, state);
    const before = {
      sidebarView: state.sidebarView,
      jsonCard: { ...state.jsonCard }
    };
    const after = {
      sidebarView: "components",
      jsonCard: { visible: true, worldX: center.x, worldY: center.y }
    };

    applyJsonCardState(state, after);

    if (history) {
      history.record(createCommand({
        label: "Add JSON Card",
        redo: () => applyJsonCardState(state, after),
        undo: () => applyJsonCardState(state, before),
        isNoop: () => before.jsonCard.visible === after.jsonCard.visible &&
          before.jsonCard.worldX === after.jsonCard.worldX &&
          before.jsonCard.worldY === after.jsonCard.worldY
      }));
    } else {
      update();
      persist?.();
    }

    requestAnimationFrame(() => {
      jsonCard?.focus({ preventScroll: true });
      playCardClick(jsonCard);
    });
  });
}
