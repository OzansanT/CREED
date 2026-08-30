const PANEL_STYLE = Object.freeze({
  position: "fixed",
  zIndex: "10000",
  top: "66px",
  right: "12px",
  width: "280px",
  maxHeight: "calc(100vh - 98px)",
  overflow: "auto",
  padding: "10px",
  border: "1px solid #b8cfe0",
  borderRadius: "6px",
  background: "#ffffff",
  color: "#2f2f33",
  boxShadow: "0 8px 24px rgba(20, 20, 30, .16)",
  font: "11px/1.35 Segoe UI, system-ui, sans-serif"
});

function describeElement(element) {
  if (!(element instanceof Element)) return "—";
  const tag = element.tagName.toLowerCase();
  if (element.id) return `${tag}#${element.id}`;
  const classes = [...element.classList].slice(0, 2);
  return classes.length ? `${tag}.${classes.join(".")}` : tag;
}

function createRow(label) {
  const row = document.createElement("div");
  Object.assign(row.style, {
    display: "grid",
    gridTemplateColumns: "70px minmax(0, 1fr)",
    gap: "8px",
    padding: "3px 0",
    alignItems: "start"
  });

  const key = document.createElement("span");
  key.textContent = label;
  key.style.color = "#73737a";

  const value = document.createElement("code");
  Object.assign(value.style, {
    minWidth: "0",
    overflowWrap: "anywhere",
    whiteSpace: "normal",
    color: "#242428"
  });

  row.append(key, value);
  return { row, value };
}

function createAction(label, title, action, danger = false) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.title = title;
  button.setAttribute("aria-label", title);
  button.dataset.editModeControl = "true";
  Object.assign(button.style, {
    minHeight: "27px",
    padding: "4px 7px",
    border: danger ? "1px solid #e4b7b4" : "1px solid #d1d1d8",
    borderRadius: "4px",
    background: "#fff",
    color: danger ? "#b42318" : "#303036",
    cursor: "pointer",
    fontSize: "11px"
  });
  button.addEventListener("click", action);
  return button;
}

export function createElementInspector({
  onClear = () => {},
  onDelete = () => {},
  onDuplicate = () => {},
  onMoveUp = () => {},
  onMoveDown = () => {}
} = {}) {
  const panel = document.createElement("aside");
  panel.id = "editModeInspector";
  panel.hidden = true;
  panel.dataset.editModeLocked = "true";
  panel.dataset.editModeControl = "true";
  panel.setAttribute("aria-label", "Edit Mode element inspector");
  Object.assign(panel.style, PANEL_STYLE);

  const header = document.createElement("div");
  Object.assign(header.style, {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
    marginBottom: "8px",
    paddingBottom: "7px",
    borderBottom: "1px solid #e4e4e8"
  });

  const title = document.createElement("strong");
  title.textContent = "Element Inspector";
  title.style.fontSize = "12px";

  const closeButton = createAction("×", "Clear selected element", onClear);
  Object.assign(closeButton.style, { width: "26px", padding: "0", fontSize: "16px", lineHeight: "1" });
  header.append(title, closeButton);

  const fields = {
    element: createRow("Element"),
    id: createRow("ID"),
    classes: createRow("Classes"),
    parent: createRow("Parent"),
    size: createRow("Size"),
    position: createRow("Position"),
    display: createRow("Display")
  };

  const actions = document.createElement("div");
  Object.assign(actions.style, {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "6px",
    marginTop: "9px",
    paddingTop: "9px",
    borderTop: "1px solid #e4e4e8"
  });

  const moveUpButton = createAction("Move Up", "Move selected element above its previous sibling", onMoveUp);
  const moveDownButton = createAction("Move Down", "Move selected element below its next sibling", onMoveDown);
  const duplicateButton = createAction("Duplicate", "Duplicate selected element", onDuplicate);
  const deleteButton = createAction("Delete", "Delete selected element", onDelete, true);
  actions.append(moveUpButton, moveDownButton, duplicateButton, deleteButton);

  panel.append(
    header,
    fields.element.row,
    fields.id.row,
    fields.classes.row,
    fields.parent.row,
    fields.size.row,
    fields.position.row,
    fields.display.row,
    actions
  );
  document.body.append(panel);

  function update(element) {
    if (!(element instanceof Element) || !element.isConnected) {
      panel.hidden = true;
      return false;
    }

    const rect = element.getBoundingClientRect();
    const computed = getComputedStyle(element);
    fields.element.value.textContent = describeElement(element);
    fields.id.value.textContent = element.id || "—";
    fields.classes.value.textContent = [...element.classList].join(" ") || "—";
    fields.parent.value.textContent = describeElement(element.parentElement);
    fields.size.value.textContent = `${Math.round(rect.width)} × ${Math.round(rect.height)} px`;
    fields.position.value.textContent = `x ${Math.round(rect.left)}, y ${Math.round(rect.top)} · ${computed.position}`;
    fields.display.value.textContent = computed.display;

    moveUpButton.disabled = !element.previousElementSibling;
    moveDownButton.disabled = !element.nextElementSibling;
    panel.hidden = false;
    return true;
  }

  function hide() {
    panel.hidden = true;
  }

  return Object.freeze({ panel, update, hide });
}
