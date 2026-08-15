const LANGUAGE_BY_EXTENSION = Object.freeze({
  css: { kind: "#", label: "{ } CSS", name: "CSS" },
  js: { kind: "JS", label: "{ } JavaScript", name: "JavaScript" },
  mjs: { kind: "JS", label: "{ } JavaScript", name: "JavaScript" },
  html: { kind: "<>", label: "<> HTML", name: "HTML" },
  htm: { kind: "<>", label: "<> HTML", name: "HTML" },
  md: { kind: "◆", label: "◆ Markdown", name: "Markdown" },
  json: { kind: "{}", label: "{ } JSON", name: "JSON" },
  yml: { kind: "Y", label: "YAML", name: "YAML" },
  yaml: { kind: "Y", label: "YAML", name: "YAML" },
  txt: { kind: "•", label: "Plain Text", name: "Plain Text" }
});

export function getFileExtension(fileName) {
  const name = String(fileName || "").split("/").pop() || "";
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
}

export function getLanguageInfo(fileName) {
  const extension = getFileExtension(fileName);
  return {
    extension,
    ...(LANGUAGE_BY_EXTENSION[extension] || { kind: "•", label: "Plain Text", name: "Plain Text" })
  };
}

export function getFileName(path) {
  return String(path || "").split("/").pop() || "";
}
