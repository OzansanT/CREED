import { clearAnchor, goToAnchor, setAnchor } from "./anchors.js";

export function bindSavedViews({
  list,
  addButton,
  state,
  canvas,
  update,
  persist
}) {
  let signature = "";

  function sync() {
    const nextSignature = JSON.stringify({
      views: state.savedViews,
      active: state.activeSavedViewId
    });
    if (nextSignature === signature) return;
    signature = nextSignature;
    const fragment = document.createDocumentFragment();
    state.savedViews.forEach((view) => {
      const row = document.createElement("div");
      row.className = "saved-view-row";
      row.dataset.viewId = view.id;
      row.classList.toggle("is-active", view.id === state.activeSavedViewId);
      const go = document.createElement("button");
      go.type = "button";
      go.dataset.action = "go";
      go.textContent = view.name;
      const remove = document.createElement("button");
      remove.type = "button";
      remove.dataset.action = "delete";
      remove.title = "Delete saved view";
      remove.textContent = "×";
      row.append(go, remove);
      fragment.append(row);
    });
    list.replaceChildren(fragment);
  }

  addButton.addEventListener("click", () => {
    const previousActive = state.activeSavedViewId;
    state.activeSavedViewId = null;
    const view = setAnchor({
      state,
      canvas,
      update,
      persist,
      name: "View " + (state.savedViews.length + 1)
    });
    if (!view) state.activeSavedViewId = previousActive;
  });

  list.addEventListener("click", (event) => {
    const row = event.target.closest?.("[data-view-id]");
    const action = event.target.closest?.("button")?.dataset.action;
    if (!row || !action) return;
    if (action === "go") {
      goToAnchor({ state, canvas, update, persist, viewId: row.dataset.viewId });
    } else {
      clearAnchor({ state, update, persist, viewId: row.dataset.viewId });
    }
  });

  return Object.freeze({ sync });
}
