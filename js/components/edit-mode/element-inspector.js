const PANEL_STYLE = Object.freeze({
  position: "fixed",
  zIndex: "10000",
  top: "66px",
  right: "12px",
  width: "320px",
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

const STYLE_PROPERTIES = Object.freeze([
  { label: "Width", property: "width", placeholder: "auto / 320px" },
  { label: "Height", property: "height", placeholder: "auto / 180px" },
  { label: "Margin", property: "margin", placeholder: "0 / 8px 12px" },
  { label: "Padding", property: "padding", placeholder: "0 / 8px 12px" },
  {
    label: "Display",
    property: "display",
    options: ["block", "inline", "inline-block", "flex", "grid", "none"]
  },
  {
    label: "Flex Dir",
    property: "flex-direction",
    options: ["row", "column", "row-reverse", "column-reverse"]
  },
  {
    label: "Justify",
    property: "justify-content",
    options: ["flex-start", "center", "flex-end", "space-between", "space-around", "space-evenly"]
  },
  {
    label: "Align",
    property: "align-items",
    options: ["stretch", "flex-start", "center", "flex-end", "baseline"]
  },
  { label: "Gap", property: "gap", placeholder: "0 / 8px" },
  { label: "Grid Cols", property: "grid-template-columns", placeholder: "1fr 1fr / repeat(3, 1fr)" },
  {
    label: "Position",
    property: "position",
    options: ["static", "relative", "absolute", "fixed", "sticky"]
  },
  { label: "Top", property: "top", placeholder: "auto / 12px" },
  { label: "Left", property: "left", placeholder: "auto / 12px" },
  { label: "Background", property: "background", placeholder: "#fff / transparent" },
  { label: "Border", property: "border", placeholder: "1px solid #ccc" },
  { label: "Font Size", property: "font-size", placeholder: "14px / 1rem" },
  { label: "Color", property: "color", placeholder: "#222 / currentColor" }
]);

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

function createPropertyControl(definition, onPropertyChange) {
  const row = document.createElement("label");
  Object.assign(row.style, {
    display: "grid",
    gridTemplateColumns: "78px minmax(0, 1fr)",
    gap: "7px",
    alignItems: "center",
    padding: "3px 0"
  });

  const label = document.createElement("span");
  label.textContent = definition.label;
  label.style.color = "#66666d";

  let input;
  let inheritedOption = null;
  if (definition.options) {
    input = document.createElement("select");
    inheritedOption = document.createElement("option");
    inheritedOption.value = "";
    inheritedOption.textContent = "Stylesheet";
    input.append(inheritedOption);
    for (const value of definition.options) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      input.append(option);
    }
  } else {
    input = document.createElement("input");
    input.type = "text";
    input.placeholder = definition.placeholder || "";
  }

  input.dataset.editModeControl = "true";
  input.setAttribute("aria-label", `Edit ${definition.label}`);
  Object.assign(input.style, {
    minWidth: "0",
    width: "100%",
    minHeight: "27px",
    boxSizing: "border-box",
    padding: "4px 6px",
    border: "1px solid #d1d1d8",
    borderRadius: "4px",
    background: "#fff",
    color: "#242428",
    font: "11px Segoe UI, system-ui, sans-serif"
  });

  input.addEventListener("change", () => {
    onPropertyChange({ kind: "style", property: definition.property, value: input.value });
  });

  row.append(label, input);
  return { row, input, inheritedOption, definition };
}

function createTextControl(onPropertyChange) {
  const wrapper = document.createElement("label");
  Object.assign(wrapper.style, { display: "block", padding: "4px 0" });

  const label = document.createElement("span");
  label.textContent = "Text";
  Object.assign(label.style, { display: "block", color: "#66666d", marginBottom: "4px" });

  const input = document.createElement("textarea");
  input.rows = 3;
  input.dataset.editModeControl = "true";
  input.setAttribute("aria-label", "Edit leaf element text");
  Object.assign(input.style, {
    width: "100%",
    boxSizing: "border-box",
    resize: "vertical",
    padding: "5px 6px",
    border: "1px solid #d1d1d8",
    borderRadius: "4px",
    background: "#fff",
    color: "#242428",
    font: "11px/1.35 Segoe UI, system-ui, sans-serif"
  });
  input.addEventListener("change", () => {
    onPropertyChange({ kind: "text", value: input.value });
  });

  wrapper.append(label, input);
  return { row: wrapper, input };
}

function createSectionTitle(text) {
  const title = document.createElement("strong");
  title.textContent = text;
  Object.assign(title.style, {
    display: "block",
    marginTop: "10px",
    paddingTop: "9px",
    paddingBottom: "5px",
    borderTop: "1px solid #e4e4e8",
    fontSize: "11px"
  });
  return title;
}

export function createElementInspector({
  onClear = () => {},
  onDelete = () => {},
  onDuplicate = () => {},
  onMoveUp = () => {},
  onMoveDown = () => {},
  onPropertyChange = () => {}
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

  const propertiesTitle = createSectionTitle("Properties · blank = stylesheet");
  const propertyControls = STYLE_PROPERTIES.map((definition) => createPropertyControl(definition, onPropertyChange));
  const textControl = createTextControl(onPropertyChange);

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
    propertiesTitle,
    ...propertyControls.map((control) => control.row),
    textControl.row,
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

    for (const control of propertyControls) {
      const inlineValue = element.style.getPropertyValue(control.definition.property);
      control.input.value = inlineValue;
      if (control.inheritedOption) {
        const computedValue = computed.getPropertyValue(control.definition.property).trim();
        control.inheritedOption.textContent = computedValue ? `Stylesheet (${computedValue})` : "Stylesheet";
      } else {
        const computedValue = computed.getPropertyValue(control.definition.property).trim();
        control.input.placeholder = inlineValue ? (control.definition.placeholder || "") : (computedValue || control.definition.placeholder || "");
      }
    }

    const textEditable = element.children.length === 0;
    textControl.input.disabled = !textEditable;
    textControl.input.value = textEditable ? element.textContent : "";
    textControl.input.placeholder = textEditable ? "Element text" : "Nested elements — text editing disabled";

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
