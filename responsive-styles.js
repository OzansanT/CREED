import { resolveToken } from "./design-tokens.js";
import { sanitizeCssValue } from "./security.js";

export const PREVIEW_BREAKPOINTS = Object.freeze(["desktop", "tablet", "mobile"]);

export function normalizeResponsiveStyles(styles) {
  const source = styles && typeof styles === "object" ? styles : {};
  return {
    desktop: { ...(source.desktop || source.base || {}) },
    tablet: { ...(source.tablet || {}) },
    mobile: { ...(source.mobile || {}) }
  };
}

export function resolveResponsiveStyles(component, breakpoint, tokens) {
  const styles = normalizeResponsiveStyles(component.styles);
  const merged = { ...styles.desktop };
  if (breakpoint === "tablet" || breakpoint === "mobile") Object.assign(merged, styles.tablet);
  if (breakpoint === "mobile") Object.assign(merged, styles.mobile);
  return Object.fromEntries(
    Object.entries(merged).map(([property, value]) => [property, resolveToken(value, tokens)])
  );
}

export function applyResponsiveStyles(element, component, breakpoint, tokens) {
  const styles = resolveResponsiveStyles(component, breakpoint, tokens);
  const allowed = [
    "background", "backgroundColor", "borderColor", "borderRadius", "borderStyle",
    "borderWidth", "color", "fontFamily", "fontSize", "fontWeight", "lineHeight",
    "opacity", "padding", "textAlign"
  ];
  allowed.forEach((property) => {
    element.style[property] = styles[property] == null ? "" : sanitizeCssValue(property, styles[property]);
  });
}
