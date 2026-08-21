import { getFileExtension } from "./file-metadata.js";
import { createEditorTextModel } from "./editor-text-model.js";

function isCommandKey(event) {
  return event.ctrlKey || event.metaKey;
}

function readEditableText(element) {
  return String(element.innerText ?? element.textContent ?? "").replace(/\r\n?/g, "\n");
}

function getSelectionOffsets(root) {
  const selection = document.getSelection();
  if (!selection || selection.rangeCount === 0 || !root.contains(selection.anchorNode) || !root.contains(selection.focusNode)) return null;
  const measure = (node, offset) => {
    const range = document.createRange();
    range.selectNodeContents(root);
    range.setEnd(node, offset);
    return range.toString().length;
  };
  return { anchor: measure(selection.anchorNode, selection.anchorOffset), head: measure(selection.focusNode, selection.focusOffset) };
}

function restorePrimarySelection(root, selection) {
  if (!selection) return;
  const textNode = root.firstChild || root.appendChild(document.createTextNode(""));
  const max = textNode.textContent?.length || 0;
  const anchor = Math.min(max, Math.max(0, selection.anchor));
  const head = Math.min(max, Math.max(0, selection.head));
  const range = document.createRange();
  range.setStart(textNode, anchor);
  range.setEnd(textNode, head);
  const nativeSelection = document.getSelection();
  nativeSelection?.removeAllRanges();
  nativeSelection?.addRange(range);
}

function commentPair(extension) {
  if (["html", "htm", "xml"].includes(extension)) return ["<!-- ", " -->"];
  if (["css", "json", "md"].includes(extension)) return ["/* ", " */"];
  return null;
}

export function bindEditorEditing({ sourceContent, sourceScroller, sourceViewport, workspace, buffers, onDirtyChange, onSaved, onStatus, onError }) {
  let activeFile = "";
  let editing = false;
  let renderGeneration = 0;
  const models = new Map();

  function setDirty(fileName) {
    onDirtyChange?.(fileName, buffers.isDirty(fileName));
  }

  function modelFor(fileName, text = "") {
    if (!models.has(fileName)) models.set(fileName, createEditorTextModel(text));
    return models.get(fileName);
  }

  function captureModelSelection() {
    if (!activeFile || !editing) return null;
    const model = modelFor(activeFile, readEditableText(sourceContent));
    const text = readEditableText(sourceContent);
    model.setText(text, { preserveSelections: true });
    const native = getSelectionOffsets(sourceContent);
    if (native) model.setPrimarySelection(native.anchor, native.head, { keepSecondary: model.getSelections().length > 1 });
    return model;
  }

  function commitModel(model, { focus = true, status = "UNSAVED" } = {}) {
    const text = model.getText();
    sourceContent.textContent = text;
    buffers.setText(activeFile, text);
    setDirty(activeFile);
    if (focus) {
      sourceContent.focus({ preventScroll: true });
      restorePrimarySelection(sourceContent, model.getPrimarySelection());
    }
    const cursor = model.getCursorPosition();
    const count = model.getSelections().length;
    onStatus?.(`${status} · Ln ${cursor.line + 1}, Col ${cursor.column + 1}${count > 1 ? ` · ${count} cursors` : ""}`);
    return text;
  }

  async function renderText(fileName, text) {
    const generation = ++renderGeneration;
    sourceContent.contentEditable = "false";
    sourceContent.removeAttribute("data-editing");
    sourceContent.removeAttribute("aria-multiline");
    editing = false;
    const rendered = await sourceViewport.setSource({ source: text, fileName });
    return generation === renderGeneration && rendered;
  }

  function enterEditMode() {
    if (!activeFile || editing || !buffers.has(activeFile)) return false;
    const text = buffers.getText(activeFile) ?? "";
    const model = modelFor(activeFile, text);
    model.setText(text, { preserveSelections: true });
    const scrollTop = sourceScroller.scrollTop;
    const scrollLeft = sourceScroller.scrollLeft;
    renderGeneration += 1;
    sourceViewport.clear();
    sourceContent.textContent = text;
    sourceContent.contentEditable = "plaintext-only";
    if (sourceContent.contentEditable !== "plaintext-only") sourceContent.contentEditable = "true";
    sourceContent.dataset.editing = "true";
    sourceContent.setAttribute("aria-label", "Editing " + activeFile);
    sourceContent.setAttribute("aria-multiline", "true");
    sourceContent.spellcheck = false;
    editing = true;
    sourceScroller.scrollTop = scrollTop;
    sourceScroller.scrollLeft = scrollLeft;
    sourceContent.focus({ preventScroll: true });
    restorePrimarySelection(sourceContent, model.getPrimarySelection());
    onStatus?.("EDITING");
    return true;
  }

  async function leaveEditMode({ preserveScroll = true } = {}) {
    if (!activeFile || !buffers.has(activeFile)) return false;
    const scrollTop = sourceScroller.scrollTop;
    const scrollLeft = sourceScroller.scrollLeft;
    if (editing) {
      const model = captureModelSelection();
      buffers.setText(activeFile, model?.getText() ?? readEditableText(sourceContent));
      setDirty(activeFile);
    }
    const rendered = await renderText(activeFile, buffers.getText(activeFile) ?? "");
    if (rendered && preserveScroll) {
      sourceScroller.scrollTop = scrollTop;
      sourceScroller.scrollLeft = scrollLeft;
      sourceViewport.refresh();
    }
    onStatus?.(buffers.isDirty(activeFile) ? "UNSAVED" : "");
    return rendered;
  }

  async function hydrate(fileName, savedSource) {
    activeFile = fileName;
    editing = false;
    const text = buffers.open(fileName, savedSource);
    modelFor(fileName, text).setText(text, { preserveSelections: true });
    setDirty(fileName);
    await renderText(fileName, text);
    onStatus?.(buffers.isDirty(fileName) ? "UNSAVED" : "");
    return text;
  }

  async function setActiveFile(fileName) {
    if (activeFile === fileName) return;
    if (activeFile && editing) {
      const previous = activeFile;
      const model = captureModelSelection();
      buffers.setText(previous, model?.getText() ?? readEditableText(sourceContent));
      setDirty(previous);
    }
    renderGeneration += 1;
    editing = false;
    sourceContent.contentEditable = "false";
    sourceContent.removeAttribute("data-editing");
    activeFile = fileName || "";
  }

  async function saveFile(fileName) {
    if (!fileName || !buffers.has(fileName) || !buffers.isDirty(fileName)) return false;
    if (fileName === activeFile && editing) {
      const model = captureModelSelection();
      buffers.setText(fileName, model?.getText() ?? readEditableText(sourceContent));
    }
    const text = buffers.getText(fileName) ?? "";
    workspace.writeFile(fileName, text);
    buffers.markSaved(fileName);
    setDirty(fileName);
    onSaved?.(fileName, text);
    if (fileName === activeFile) {
      modelFor(fileName, text).setText(text, { preserveSelections: true });
      await renderText(fileName, text);
      onStatus?.("SAVED");
    }
    return true;
  }

  async function saveAll() {
    let saved = 0;
    for (const fileName of buffers.dirtyFiles()) if (await saveFile(fileName)) saved += 1;
    onStatus?.(saved ? `SAVED ${saved}` : "NO CHANGES");
    return saved;
  }

  async function revertActive() {
    if (!activeFile || !buffers.has(activeFile)) return false;
    const savedText = await workspace.readFile(activeFile);
    buffers.revert(activeFile, savedText);
    modelFor(activeFile, savedText).setText(savedText);
    setDirty(activeFile);
    await renderText(activeFile, savedText);
    onStatus?.("REVERTED");
    return true;
  }

  async function applyHistory(direction) {
    if (!activeFile || !editing) return false;
    captureModelSelection();
    const text = direction === "undo" ? buffers.undo(activeFile) : buffers.redo(activeFile);
    if (text == null) return false;
    const model = modelFor(activeFile, text);
    model.setText(text, { preserveSelections: true });
    sourceContent.textContent = text;
    restorePrimarySelection(sourceContent, model.getPrimarySelection());
    setDirty(activeFile);
    onStatus?.(buffers.isDirty(activeFile) ? "UNSAVED" : "");
    return true;
  }

  function handleModelEdit(mutator) {
    const model = captureModelSelection();
    if (!model) return false;
    mutator(model);
    commitModel(model);
    return true;
  }

  function reportDelimiter() {
    if (!editing || !activeFile) return;
    const model = captureModelSelection();
    const match = model?.findMatchingDelimiter();
    if (!model) return;
    const cursor = model.getCursorPosition();
    if (!match) {
      onStatus?.(`EDITING · Ln ${cursor.line + 1}, Col ${cursor.column + 1}${model.getSelections().length > 1 ? ` · ${model.getSelections().length} cursors` : ""}`);
      return;
    }
    const target = model.getText().slice(0, match.matchOffset).split("\n");
    onStatus?.(`MATCH ${match.character} · Ln ${target.length}, Col ${target.at(-1).length + 1}`);
  }

  sourceContent.addEventListener("dblclick", enterEditMode);
  sourceContent.addEventListener("beforeinput", (event) => {
    if (!editing || !activeFile) return;
    const model = captureModelSelection();
    if (!model || model.getSelections().length < 2) return;
    if (event.inputType === "insertText" && typeof event.data === "string") {
      event.preventDefault();
      model.replaceSelections(event.data);
      commitModel(model);
    } else if (event.inputType === "deleteContentBackward") {
      event.preventDefault();
      model.deleteBackward();
      commitModel(model);
    } else if (event.inputType === "deleteContentForward") {
      event.preventDefault();
      model.deleteForward();
      commitModel(model);
    } else if (event.inputType === "insertParagraph") {
      event.preventDefault();
      model.insertNewlineWithIndent();
      commitModel(model);
    }
  });
  sourceContent.addEventListener("input", () => {
    if (!activeFile || !editing) return;
    const model = captureModelSelection();
    buffers.setText(activeFile, model?.getText() ?? readEditableText(sourceContent));
    setDirty(activeFile);
    onStatus?.("UNSAVED");
  });
  sourceContent.addEventListener("keyup", reportDelimiter);
  sourceContent.addEventListener("mouseup", reportDelimiter);
  sourceContent.addEventListener("blur", () => {
    if (!activeFile || !editing) return;
    const model = captureModelSelection();
    buffers.setText(activeFile, model?.getText() ?? readEditableText(sourceContent));
    setDirty(activeFile);
  });

  document.addEventListener("keydown", (event) => {
    if (!activeFile) return;
    const key = event.key.toLowerCase();
    if (isCommandKey(event) && key === "s") {
      event.preventDefault();
      const action = event.shiftKey ? saveAll() : saveFile(activeFile);
      action.catch((error) => onError?.(error instanceof Error ? error.message : String(error)));
      return;
    }
    if (editing && isCommandKey(event) && !event.altKey && key === "z") {
      event.preventDefault();
      applyHistory(event.shiftKey ? "redo" : "undo").catch((error) => onError?.(String(error)));
      return;
    }
    if (editing && isCommandKey(event) && !event.altKey && key === "y") {
      event.preventDefault();
      applyHistory("redo").catch((error) => onError?.(String(error)));
      return;
    }
    if (editing && event.key === "Tab") {
      event.preventDefault();
      handleModelEdit((model) => model.indentSelections({ outdent: event.shiftKey }));
      return;
    }
    if (editing && event.key === "Enter") {
      event.preventDefault();
      handleModelEdit((model) => model.insertNewlineWithIndent());
      return;
    }
    if (editing && isCommandKey(event) && key === "/") {
      event.preventDefault();
      handleModelEdit((model) => {
        const extension = getFileExtension(activeFile);
        if (model.toggleLineComments(extension) === false) {
          const pair = commentPair(extension);
          if (pair) model.surroundSelections(pair[0], pair[1]);
        }
      });
      return;
    }
    if (editing && event.altKey && event.shiftKey && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
      event.preventDefault();
      handleModelEdit((model) => model.addCursorVertical(event.key === "ArrowUp" ? -1 : 1));
      return;
    }
    if (editing && event.altKey && event.shiftKey && key === "c") {
      event.preventDefault();
      handleModelEdit((model) => model.createColumnSelectionsFromPrimary());
      return;
    }
    if (editing && !isCommandKey(event) && !event.altKey && !event.ctrlKey && !event.metaKey && ["(", "[", "{", "<", "\"", "'", "`"].includes(event.key)) {
      event.preventDefault();
      const close = { "(": ")", "[": "]", "{": "}", "<": ">", "\"": "\"", "'": "'", "`": "`" }[event.key];
      handleModelEdit((model) => model.surroundSelections(event.key, close));
      return;
    }
    if (editing && event.key === "Escape") {
      event.preventDefault();
      leaveEditMode().catch((error) => onError?.(error instanceof Error ? error.message : String(error)));
      return;
    }
    if (!editing && isCommandKey(event) && key === "e") {
      event.preventDefault();
      enterEditMode();
    }
    if (isCommandKey(event) && event.altKey && key === "r") {
      event.preventDefault();
      revertActive().catch((error) => onError?.(error instanceof Error ? error.message : String(error)));
    }
  });

  window.addEventListener("pagehide", () => {
    if (activeFile && editing) {
      const model = captureModelSelection();
      buffers.setText(activeFile, model?.getText() ?? readEditableText(sourceContent));
      setDirty(activeFile);
    }
    buffers.persist();
  });

  function renameFile(oldName, newName) {
    if (models.has(oldName)) {
      models.set(newName, models.get(oldName));
      models.delete(oldName);
    }
    if (activeFile === oldName) activeFile = newName;
    return activeFile;
  }

  return Object.freeze({
    hydrate,
    setActiveFile,
    renameFile,
    enterEditMode,
    leaveEditMode,
    saveActive: () => saveFile(activeFile),
    saveAll,
    revertActive,
    isEditing: () => editing,
    getActiveFile: () => activeFile,
    getText: (fileName = activeFile) => buffers.getText(fileName),
    getSelections: () => activeFile ? modelFor(activeFile, buffers.getText(activeFile) ?? "").getSelections() : [],
    flush() {
      if (activeFile && editing) {
        const model = captureModelSelection();
        buffers.setText(activeFile, model?.getText() ?? readEditableText(sourceContent));
        setDirty(activeFile);
      }
      return buffers.persist();
    }
  });
}
