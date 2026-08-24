import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildSystemGraph,
  filterSystemGraph,
  layoutSystemGraph,
  resolveWorkspaceDependency
} from "../js/components/infinite-canvas/system-graph-model.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");

const files = new Map([
  ["index.html", '<main id="app"><button id="runBtn"><span id="runIcon"></span></button></main>'],
  ["css/main.css", '@import "./buttons.css";\n#app { display:grid; }'],
  ["css/buttons.css", "button { cursor:pointer; }"],
  ["js/main.js", 'import { bind } from "./run.js";\nconst runBtn = document.getElementById("runBtn");\nfunction boot() { bind(runBtn); }'],
  ["js/run.js", "export function bind(node) { node.addEventListener('click', () => {}); }"]
]);
const workspace = {
  listFiles: () => [...files.keys()],
  readFile: async (path) => {
    if (!files.has(path)) throw new Error("missing " + path);
    return files.get(path);
  }
};

assert.equal(resolveWorkspaceDependency("./run.js", "js/main.js", new Set(files.keys())), "js/run.js");
assert.equal(resolveWorkspaceDependency("./buttons.css", "css/main.css", new Set(files.keys())), "css/buttons.css");

const graph = await buildSystemGraph({ workspace });
assert(graph.nodes.some((node) => node.id === "file:index.html"), "HTML file node missing.");
assert(graph.nodes.some((node) => node.id === "file:js/main.js"), "JavaScript file node missing.");
assert(graph.nodes.some((node) => node.id === "dom:index.html#runBtn"), "DOM id node missing.");
assert(graph.edges.some((edge) => edge.type === "import" && edge.from === "file:js/main.js" && edge.to === "file:js/run.js"), "ES module dependency edge missing.");
assert(graph.edges.some((edge) => edge.type === "css-import" && edge.from === "file:css/main.css" && edge.to === "file:css/buttons.css"), "CSS import edge missing.");
assert(graph.edges.some((edge) => edge.type === "dom" && edge.from === "dom:index.html#runBtn" && edge.to === "dom:index.html#runIcon"), "DOM hierarchy edge missing.");
assert(graph.edges.some((edge) => edge.type === "owner" && edge.from === "dom:index.html#runBtn" && edge.to === "file:js/main.js"), "DOM control ownership edge missing.");
assert(graph.symbols.some((symbol) => symbol.name === "boot" && symbol.nodeId === "file:js/main.js"), "Symbol-to-file-node mapping missing.");

const positions = layoutSystemGraph(graph);
assert.equal(positions.size, graph.nodes.length, "Auto layout must position every graph node.");
for (const position of positions.values()) {
  assert(Number.isFinite(position.x) && Number.isFinite(position.y), "Graph positions must be finite world coordinates.");
}
const jsOnly = filterSystemGraph(graph, ["js"]);
assert(jsOnly.nodes.length >= 2 && jsOnly.nodes.every((node) => node.category === "js"), "Graph category filtering failed.");
assert(jsOnly.edges.every((edge) => jsOnly.nodes.some((node) => node.id === edge.from) && jsOnly.nodes.some((node) => node.id === edge.to)), "Filtered edges must reference visible nodes only.");

const view = read("js/components/infinite-canvas/system-graph-view.js");
assert(view.includes("openFile?.(node.fileName)"), "Graph file nodes must open workspace files.");
assert(view.includes("function focusSymbol"), "System graph must support symbol navigation.");
assert(view.includes("SYSTEM_GRAPH_VIEWS_STORAGE_KEY"), "Named graph views must be persisted.");
assert(view.includes("dataset.graphCategory"), "System graph must expose category filters.");
assert(view.includes("Embedded System Graph requires a host and graph service"), "System graph view must mount inside a component host.");

const service = read("js/components/infinite-canvas/system-graph-service.js");
assert(service.includes("createSystemGraphService"), "Headless graph service is missing.");
assert(service.includes("workspace.subscribe?.(scheduleRefresh)"), "Headless graph service must follow workspace changes.");

const definitions = read("js/components/infinite-canvas/component-definitions.js");
assert(definitions.includes('type: "system-graph"'), "System Graph component definition is missing.");
assert(definitions.includes("bindSystemGraph"), "System Graph component must own the visual graph lifecycle.");
assert(definitions.includes("singleton: true"), "System Graph must remain a singleton canvas component.");

const manager = read("js/components/infinite-canvas/component-manager.js");
assert(manager.includes("application/x-creed-canvas-component"), "Canvas components must support palette drag/drop.");
assert(manager.includes("remove(record.id)"), "Canvas component close control must remove the instance.");

const main = read("js/main.js");
assert(main.includes("createSystemGraphService"), "Application orchestration must create the headless System Graph service.");
assert(main.includes("registerDefaultCanvasComponents"), "Application orchestration must register canvas components.");
assert(!main.includes("const systemGraph = bindSystemGraph"), "System Graph must not be mounted globally at startup.");
assert(main.includes("systemGraphService: systemGraph"), "System Graph component must receive the headless service.");

console.log("System graph component checks passed.");
