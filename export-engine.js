import { serializeCreedDocument } from "./creed-document.js";
import { resolveResponsiveStyles } from "./responsive-styles.js";
import { safeClassToken, sanitizeCssValue, sanitizeUrl } from "./security.js";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function kebab(value) {
  return value.replace(/[A-Z]/g, (letter) => "-" + letter.toLowerCase());
}

function styleRules(styles) {
  return Object.entries(styles)
    .map(([property, value]) => [property, sanitizeCssValue(property, value)])
    .filter(([, value]) => value)
    .map(([property, value]) => "  " + kebab(property) + ": " + value + ";")
    .join("\n");
}

function componentMarkup(component) {
  const props = component.props || {};
  const className = "creed-component creed-" + safeClassToken(component.type) + " creed-id-" + safeClassToken(component.id);
  if (component.type === "image") {
    return '<img class="' + className + '" src="' + escapeHtml(sanitizeUrl(props.src, { image: true })) +
      '" alt="' + escapeHtml(props.alt) + '">';
  }
  if (component.type === "button" || component.type === "link") {
    return '<a class="' + className + '" href="' + escapeHtml(sanitizeUrl(props.href)) + '">' +
      escapeHtml(props.text || component.name) + "</a>";
  }
  if (component.type === "text") {
    return '<p class="' + className + '">' + escapeHtml(props.text) + "</p>";
  }
  if (component.type === "json" || component.type === "file") {
    return '<div class="' + className + '">' + escapeHtml(props.title || props.name || component.name) + "</div>";
  }
  return '<section class="' + className + '"><span>' +
    escapeHtml(props.label || props.title || component.name) + "</span></section>";
}

function componentCss(component, document) {
  const base = resolveResponsiveStyles(component, "desktop", document.designTokens);
  const tablet = resolveResponsiveStyles(component, "tablet", document.designTokens);
  const mobile = resolveResponsiveStyles(component, "mobile", document.designTokens);
  const selector = ".creed-id-" + safeClassToken(component.id);
  return [
    selector + " {",
    "  position: absolute;",
    "  left: " + (component.x + document.worldOrigin.x) + "px;",
    "  top: " + (component.y + document.worldOrigin.y) + "px;",
    "  width: " + component.width + "px;",
    "  height: " + component.height + "px;",
    "  transform: translate(-50%, -50%) rotate(" + component.rotation + "deg);",
    "  z-index: " + component.z + ";",
    styleRules(base),
    "}",
    "@media (max-width: 900px) {",
    "  " + selector + " {",
    styleRules(tablet).split("\n").map((line) => "  " + line).join("\n"),
    "  }",
    "}",
    "@media (max-width: 600px) {",
    "  " + selector + " {",
    styleRules(mobile).split("\n").map((line) => "  " + line).join("\n"),
    "  }",
    "}"
  ].filter(Boolean).join("\n");
}

export function buildHtmlExport(sourceDocument) {
  const document = serializeCreedDocument(sourceDocument);
  const components = document.components.filter((component) =>
    component.visible && component.type !== "origin"
  );
  const css = [
    "* { box-sizing: border-box; }",
    "html, body { min-height: 100%; margin: 0; }",
    "body { position: relative; overflow: auto; font-family: Segoe UI, system-ui, sans-serif; }",
    ".creed-component { display: flex; align-items: center; justify-content: center; }",
    ...components.map((component) => componentCss(component, document))
  ].join("\n\n");
  const body = components.map(componentMarkup).join("\n  ");
  return "<!doctype html>\n<html lang=\"en\">\n<head>\n" +
    "  <meta charset=\"utf-8\">\n" +
    "  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n" +
    "  <title>" + escapeHtml(document.title) + "</title>\n" +
    "  <style>\n" + css + "\n  </style>\n" +
    "</head>\n<body>\n  " + body + "\n</body>\n</html>\n";
}

export function buildWordPressMapping(sourceDocument) {
  const document = serializeCreedDocument(sourceDocument);
  return {
    version: 1,
    title: document.title,
    blocks: document.components
      .filter((component) => component.visible && component.type !== "origin")
      .map((component) => ({
        clientId: component.id,
        blockName: "creed/" + component.type,
        attrs: {
          ...component.props,
          transform: {
            x: component.x + document.worldOrigin.x,
            y: component.y + document.worldOrigin.y,
            width: component.width,
            height: component.height,
            rotation: component.rotation
          },
          styles: component.styles
        }
      }))
  };
}

function download(name, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function bindExportControls({ htmlButton, jsonButton, wordpressButton, state }) {
  htmlButton.addEventListener("click", () => {
    download("creed-export.html", buildHtmlExport(state), "text/html");
  });
  jsonButton.addEventListener("click", () => {
    download(
      "creed-workspace.json",
      JSON.stringify(serializeCreedDocument(state), null, 2),
      "application/json"
    );
  });
  wordpressButton.addEventListener("click", () => {
    download(
      "creed-wordpress.json",
      JSON.stringify(buildWordPressMapping(state), null, 2),
      "application/json"
    );
  });
}
