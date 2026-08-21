export function getFileExtension(fileName) {
  return fileName.split(".").pop()?.toLowerCase() || "";
}

export function getFileKind(fileName) {
  const extension = getFileExtension(fileName);
  if (extension === "css") return "#";
  if (["js", "mjs", "cjs"].includes(extension)) return "JS";
  if (["html", "htm"].includes(extension)) return "<>";
  if (extension === "json") return "{}";
  if (extension === "md") return "◆";
  return "•";
}

export function getLanguageLabel(fileName) {
  const extension = getFileExtension(fileName);
  if (extension === "css") return "{ } CSS";
  if (["js", "mjs", "cjs"].includes(extension)) return "{ } JavaScript";
  if (["html", "htm"].includes(extension)) return "<> HTML";
  if (extension === "json") return "{ } JSON";
  if (extension === "md") return "◆ Markdown";
  return "Plain Text";
}
