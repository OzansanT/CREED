export const DEFAULT_DESIGN_TOKENS = Object.freeze({
  colors: Object.freeze({
    canvas: "#fcfcfe",
    surface: "#ffffff",
    text: "#2f2f33",
    muted: "#6f6f75",
    accent: "#0e639c",
    danger: "#b42318"
  }),
  spacing: Object.freeze({ xs: 4, sm: 8, md: 16, lg: 24, xl: 40 }),
  radii: Object.freeze({ sm: 3, md: 6, lg: 12, pill: 999 }),
  typography: Object.freeze({
    body: "Segoe UI, system-ui, sans-serif",
    code: "Consolas, Courier New, monospace"
  })
});

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function normalizeDesignTokens(tokens) {
  const source = tokens && typeof tokens === "object" ? tokens : {};
  return {
    colors: { ...clone(DEFAULT_DESIGN_TOKENS.colors), ...(source.colors || {}) },
    spacing: { ...clone(DEFAULT_DESIGN_TOKENS.spacing), ...(source.spacing || {}) },
    radii: { ...clone(DEFAULT_DESIGN_TOKENS.radii), ...(source.radii || {}) },
    typography: { ...clone(DEFAULT_DESIGN_TOKENS.typography), ...(source.typography || {}) }
  };
}

export function resolveToken(value, tokens) {
  if (typeof value !== "string" || !value.startsWith("$")) return value;
  const [group, name] = value.slice(1).split(".");
  return tokens?.[group]?.[name] ?? value;
}
