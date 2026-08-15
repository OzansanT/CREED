const SVG_NS = "http://www.w3.org/2000/svg";

const ICONS = Object.freeze({
  creed: [
    ["path", { d: "M12 2.8 20.2 12 12 21.2 3.8 12 12 2.8Z" }],
    ["path", { d: "m8.4 12 2.2 2.2 5-5" }]
  ],
  "arrow-left": [["path", { d: "m15 18-6-6 6-6" }]],
  "arrow-right": [["path", { d: "m9 18 6-6-6-6" }]],
  search: [
    ["circle", { cx: "10.8", cy: "10.8", r: "6.3" }],
    ["path", { d: "m15.5 15.5 4.5 4.5" }]
  ],
  bell: [
    ["path", { d: "M18 9a6 6 0 0 0-12 0c0 7-3 7-3 7h18s-3 0-3-7" }],
    ["path", { d: "M13.8 20h-3.6" }]
  ],
  "panel-left": [
    ["rect", { x: "3", y: "4", width: "18", height: "16", rx: "1.8" }],
    ["path", { d: "M8.5 4v16" }]
  ],
  "panel-bottom": [
    ["rect", { x: "3", y: "4", width: "18", height: "16", rx: "1.8" }],
    ["path", { d: "M3 14.5h18" }]
  ],
  "panel-right": [
    ["rect", { x: "3", y: "4", width: "18", height: "16", rx: "1.8" }],
    ["path", { d: "M15.5 4v16" }]
  ],
  home: [
    ["path", { d: "m4 10 8-6 8 6" }],
    ["path", { d: "M6.5 9.5V20h11V9.5M10 20v-6h4v6" }]
  ],
  reset: [
    ["path", { d: "M4.9 7.5A8 8 0 1 1 4 14" }],
    ["path", { d: "M4.9 3.8v3.7h3.7" }]
  ],
  infinity: [
    ["path", { d: "M8.2 8.2c-2.1 0-3.7 1.7-3.7 3.8s1.6 3.8 3.7 3.8c4.2 0 3.4-7.6 7.6-7.6 2.1 0 3.7 1.7 3.7 3.8s-1.6 3.8-3.7 3.8c-4.2 0-3.4-7.6-7.6-7.6Z" }]
  ],
  "more-horizontal": [
    ["circle", { cx: "5", cy: "12", r: "1" }],
    ["circle", { cx: "12", cy: "12", r: "1" }],
    ["circle", { cx: "19", cy: "12", r: "1" }]
  ],
  "chevron-right": [["path", { d: "m9 18 6-6-6-6" }]],
  "file-plus": [
    ["path", { d: "M6 3h8l4 4v14H6V3Z" }],
    ["path", { d: "M14 3v5h5M9 14h6M12 11v6" }]
  ],
  "folder-plus": [
    ["path", { d: "M3 6.5h7l2 2h9V20H3V6.5Z" }],
    ["path", { d: "M9 14h6M12 11v6" }]
  ],
  refresh: [
    ["path", { d: "M20 7v5h-5" }],
    ["path", { d: "M19 12a7 7 0 1 1-2-5" }]
  ],
  split: [
    ["rect", { x: "3", y: "4", width: "18", height: "16", rx: "1.8" }],
    ["path", { d: "M12 4v16" }]
  ],
  terminal: [
    ["rect", { x: "3", y: "4", width: "18", height: "16", rx: "1.8" }],
    ["path", { d: "m7 9 3 3-3 3M13 15h4" }]
  ],
  plus: [["path", { d: "M12 5v14M5 12h14" }]],
  trash: [
    ["path", { d: "M4 7h16M9 3h6l1 4H8l1-4ZM7 7l1 14h8l1-14M10 11v6M14 11v6" }]
  ],
  maximize: [
    ["path", { d: "M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5" }]
  ],
  close: [["path", { d: "m7 7 10 10M17 7 7 17" }]],
  settings: [
    ["circle", { cx: "12", cy: "12", r: "3" }],
    ["path", { d: "M19 13.5v-3l-2-.7-.7-1.7.9-1.9-2.1-2.1-1.9.9-1.7-.7-.7-2h-3l-.7 2-1.7.7-1.9-.9-2.1 2.1.9 1.9-.7 1.7-2 .7v3l2 .7.7 1.7-.9 1.9 2.1 2.1 1.9-.9 1.7.7.7 2h3l.7-2 1.7-.7 1.9.9 2.1-2.1-.9-1.9.7-1.7 2-.7Z" }]
  ],
  send: [
    ["path", { d: "m4 4 17 8-17 8 3-8-3-8Z" }],
    ["path", { d: "M7 12h14" }]
  ],
  laptop: [
    ["rect", { x: "4", y: "4", width: "16", height: "12", rx: "1.5" }],
    ["path", { d: "M2.5 20h19" }]
  ],
  "shield-check": [
    ["path", { d: "M12 3 5 6v5c0 4.5 2.8 7.6 7 10 4.2-2.4 7-5.5 7-10V6l-7-3Z" }],
    ["path", { d: "m9 12 2 2 4-4" }]
  ],
  remote: [
    ["path", { d: "m8 7-5 5 5 5M16 7l5 5-5 5" }],
    ["path", { d: "M14 4 10 20" }]
  ],
  error: [
    ["circle", { cx: "12", cy: "12", r: "9" }],
    ["path", { d: "m9 9 6 6M15 9l-6 6" }]
  ],
  warning: [
    ["path", { d: "M12 3 2.8 20h18.4L12 3Z" }],
    ["path", { d: "M12 9v5M12 17.2v.1" }]
  ],
  sliders: [
    ["path", { d: "M4 7h10M18 7h2M4 17h2M10 17h10" }],
    ["circle", { cx: "16", cy: "7", r: "2" }],
    ["circle", { cx: "8", cy: "17", r: "2" }]
  ]
});

function setAttributes(element, attributes) {
  Object.entries(attributes).forEach(([name, value]) => {
    element.setAttribute(name, value);
  });
}

export function createIcon(name, className = "ui-icon") {
  const definition = ICONS[name];
  if (!definition) throw new Error("Unknown icon: " + name);

  const svg = document.createElementNS(SVG_NS, "svg");
  svg.classList.add(...className.split(" ").filter(Boolean));
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");

  definition.forEach(([tagName, attributes]) => {
    const shape = document.createElementNS(SVG_NS, tagName);
    setAttributes(shape, attributes);
    svg.append(shape);
  });

  return svg;
}

export function hydrateIcons(root = document) {
  root.querySelectorAll("[data-icon]").forEach((host) => {
    const name = host.dataset.icon;
    if (!ICONS[name]) return;
    host.replaceChildren(createIcon(name));
  });
}
