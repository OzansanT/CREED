import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WORKSPACE_FILES } from "../source-files.js";

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mime = new Map([
  [".css", "text/css"], [".html", "text/html"], [".js", "text/javascript"], [".mjs", "text/javascript"],
  [".json", "application/json"], [".md", "text/markdown"], [".svg", "image/svg+xml"], [".webmanifest", "application/manifest+json"]
]);

const server = http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
  const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const file = path.resolve(repository, relative);
  if (!file.startsWith(repository + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    response.writeHead(404).end("Not found");
    return;
  }
  response.setHeader("Content-Type", mime.get(path.extname(file)) || "text/plain");
  fs.createReadStream(file).pipe(response);
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
try {
  const { port } = server.address();
  const origin = `http://127.0.0.1:${port}`;
  const results = await Promise.all(["index.html", ...WORKSPACE_FILES].map(async (file) => {
    const response = await fetch(`${origin}/${file.split("/").map(encodeURIComponent).join("/")}`);
    return { file, status: response.status, length: (await response.arrayBuffer()).byteLength };
  }));
  const failures = results.filter((result) => result.status !== 200 || result.length === 0);
  assert.deepEqual(failures, [], `HTTP smoke failures: ${JSON.stringify(failures)}`);
  console.log(`HTTP smoke passed: ${results.length} assets.`);
} finally {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}
