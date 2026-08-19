export function getFileExtension(fileName) {
  return fileName.split(".").pop()?.toLowerCase() || "";
}

export function getFileKind(fileName) {
  const extension = getFileExtension(fileName);
  if (extension === "css") return "#";
  if (extension === "js") return "JS";
  if (extension === "html") return "<>";
  if (extension === "md") return "◆";
  return "•";
}

export function getLanguageLabel(fileName) {
  const extension = getFileExtension(fileName);
  if (extension === "css") return "{ } CSS";
  if (extension === "js") return "{ } JavaScript";
  if (extension === "html") return "<> HTML";
  if (extension === "md") return "◆ Markdown";
  return "Plain Text";
}
