import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WORKSPACE_FILES } from "../source-files.js";

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("PWA metadata and CSP expose the required security/offline contracts", () => {
  const html = fs.readFileSync(path.join(repository, "index.html"), "utf8");
  const manifest = JSON.parse(fs.readFileSync(path.join(repository, "manifest.webmanifest"), "utf8"));
  assert.equal(manifest.display, "standalone");
  assert.ok(manifest.start_url.includes("#canvas"));
  assert.ok(manifest.icons.every((icon) => fs.existsSync(path.resolve(repository, icon.src))));
  const csp = html.match(/Content-Security-Policy" content="([^"]+)/)?.[1] || "";
  for (const directive of ["default-src 'self'", "object-src 'none'", "base-uri 'self'", "worker-src 'self'"]) assert.ok(csp.includes(directive));
  assert.match(fs.readFileSync(path.join(repository, "pwa-input.js"), "utf8"), /serviceWorker\.register/);
});

test("service worker app shell derives from the authoritative file inventory", async () => {
  globalThis.self = { addEventListener() {}, location: { origin: "http://localhost" }, skipWaiting() {}, clients: { claim() {} } };
  const worker = await import(`../service-worker.js?test=${Date.now()}`);
  assert.ok(worker.APP_SHELL.includes("./index.html"));
  for (const file of WORKSPACE_FILES) assert.ok(worker.APP_SHELL.includes("./" + file));
  assert.match(worker.CACHE_VERSION, /^creed-shell-v\d+$/);
});

test("static controls have names and external blank links are isolated", () => {
  const html = fs.readFileSync(path.join(repository, "index.html"), "utf8");
  for (const match of html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)) {
    const attributes = match[1];
    const text = match[2].replace(/<[^>]+>/g, "").trim();
    assert.ok(text || /aria-label=|title=/.test(attributes), `Unnamed button: ${match[0].slice(0, 80)}`);
  }
  for (const match of html.matchAll(/<a\b([^>]*)>/g)) {
    if (/target="_blank"/.test(match[1])) assert.match(match[1], /rel="[^"]*noreferrer/);
  }
});
