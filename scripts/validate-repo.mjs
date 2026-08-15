import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WORKSPACE_FILES } from "../source-files.js";

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function walk(directory = repository, prefix = "") {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === ".git" || entry.name === "node_modules" || entry.name === "coverage") return [];
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    return entry.isDirectory() ? walk(path.join(directory, entry.name), relative) : [relative];
  }).sort();
}

function parseReadmeTree(markdown) {
  const block = markdown.match(/## Repository tree\s+```text\n([\s\S]*?)```/)?.[1];
  assert.ok(block, "README Repository tree block is missing");
  const stack = [];
  const files = [];
  for (const line of block.split("\n")) {
    const match = line.match(/^((?:│   |    )*)(?:├── |└── )(.+)$/);
    if (!match) continue;
    const depth = match[1].length / 4;
    const name = match[2];
    if (name.endsWith("/")) {
      stack[depth] = name.slice(0, -1);
      stack.length = depth + 1;
    } else {
      files.push([...stack.slice(0, depth), name].join("/"));
    }
  }
  return files.sort();
}

function relativeImports(source) {
  return [...source.matchAll(/(?:from\s*|import\s*)["'](\.\.?\/[^"']+)["']/g)].map((match) => match[1]);
}

const actualFiles = walk();
assert.deepEqual(WORKSPACE_FILES, actualFiles, "WORKSPACE_FILES must exactly match the recursive repository inventory");
assert.deepEqual([...WORKSPACE_FILES].sort(), WORKSPACE_FILES, "WORKSPACE_FILES must remain sorted");

const scriptFiles = actualFiles.filter((file) => /\.(?:js|mjs)$/.test(file));
for (const file of scriptFiles) {
  execFileSync(process.execPath, ["--check", path.join(repository, file)], { stdio: "pipe" });
  const source = fs.readFileSync(path.join(repository, file), "utf8");
  for (const specifier of relativeImports(source)) {
    const target = path.normalize(path.join(path.dirname(file), specifier));
    assert.ok(fs.existsSync(path.join(repository, target)), `${file} imports missing ${target}`);
  }
  assert.doesNotMatch(source, /[?&]v=\d{6,}/, `${file} uses a manual cache-busting query version`);
}

const runtimeGraph = new Map();
for (const file of actualFiles.filter((candidate) => candidate.endsWith(".js"))) {
  const source = fs.readFileSync(path.join(repository, file), "utf8");
  runtimeGraph.set(file, relativeImports(source).map((specifier) => path.normalize(path.join(path.dirname(file), specifier))));
}
const reachable = new Set();
function visit(file) {
  if (reachable.has(file)) return;
  reachable.add(file);
  (runtimeGraph.get(file) || []).forEach(visit);
}
visit("main.js");
visit("service-worker.js");
const orphanRuntime = actualFiles.filter((file) => file.endsWith(".js") && !reachable.has(file));
assert.deepEqual(orphanRuntime, [], `Orphan runtime modules: ${orphanRuntime.join(", ")}`);

const html = fs.readFileSync(path.join(repository, "index.html"), "utf8");
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
assert.equal(ids.length, new Set(ids).size, "index.html contains duplicate IDs");
for (const reference of [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map((match) => match[1]).filter((value) => value.startsWith("./"))) {
  assert.ok(fs.existsSync(path.join(repository, reference)), `index.html references missing ${reference}`);
}
const elementBindings = [...fs.readFileSync(path.join(repository, "elements.js"), "utf8").matchAll(/getElementById\("([^"]+)"\)/g)].map((match) => match[1]);
assert.deepEqual(elementBindings.filter((id) => !ids.includes(id)), [], "elements.js binds missing IDs");
assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)/i, "index.html contains an inline script");
assert.doesNotMatch(html, /\son[a-z]+=/i, "index.html contains an inline event handler");
const csp = html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)?.[1] || "";
for (const directive of ["default-src 'self'", "object-src 'none'", "base-uri 'self'", "worker-src 'self'"]) {
  assert.ok(csp.includes(directive), `CSP is missing ${directive}`);
}

const linkedCss = [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="\.\/([^"]+)"/g)].map((match) => match[1]).sort();
const rootCss = actualFiles.filter((file) => !file.includes("/") && file.endsWith(".css")).sort();
assert.deepEqual(linkedCss, rootCss, "Every CSS colony must be linked exactly once");
assert.deepEqual(parseReadmeTree(fs.readFileSync(path.join(repository, "README.md"), "utf8")), actualFiles, "README tree must match the repository");

const manifest = JSON.parse(fs.readFileSync(path.join(repository, "manifest.webmanifest"), "utf8"));
assert.equal(manifest.display, "standalone");
assert.ok(manifest.icons?.length, "PWA manifest needs an icon");
for (const icon of manifest.icons) assert.ok(fs.existsSync(path.join(repository, icon.src)), `Missing PWA icon ${icon.src}`);

console.log(`Repository validation passed: ${actualFiles.length} files, ${scriptFiles.length} scripts, ${rootCss.length} CSS colonies.`);
