import { WORKSPACE_FILES } from "./source-files.js";
import { getFileExtension, getFileKind } from "./file-metadata.js";

function createFileButton(fileName) {
  const button = document.createElement("button");
  const icon = document.createElement("span");
  const label = document.createElement("span");
  const extension = getFileExtension(fileName);

  button.className = "file-row";
  button.type = "button";
  button.dataset.resource = fileName;
  button.setAttribute("role", "option");
  button.setAttribute("aria-selected", "false");

  icon.className = "file-row__icon file-row__icon--" + (extension || "file");
  icon.textContent = getFileKind(fileName);
  label.className = "file-row__name";
  label.textContent = fileName;
  button.append(icon, label);
  return button;
}

function renderFileTree(fileTree) {
  const fragment = document.createDocumentFragment();
  WORKSPACE_FILES.forEach((fileName) => fragment.append(createFileButton(fileName)));
  fileTree.replaceChildren(fragment);
  return [...fileTree.querySelectorAll(".file-row[data-resource]")];
}

export function createExplorerController({ rootToggle, fileTree, onOpen }) {
  const fileButtons = renderFileTree(fileTree);

  function setExpanded(expanded) {
    rootToggle.setAttribute("aria-expanded", String(expanded));
    rootToggle.title = expanded ? "Collapse CREED files" : "Expand CREED files";
    fileTree.hidden = !expanded;
  }

  function setSelected(fileName) {
    fileButtons.forEach((button) => {
      const selected = button.dataset.resource === fileName;
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-selected", String(selected));
    });
  }

  fileButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const fileName = button.dataset.resource;
      if (fileName) onOpen?.(fileName);
    });
  });

  rootToggle.addEventListener("click", () => {
    setExpanded(rootToggle.getAttribute("aria-expanded") !== "true");
  });

  setExpanded(true);

  return Object.freeze({ setExpanded, setSelected });
}
