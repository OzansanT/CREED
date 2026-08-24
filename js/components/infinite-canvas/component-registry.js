export function createCanvasComponentRegistry() {
  const definitions = new Map();

  function register(definition) {
    if (!definition || typeof definition.type !== "string" || !definition.type.trim()) {
      throw new TypeError("Canvas component definition requires a type.");
    }
    if (typeof definition.mount !== "function") {
      throw new TypeError(`Canvas component ${definition.type} requires mount().`);
    }
    const normalized = Object.freeze({
      title: definition.type,
      description: "",
      singleton: false,
      defaultWidth: 360,
      defaultHeight: 240,
      ...definition,
      type: definition.type.trim()
    });
    definitions.set(normalized.type, normalized);
    return normalized;
  }

  return Object.freeze({
    register,
    get: (type) => definitions.get(type) || null,
    has: (type) => definitions.has(type),
    list: () => [...definitions.values()]
  });
}
