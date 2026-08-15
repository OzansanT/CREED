import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createCreedDocument } from "../creed-document.js";
import { createExtensionHost } from "../extension-host.js";
import { buildHtmlExport } from "../export-engine.js";
import { buildWorkspacePreview } from "../preview-runner.js";
import { safeClassToken, safeDownloadName, safeMimeType, sanitizeCssValue, sanitizeUrl } from "../security.js";
import { createWorkspaceStore } from "../workspace-store.js";

test("sanitizers reject executable URLs, CSS injection and unsafe filenames", () => {
  assert.equal(sanitizeUrl("javascript:alert(1)"), "#");
  assert.equal(sanitizeUrl("data:image/svg+xml,<svg/>", { image: true }), "");
  assert.equal(sanitizeUrl("https://example.com/image.png", { image: true }), "https://example.com/image.png");
  assert.equal(sanitizeCssValue("color", "red;position:fixed"), "");
  assert.equal(sanitizeCssValue("unknown", "red"), "");
  assert.match(safeClassToken("unsafe id}"), /-20-/);
  assert.doesNotMatch(safeDownloadName("../bad?.txt"), /[?./]{2}/);
  assert.equal(safeMimeType("text/html<script>"), "application/octet-stream");
});

test("HTML export escapes content and sanitizes identifiers and style values", () => {
  const document = createCreedDocument();
  document.title = "<Unsafe>";
  document.components.push({
    id: "bad}body{display:none",
    type: "text",
    name: "Unsafe",
    visible: true,
    locked: false,
    x: 0,
    y: 0,
    width: 100,
    height: 50,
    rotation: 0,
    z: 4,
    parentId: null,
    styles: { desktop: { color: "red;position:fixed" }, tablet: {}, mobile: {} },
    props: { text: "<script>alert(1)</script>" }
  });
  const html = buildHtmlExport(document);
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(!html.includes("<script>alert"));
  assert.ok(!html.includes("position:fixed"));
  assert.ok(!html.includes(".creed-id-bad}"));
});

test("workspace trust gates non-built-in extension activation and execution", async () => {
  let trusted = false;
  const host = createExtensionHost({ isTrusted: () => trusted });
  await assert.rejects(host.registerExtension({ id: "external.one", builtIn: false, activate() {} }), /Trust/);
  trusted = true;
  await host.registerExtension({
    id: "external.one",
    name: "External",
    builtIn: false,
    activate(api) { api.commands.register("external.run", "Run", () => 9); }
  });
  assert.equal(host.executeCommand("external.run"), 9);
  trusted = false;
  assert.throws(() => host.executeCommand("external.run"), /Restricted Mode/);
});

test("preview compilation replaces parent CSP and remaps modules into its sandbox", async () => {
  const localImport = "import { value } from " + "'./value.js'; console.log(value);";
  const seed = {
    "index.html": fs.readFileSync(new URL("../index.html", import.meta.url), "utf8"),
    "main.js": localImport,
    "value.js": "export const value = 1;",
    "app.css": "body { color: red; }"
  };
  seed["index.html"] = seed["index.html"].replace(/<link\b[^>]*rel="stylesheet"[^>]*>/gi, "<link rel=\"stylesheet\" href=\"./app.css\">");
  const store = createWorkspaceStore({ fileNames: Object.keys(seed), loadSource: async (file) => seed[file] });
  const preview = await buildWorkspacePreview(store, { baseUrl: "http://localhost:8000/index.html" });
  assert.equal((preview.html.match(/Content-Security-Policy/g) || []).length, 1);
  assert.ok(preview.html.includes("script-src data:"));
  assert.ok(preview.html.includes("creed:main.js"));
  assert.ok(preview.html.includes("creed:value.js"));
  assert.ok(preview.html.includes("body { color: red; }"));
});
