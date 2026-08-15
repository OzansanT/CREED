import { getComponentById } from "./component-registry.js";

const SVG_NS = "http://www.w3.org/2000/svg";

function svgElement(name, attributes = {}) {
  const element = document.createElementNS(SVG_NS, name);
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
  return element;
}

export function syncConnectors(layer, state) {
  const fragment = document.createDocumentFragment();
  state.connections.forEach((connection) => {
    const from = getComponentById(state.components, connection.from);
    const to = getComponentById(state.components, connection.to);
    if (!from?.visible || !to?.visible) return;
    const distance = Math.max(40, Math.abs(to.x - from.x) * .45);
    const path = svgElement("path", {
      class: "connector-line",
      d: "M " + from.x + " " + from.y +
        " C " + (from.x + distance) + " " + from.y +
        ", " + (to.x - distance) + " " + to.y +
        ", " + to.x + " " + to.y,
      stroke: connection.color || "#64748b"
    });
    path.dataset.connectionId = connection.id;
    fragment.append(path);
    if (connection.label) {
      const label = svgElement("text", {
        class: "connector-label",
        x: (from.x + to.x) / 2,
        y: (from.y + to.y) / 2 - 6
      });
      label.textContent = connection.label;
      fragment.append(label);
    }
  });
  layer.replaceChildren(fragment);
}
