import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const framePath = resolve(repositoryRoot, "ui/main-frame.html");
const registryPath = resolve(repositoryRoot, "ui/bars/bar-registry.json");
const outputPath = resolve(repositoryRoot, "index.html");
const requiredPartials = Object.freeze([
  {
    slot: "infinite-canvas",
    template: "ui/infinite-canvas.html"
  }
]);
const optionalPartials = Object.freeze([
  {
    slot: "windows-local-launcher",
    template: "optional/windows-local-launcher/launcher-bridge.html"
  }
]);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readRegistry() {
  const bars = JSON.parse(readFileSync(registryPath, "utf8"));
  assert(Array.isArray(bars) && bars.length > 0, "Bar registry must contain at least one bar.");

  const slots = new Set();
  const rootIds = new Set();
  const templates = new Set();

  for (const bar of bars) {
    assert(typeof bar.slot === "string" && bar.slot, "Every bar needs a slot.");
    assert(typeof bar.rootId === "string" && bar.rootId, bar.slot + " is missing rootId.");
    assert(typeof bar.template === "string" && bar.template, bar.slot + " is missing template.");
    assert(typeof bar.styleEntry === "string" && bar.styleEntry, bar.slot + " is missing styleEntry.");
    assert(Array.isArray(bar.behaviorOwners), bar.slot + " behaviorOwners must be an array.");

    assert(!slots.has(bar.slot), "Duplicate bar slot: " + bar.slot);
    assert(!rootIds.has(bar.rootId), "Duplicate bar rootId: " + bar.rootId);
    assert(!templates.has(bar.template), "Duplicate bar template: " + bar.template);
    slots.add(bar.slot);
    rootIds.add(bar.rootId);
    templates.add(bar.template);

    assert(existsSync(resolve(repositoryRoot, bar.template)), "Missing bar template: " + bar.template);
    assert(bar.styleEntry.startsWith("css/components/"), bar.slot + " CSS must remain in a component colony.");
    assert(existsSync(resolve(repositoryRoot, bar.styleEntry)), "Missing bar CSS owner: " + bar.styleEntry);

    for (const owner of bar.behaviorOwners) {
      assert(
        owner.startsWith("js/components/") || owner.startsWith("js/ui/"),
        bar.slot + " behavior must remain in the current component/UI architecture: " + owner
      );
      assert(existsSync(resolve(repositoryRoot, owner)), "Missing bar behavior owner: " + owner);
    }
  }

  assert(!existsSync(resolve(repositoryRoot, "js/bars")), "Legacy js/bars must not return; bar behavior belongs to current component owners.");
  return bars;
}

function indentPartial(source, indentation) {
  return source.trim().split("\n").map((line) => line ? indentation + line : "").join("\n");
}

function renderRequiredPartials(frame) {
  let output = frame;

  for (const partial of requiredPartials) {
    const marker = new RegExp("^([ \\t]*)<!-- @partial " + partial.slot + " -->[ \\t]*$", "m");
    const matches = [...output.matchAll(new RegExp(marker.source, "gm"))];
    assert(matches.length === 1, "Expected exactly one required main-frame partial for " + partial.slot + ".");

    const templatePath = resolve(repositoryRoot, partial.template);
    assert(existsSync(templatePath), "Missing required main-frame partial: " + partial.template);
    output = output.replace(marker, (_, indentation) => indentPartial(readFileSync(templatePath, "utf8"), indentation));
  }

  assert(!/<!-- @partial /.test(output), "Unresolved required main-frame partial remains.");
  return output;
}

function renderOptionalPartials(frame) {
  let output = frame;

  for (const optional of optionalPartials) {
    const marker = new RegExp("^([ \\t]*)<!-- @optional " + optional.slot + " -->[ \\t]*$", "m");
    const matches = [...output.matchAll(new RegExp(marker.source, "gm"))];
    assert(matches.length === 1, "Expected exactly one optional main-frame slot for " + optional.slot + ".");

    const templatePath = resolve(repositoryRoot, optional.template);
    output = output.replace(marker, (_, indentation) => {
      if (!existsSync(templatePath)) return "";
      return indentPartial(readFileSync(templatePath, "utf8"), indentation);
    });
  }

  assert(!/<!-- @optional /.test(output), "Unresolved optional main-frame slot remains.");
  return output;
}

export function renderMainFrame() {
  const bars = readRegistry();
  let frame = renderRequiredPartials(readFileSync(framePath, "utf8"));
  frame = renderOptionalPartials(frame);

  for (const bar of bars) {
    const marker = new RegExp("^([ \\t]*)<!-- @bar " + bar.slot + " -->[ \\t]*$", "m");
    const matches = [...frame.matchAll(new RegExp(marker.source, "gm"))];
    assert(matches.length === 1, "Expected exactly one main-frame slot for " + bar.slot + ".");

    const partial = readFileSync(resolve(repositoryRoot, bar.template), "utf8");
    assert(partial.includes('id="' + bar.rootId + '"'), bar.template + " is missing root #" + bar.rootId + ".");
    assert(partial.includes('data-ui-bar="' + bar.slot + '"'), bar.template + " is missing data-ui-bar=\"" + bar.slot + "\".");

    frame = frame.replace(marker, (_, indentation) => indentPartial(partial, indentation));
  }

  assert(!/<!-- @bar /.test(frame), "Unresolved main-frame bar slot remains.");
  return frame.endsWith("\n") ? frame : frame + "\n";
}

export function buildMainFrame() {
  const output = renderMainFrame();
  writeFileSync(outputPath, output);
  return output;
}

export function checkMainFrame() {
  const expected = renderMainFrame();
  const actual = readFileSync(outputPath, "utf8");
  assert(actual === expected, "index.html is stale. Run npm run build:frame.");
  return expected;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes("--check")) {
    checkMainFrame();
    console.log("Main frame is synchronized with registered bars and reusable partials.");
  } else {
    const output = buildMainFrame();
    console.log("Built index.html from ui/main-frame.html, reusable partials and " + readRegistry().length + " registered bar partials (" + output.length + " bytes).");
  }
}
