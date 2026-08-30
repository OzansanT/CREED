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

const EDIT_BLUE = "#007acc";
const MIN_RESIZE_PX = 8;

function describeElement(element) {
  if (!(element instanceof Element)) return "—";
  const tag = element.tagName.toLowerCase();
  if (element.id) return `${tag}#${element.id}`;
  const classes = [...element.classList].slice(0, 2);
  return classes.length ? `${tag}.${classes.join(".")}` : tag;
}

function px(value) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function clamp(value, minimum = 0) {
  return Math.max(minimum, Number.isFinite(value) ? value : minimum);
}

function rounded(value) {
  return Math.round(value * 10) / 10;
}

function boxShorthand(values) {
  return `${rounded(values.top)}px ${rounded(values.right)}px ${rounded(values.bottom)}px ${rounded(values.left)}px`;
}

function readBox(computed, prefix) {
  return {
    top: px(computed.getPropertyValue(`${prefix}-top`)),
    right: px(computed.getPropertyValue(`${prefix}-right`)),
    bottom: px(computed.getPropertyValue(`${prefix}-bottom`)),
    left: px(computed.getPropertyValue(`${prefix}-left`))
  };
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

function createFixedLayer(zIndex, border) {
  const layer = document.createElement("div");
  layer.hidden = true;
  layer.dataset.editModeLocked = "true";
  layer.dataset.editModeControl = "true";
  Object.assign(layer.style, {
    position: "fixed",
    zIndex: String(zIndex),
    pointerEvents: "none",
    boxSizing: "border-box",
    border
  });
  document.body.append(layer);
  return layer;
}

function createResizeHandle(direction, cursor) {
  const handle = document.createElement("button");
  handle.type = "button";
  handle.dataset.resizeDirection = direction;
  handle.dataset.editModeLocked = "true";
  handle.dataset.editModeControl = "true";
  handle.setAttribute("aria-label", `Resize selected element ${direction}`);
  handle.title = "Drag: size · Shift+drag: margin · Alt+drag: padding";
  Object.assign(handle.style, {
    position: "fixed",
    zIndex: "10003",
    width: "10px",
    height: "10px",
    padding: "0",
    margin: "0",
    border: "2px solid #ffffff",
    borderRadius: direction === "corner" ? "2px" : "50%",
    background: EDIT_BLUE,
    boxShadow: "0 0 0 1px #005a9e",
    cursor,
    touchAction: "none"
  });
  document.body.append(handle);
  return handle;
}

function createBoxModelOverlay({ onPropertyChange, onPreviewSize }) {
  const marginLayer = createFixedLayer(9997, "1px dashed rgba(217, 119, 6, .9)");
  const borderLayer = createFixedLayer(9998, `1px solid ${EDIT_BLUE}`);
  const contentLayer = createFixedLayer(9999, "1px dotted rgba(22, 163, 74, .95)");

  const badge = document.createElement("div");
  badge.hidden = true;
  badge.dataset.editModeLocked = "true";
  badge.dataset.editModeControl = "true";
  Object.assign(badge.style, {
    position: "fixed",
    zIndex: "10002",
    pointerEvents: "none",
    maxWidth: "420px",
    padding: "3px 6px",
    borderRadius: "4px",
    background: "rgba(20, 24, 32, .92)",
    color: "#fff",
    font: "10px/1.3 Segoe UI, system-ui, sans-serif",
    whiteSpace: "nowrap"
  });
  document.body.append(badge);

  const rightHandle = createResizeHandle("right", "ew-resize");
  const bottomHandle = createResizeHandle("bottom", "ns-resize");
  const cornerHandle = createResizeHandle("corner", "nwse-resize");
  const handles = [rightHandle, bottomHandle, cornerHandle];

  let element = null;
  let drag = null;

  function setRect(layer, rect) {
    Object.assign(layer.style, {
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      width: `${Math.max(0, rect.width)}px`,
      height: `${Math.max(0, rect.height)}px`
    });
  }

  function setHandlePosition(handle, left, top) {
    handle.style.left = `${left - 5}px`;
    handle.style.top = `${top - 5}px`;
  }

  function renderGeometry(rect, margin, padding, border, modeLabel = "") {
    const marginRect = {
      left: rect.left - margin.left,
      top: rect.top - margin.top,
      width: rect.width + margin.left + margin.right,
      height: rect.height + margin.top + margin.bottom
    };
    const contentRect = {
      left: rect.left + border.left + padding.left,
      top: rect.top + border.top + padding.top,
      width: Math.max(0, rect.width - border.left - border.right - padding.left - padding.right),
      height: Math.max(0, rect.height - border.top - border.bottom - padding.top - padding.bottom)
    };

    setRect(marginLayer, marginRect);
    setRect(borderLayer, rect);
    setRect(contentLayer, contentRect);
    setHandlePosition(rightHandle, rect.left + rect.width, rect.top + rect.height / 2);
    setHandlePosition(bottomHandle, rect.left + rect.width / 2, rect.top + rect.height);
    setHandlePosition(cornerHandle, rect.left + rect.width, rect.top + rect.height);

    badge.style.left = `${Math.max(4, rect.left)}px`;
    badge.style.top = `${Math.max(4, rect.top - 24)}px`;
    badge.textContent = `${modeLabel ? `${modeLabel} · ` : ""}${Math.round(rect.width)}×${Math.round(rect.height)} · M ${Math.round(margin.top)}/${Math.round(margin.right)}/${Math.round(margin.bottom)}/${Math.round(margin.left)} · P ${Math.round(padding.top)}/${Math.round(padding.right)}/${Math.round(padding.bottom)}/${Math.round(padding.left)}`;
    onPreviewSize(`${Math.round(rect.width)} × ${Math.round(rect.height)} px`);
  }

  function getGeometry(target) {
    const rect = target.getBoundingClientRect();
    const computed = getComputedStyle(target);
    return {
      rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
      margin: readBox(computed, "margin"),
      padding: readBox(computed, "padding"),
      border: {
        top: px(computed.borderTopWidth),
        right: px(computed.borderRightWidth),
        bottom: px(computed.borderBottomWidth),
        left: px(computed.borderLeftWidth)
      }
    };
  }

  function show(target) {
    element = target instanceof HTMLElement && target.isConnected ? target : null;
    if (!element) return hide();
    const geometry = getGeometry(element);
    marginLayer.hidden = false;
    borderLayer.hidden = false;
    contentLayer.hidden = false;
    badge.hidden = false;
    handles.forEach((handle) => { handle.hidden = false; });
    renderGeometry(geometry.rect, geometry.margin, geometry.padding, geometry.border);
    return true;
  }

  function hide() {
    element = null;
    drag = null;
    marginLayer.hidden = true;
    borderLayer.hidden = true;
    contentLayer.hidden = true;
    badge.hidden = true;
    handles.forEach((handle) => { handle.hidden = true; });
    return false;
  }

  function update() {
    if (!element?.isConnected || drag) return false;
    return show(element);
  }

  function resolveMode(event) {
    if (event.altKey) return "padding";
    if (event.shiftKey) return "margin";
    return "size";
  }

  function handlePointerDown(event) {
    if (!element?.isConnected) return;
    event.preventDefault();
    event.stopPropagation();
    const handle = event.currentTarget;
    const geometry = getGeometry(element);
    drag = {
      pointerId: event.pointerId,
      direction: handle.dataset.resizeDirection,
      mode: resolveMode(event),
      startX: event.clientX,
      startY: event.clientY,
      geometry
    };
    handle.setPointerCapture?.(event.pointerId);
  }

  function previewDrag(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    event.preventDefault();
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    const { direction, mode, geometry } = drag;
    const rect = { ...geometry.rect };
    const margin = { ...geometry.margin };
    const padding = { ...geometry.padding };

    if (mode === "size") {
      if (direction === "right" || direction === "corner") rect.width = clamp(geometry.rect.width + dx, MIN_RESIZE_PX);
      if (direction === "bottom" || direction === "corner") rect.height = clamp(geometry.rect.height + dy, MIN_RESIZE_PX);
    } else if (mode === "margin") {
      if (direction === "right" || direction === "corner") margin.right = clamp(geometry.margin.right + dx);
      if (direction === "bottom" || direction === "corner") margin.bottom = clamp(geometry.margin.bottom + dy);
    } else {
      if (direction === "right" || direction === "corner") padding.right = clamp(geometry.padding.right + dx);
      if (direction === "bottom" || direction === "corner") padding.bottom = clamp(geometry.padding.bottom + dy);
    }

    drag.preview = { rect, margin, padding };
    renderGeometry(rect, margin, padding, geometry.border, mode === "size" ? "Resize" : mode === "margin" ? "Margin" : "Padding");
  }

  function commitDrag(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const current = drag;
    drag = null;
    const preview = current.preview;
    if (!preview) {
      update();
      return;
    }

    const { direction, mode, geometry } = current;
    if (mode === "size") {
      if ((direction === "right" || direction === "corner") && Math.abs(preview.rect.width - geometry.rect.width) >= 0.5) {
        onPropertyChange({ kind: "style", property: "width", value: `${rounded(preview.rect.width)}px` });
      }
      if ((direction === "bottom" || direction === "corner") && Math.abs(preview.rect.height - geometry.rect.height) >= 0.5) {
        onPropertyChange({ kind: "style", property: "height", value: `${rounded(preview.rect.height)}px` });
      }
    } else if (mode === "margin") {
      onPropertyChange({ kind: "style", property: "margin", value: boxShorthand(preview.margin) });
    } else {
      onPropertyChange({ kind: "style", property: "padding", value: boxShorthand(preview.padding) });
    }
    requestAnimationFrame(update);
  }

  function cancelDrag(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    drag = null;
    update();
  }

  handles.forEach((handle) => handle.addEventListener("pointerdown", handlePointerDown));
  document.addEventListener("pointermove", previewDrag, true);
  document.addEventListener("pointerup", commitDrag, true);
  document.addEventListener("pointercancel", cancelDrag, true);
  window.addEventListener("resize", update);
  window.addEventListener("scroll", update, true);

  hide();
  return Object.freeze({ show, hide, update });
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

  const resizeHint = document.createElement("div");
  resizeHint.textContent = "Canvas handles: drag = size · Shift = margin · Alt = padding";
  Object.assign(resizeHint.style, {
    marginTop: "8px",
    padding: "6px 7px",
    borderRadius: "4px",
    background: "#f4f8fb",
    color: "#51606f",
    lineHeight: "1.35"
  });

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
    resizeHint,
    propertiesTitle,
    ...propertyControls.map((control) => control.row),
    textControl.row,
    actions
  );
  document.body.append(panel);

  const boxModelOverlay = createBoxModelOverlay({
    onPropertyChange,
    onPreviewSize: (value) => {
      fields.size.value.textContent = value;
    }
  });

  function update(element) {
    if (!(element instanceof Element) || !element.isConnected) {
      panel.hidden = true;
      boxModelOverlay.hide();
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
    boxModelOverlay.show(element);
    return true;
  }

  function hide() {
    panel.hidden = true;
    boxModelOverlay.hide();
  }

  return Object.freeze({ panel, update, hide });
}
