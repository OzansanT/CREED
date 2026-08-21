function isCommandKey(event) {
  return event.ctrlKey || event.metaKey;
}

function readEditableText(element) {
  return String(element.innerText ?? element.textContent ?? "").replace(/\r\n?/g, "\n");
}

export function bindEditorEditing({
  sourceContent,
  sourceScroller,
  sourceViewport,
  workspace,
  buffers,
  onDirtyChange,
  onSaved,
  onStatus,
  onError
}) {
  let activeFile = "";
  let editing = false;
  let renderGeneration = 0;

  function setDirty(fileName) {
    onDirtyChange?.(fileName, buffers.isDirty(fileName));
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
    onStatus?.("EDITING");
    return true;
  }

  async function leaveEditMode({ preserveScroll = true } = {}) {
    if (!activeFile || !buffers.has(activeFile)) return false;
    const scrollTop = sourceScroller.scrollTop;
    const scrollLeft = sourceScroller.scrollLeft;
    if (editing) {
      const text = readEditableText(sourceContent);
      buffers.setText(activeFile, text);
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
    setDirty(fileName);
    await renderText(fileName, text);
    onStatus?.(buffers.isDirty(fileName) ? "UNSAVED" : "");
    return text;
  }

  async function setActiveFile(fileName) {
    if (activeFile === fileName) return;
    if (activeFile && editing) {
      const previous = activeFile;
      const text = readEditableText(sourceContent);
      buffers.setText(previous, text);
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
      buffers.setText(fileName, readEditableText(sourceContent));
    }
    const text = buffers.getText(fileName) ?? "";
    workspace.writeFile(fileName, text);
    buffers.markSaved(fileName);
    setDirty(fileName);
    onSaved?.(fileName, text);
    if (fileName === activeFile) {
      await renderText(fileName, text);
      onStatus?.("SAVED");
    }
    return true;
  }

  async function saveActive() {
    return saveFile(activeFile);
  }

  async function saveAll() {
    const dirtyFiles = buffers.dirtyFiles();
    let saved = 0;
    for (const fileName of dirtyFiles) {
      if (await saveFile(fileName)) saved += 1;
    }
    onStatus?.(saved ? `SAVED ${saved}` : "NO CHANGES");
    return saved;
  }

  async function revertActive() {
    if (!activeFile || !buffers.has(activeFile)) return false;
    const savedText = await workspace.readFile(activeFile);
    buffers.revert(activeFile, savedText);
    setDirty(activeFile);
    await renderText(activeFile, savedText);
    onStatus?.("REVERTED");
    return true;
  }

  async function applyHistory(direction) {
    if (!activeFile || !editing) return false;
    const currentText = readEditableText(sourceContent);
    buffers.setText(activeFile, currentText, { recordHistory: false });
    const text = direction === "undo" ? buffers.undo(activeFile) : buffers.redo(activeFile);
    if (text == null) return false;
    sourceContent.textContent = text;
    setDirty(activeFile);
    onStatus?.(buffers.isDirty(activeFile) ? "UNSAVED" : "");
    return true;
  }

  sourceContent.addEventListener("dblclick", () => enterEditMode());
  sourceContent.addEventListener("input", () => {
    if (!activeFile || !editing) return;
    buffers.setText(activeFile, readEditableText(sourceContent));
    setDirty(activeFile);
    onStatus?.("UNSAVED");
  });
  sourceContent.addEventListener("blur", () => {
    if (!activeFile || !editing) return;
    buffers.setText(activeFile, readEditableText(sourceContent));
    setDirty(activeFile);
  });

  document.addEventListener("keydown", (event) => {
    if (!activeFile) return;
    const key = event.key.toLowerCase();
    if (isCommandKey(event) && key === "s") {
      event.preventDefault();
      const action = event.shiftKey ? saveAll() : saveActive();
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
      buffers.setText(activeFile, readEditableText(sourceContent));
      setDirty(activeFile);
    }
    buffers.persist();
  });

  function renameFile(oldName, newName) {
    if (activeFile === oldName) activeFile = newName;
    return activeFile;
  }

  return Object.freeze({
    hydrate,
    setActiveFile,
    renameFile,
    enterEditMode,
    leaveEditMode,
    saveActive,
    saveAll,
    revertActive,
    isEditing: () => editing,
    getActiveFile: () => activeFile,
    getText: (fileName = activeFile) => buffers.getText(fileName),
    flush() {
      if (activeFile && editing) {
        buffers.setText(activeFile, readEditableText(sourceContent));
        setDirty(activeFile);
      }
      return buffers.persist();
    }
  });
}
