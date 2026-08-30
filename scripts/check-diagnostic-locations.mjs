import assert from "node:assert/strict";
import {
  buildDependencyModel,
  findArchitectureViolations
} from "../js/components/diagnostics/diagnostics-model.js";

const jsLocationLines = [
  "const before = true;",
  '  import("./missing-position.js");',
  '    export { value } from "./missing-export.js";'
];
const jsLocationArchitecture = await findArchitectureViolations({
  listFiles: () => ["js/location-test.js"],
  readFile: async () => jsLocationLines.join("\n")
});
const dynamicLocation = jsLocationArchitecture.find((item) => item.message.includes("./missing-position.js"));
const exportLocation = jsLocationArchitecture.find((item) => item.message.includes("./missing-export.js"));
assert.deepEqual(
  [dynamicLocation?.line, dynamicLocation?.column],
  [1, jsLocationLines[1].indexOf("import")],
  "Dynamic unresolved imports must report the import keyword location."
);
assert.deepEqual(
  [exportLocation?.line, exportLocation?.column],
  [2, jsLocationLines[2].indexOf("export")],
  "Re-export dependencies must report the export keyword location."
);

const sameLineArchitecture = await findArchitectureViolations({
  listFiles: () => ["js/same-line.js"],
  readFile: async () => 'import("./first.js"); import("./second.js");'
});
const sameLineImports = sameLineArchitecture.filter((item) => item.code === "UNRESOLVED-IMPORT");
assert.equal(sameLineImports.length, 2);
assert.notEqual(
  sameLineImports[0].id,
  sameLineImports[1].id,
  "Diagnostic IDs must remain unique for multiple imports on one line."
);

const templateLocationLine = 'const value = `prefix ${import("./missing-template-position.js")}`;';
const templateLocationArchitecture = await findArchitectureViolations({
  listFiles: () => ["scripts/template-location.js"],
  readFile: async () => ["const before = true;", templateLocationLine].join("\n")
});
const templateLocation = templateLocationArchitecture.find((item) => item.message.includes("./missing-template-position.js"));
assert.deepEqual(
  [templateLocation?.line, templateLocation?.column],
  [1, templateLocationLine.indexOf("import")],
  "Imports inside template expressions must preserve their original source location."
);

const cssLocationLine = '    @import url("./missing-position.css");';
const cssLocationArchitecture = await findArchitectureViolations({
  listFiles: () => ["css/location.css"],
  readFile: async () => [":root {}", cssLocationLine].join("\n")
});
const cssLocation = cssLocationArchitecture.find((item) => item.message.includes("./missing-position.css"));
assert.deepEqual(
  [cssLocation?.line, cssLocation?.column],
  [1, cssLocationLine.indexOf("@import")],
  "CSS unresolved imports must report the @import location."
);

const dependencies = await buildDependencyModel({
  listFiles: () => ["js/main.js", "js/run.js"],
  readFile: async (path) => path === "js/main.js"
    ? 'const ratio = total / count; import("./run.js");'
    : "export const run = true;"
});
assert(
  dependencies.edges.some((edge) => edge.from === "file:js/main.js" && edge.to === "file:js/run.js"),
  "Location metadata must not change dependency-edge resolution."
);

console.log("Diagnostic location checks passed.");
