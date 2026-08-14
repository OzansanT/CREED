function getFileKind(fileName) {
  const extension = fileName.split(".").pop()?.toLowerCase();
  if (extension === "css") return "#";
  if (extension === "js") return "JS";
  if (extension === "html") return "<>";
  if (extension === "md") return "◆";
  return "•";
}

function renderCode(source, target) {
  const fragment = document.createDocumentFragment();
  const lines = source.replace(/\r\n/g, "\n").split("\n");

  lines.forEach((line, index) => {
    const row = document.createElement("div");
    row.className = "source-line";

    const number = document.createElement("span");
    number.className = "source-line__number";
    number.textContent = String(index + 1);

    const code = document.createElement("span");
    code.className = "source-line__code";
    code.textContent = line || " ";

    row.append(number, code);
    fragment.append(row);
  });

  target.replaceChildren(fragment);
}

export function bindWorkbenchFiles({
  fileButtons,
  canvasTab,
  codeTab,
  codeTabKind,
  codeTabName,
  breadcrumbKind,
  breadcrumbName,
  canvasView,
  codeView,
  codeContent,
  onCanvasShow,
  onError
}) {
  let openedFile = "";
  let requestController = null;

  function setSelectedFile(fileName) {
    fileButtons.forEach((button) => {
      const selected = button.dataset.file === fileName;
      button.classList.toggle("selected", selected);
      button.setAttribute("aria-selected", String(selected));
    });
  }

  function showCanvas() {
    requestController?.abort();
    canvasView.hidden = false;
    codeView.hidden = true;
    canvasTab.classList.add("active");
    canvasTab.setAttribute("aria-selected", "true");
    codeTab.classList.remove("active");
    codeTab.setAttribute("aria-selected", "false");
    setSelectedFile("");
    onCanvasShow?.();
  }

  function showCode() {
    if (!openedFile) return;
    canvasView.hidden = true;
    codeView.hidden = false;
    canvasTab.classList.remove("active");
    canvasTab.setAttribute("aria-selected", "false");
    codeTab.hidden = false;
    codeTab.classList.add("active");
    codeTab.setAttribute("aria-selected", "true");
  }

  async function openFile(button) {
    const fileName = button.dataset.file;
    if (!fileName) return;

    requestController?.abort();
    requestController = new AbortController();
    openedFile = fileName;
    setSelectedFile(fileName);

    codeTab.hidden = false;
    const fileKind = getFileKind(fileName);
    codeTabKind.textContent = fileKind;
    codeTabName.textContent = fileName;
    breadcrumbKind.textContent = fileKind;
    breadcrumbName.textContent = fileName;
    codeContent.setAttribute("aria-busy", "true");
    codeContent.textContent = "Loading…";
    showCode();

    try {
      const response = await fetch(`./${encodeURIComponent(fileName)}`, {
        cache: "no-store",
        signal: requestController.signal
      });
      if (!response.ok) throw new Error(`Unable to load ${fileName} (${response.status})`);
      renderCode(await response.text(), codeContent);
    } catch (error) {
      if (error.name === "AbortError") return;
      codeContent.textContent = `Unable to display ${fileName}.`;
      onError?.(error.message);
    } finally {
      codeContent.removeAttribute("aria-busy");
    }
  }

  fileButtons.forEach((button) => {
    button.addEventListener("click", () => openFile(button));
  });
  canvasTab.addEventListener("click", showCanvas);
  codeTab.addEventListener("click", showCode);

  return { showCanvas, showCode };
}
