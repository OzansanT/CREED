import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isActionableOrphanDiagnostic } from "../js/components/diagnostics/diagnostics-main.js";
import { runWorkspaceDiagnostics } from "../js/components/diagnostics/diagnostics-model.js";
import { WORKSPACE_FILES } from "../js/components/editor-panel/source-files.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workspace = {
  listFiles: () => [...WORKSPACE_FILES],
  readFile: async (path) => readFileSync(resolve(root, path), "utf8")
};

const result = await runWorkspaceDiagnostics({ workspace });
const problems = result.problems.filter((problem) => problem.code !== "ORPHAN" || isActionableOrphanDiagnostic(problem));

if (!problems.length) {
  console.log("Current Problems audit passed: 0 errors, 0 warnings.");
  process.exit(0);
}

for (const problem of problems) {
  const location = problem.fileName
    ? ` ${problem.fileName}:${problem.line + 1}:${problem.column + 1}`
    : "";
  console.error(`${problem.severity.toUpperCase()} ${problem.code}${location} — ${problem.message}`);
}

const counts = problems.reduce((value, problem) => {
  value[problem.severity] = (value[problem.severity] || 0) + 1;
  return value;
}, { error: 0, warning: 0, info: 0 });

throw new Error(`Current Problems audit failed: ${counts.error} error(s), ${counts.warning} warning(s), ${counts.info} info.`);
