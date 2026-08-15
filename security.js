const STYLE_PROPERTIES = new Set([
  "background", "backgroundColor", "borderColor", "borderRadius", "borderStyle",
  "borderWidth", "color", "fontFamily", "fontSize", "fontWeight", "lineHeight",
  "opacity", "padding", "textAlign"
]);

export function sanitizeUrl(value, { image = false } = {}) {
  const url = String(value || "").trim();
  if (!url) return "";
  if (url.startsWith("#") || url.startsWith("/")) return url;
  if (image && /^data:image\/(?:png|jpe?g|gif|webp|avif);base64,[a-z0-9+/=\s]+$/i.test(url)) return url;
  try {
    const parsed = new URL(url, "https://creed.invalid/");
    if (["http:", "https:"].includes(parsed.protocol)) return url;
    if (!image && ["mailto:", "tel:"].includes(parsed.protocol)) return url;
  } catch { /* Reject malformed URLs. */ }
  return image ? "" : "#";
}

export function sanitizeCssValue(property, value) {
  if (!STYLE_PROPERTIES.has(property)) return "";
  const text = String(value ?? "").trim().slice(0, 500);
  if (!text || /[;{}<>\u0000-\u001f]/.test(text) || /(?:url|expression|@import)\s*\(/i.test(text)) return "";
  return text;
}

export function safeClassToken(value) {
  return Array.from(String(value || "component")).map((character) => /[A-Za-z0-9_-]/.test(character)
    ? character
    : `-${character.codePointAt(0).toString(16)}-`).join("");
}

export function safeDownloadName(value, fallback = "download.txt") {
  const name = String(value || "").replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-").replace(/^\.+/, "").trim().slice(0, 180);
  return name || fallback;
}

export function safeMimeType(value) {
  const type = String(value || "").toLowerCase();
  return /^(?:text\/[a-z0-9.+-]+|application\/(?:json|pdf|zip|octet-stream)|image\/(?:png|jpeg|gif|webp|avif))$/.test(type)
    ? type
    : "application/octet-stream";
}
