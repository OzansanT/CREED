import {
  createProblemsModel,
  findArchitectureViolations,
  findDependencyCycles,
  findOrphanModules,
  parseCheckOutput,
  runWorkspaceDiagnostics
} from "./diagnostics-model.js";
import { createPerformanceProfiler } from "./performance-profiler.js";
import { buildSystemGraph } from "../infinite-canvas/system-graph-model.js";

const DEFAULT_ACTIONS_URL = "https://api.github.com/repos/OzansanT/CREED/actions/runs?per_page=1";

function style(element, values) {
  Object.assign(element.style, values);
  return element;
}

function makeButton(label) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  return button;
}

export function bindDiagnostics({
  problemsView,
  workspace,
  systemGraph,
  openFile,
  showBottomView,
  notify,
  fetchImpl = typeof fetch === "function" ? fetch.bind(globalThis) : null
} = {}) {
  if (!problemsView || !workspace) throw new TypeError("Diagnostics require the Problems view and workspace.");
  const model = createProblemsModel();
  const profiler = createPerformanceProfiler();

  const root = style(document.createElement("div"), { display: "grid", gap: "10px", height: "100%", overflow: "auto" });
  const toolbar = style(document.createElement("div"), { display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" });
  const runChecksButton = makeButton("Run npm check");
  runChecksButton.id = "runWorkspaceChecksBtn";
  const actionsButton = makeButton("Refresh Actions");
  actionsButton.id = "refreshActionsStatusBtn";
  const summary = document.createElement("strong");
  summary.id = "problemsSummary";
  const actionsStatus = document.createElement("span");
  actionsStatus.id = "githubActionsStatus";
  toolbar.append(runChecksButton, actionsButton, summary, actionsStatus);

  const problemsList = style(document.createElement("div"), { display: "grid", gap: "3px" });
  problemsList.id = "problemsList";
  problemsList.setAttribute("aria-live", "polite");

  const testsSection = document.createElement("section");
  const testsHeading = document.createElement("h3");
  testsHeading.textContent = "Test Explorer";
  const testsList = style(document.createElement("div"), { display: "grid", gap: "4px" });
  testsList.id = "diagnosticsTestExplorer";
  testsSection.append(testsHeading, testsList);

  const profilerSection = document.createElement("section");
  const profilerHeading = document.createElement("h3");
  profilerHeading.textContent = "Performance Profiler";
  const profilerList = style(document.createElement("div"), { display: "grid", gap: "2px" });
  profilerList.id = "performanceProfilerResults";
  profilerSection.append(profilerHeading, profilerList);
  root.append(toolbar, problemsList, testsSection, profilerSection);
  problemsView.replaceChildren(root);

  function renderProblems() {
    const problems = model.list();
    const counts = model.counts();
    summary.textContent = `${counts.error} errors · ${counts.warning} warnings · ${counts.info} info`;
    const fragment = document.createDocumentFragment();
    if (!problems.length) {
      const empty = document.createElement("div");
      empty.textContent = "No Problems detected.";
      fragment.append(empty);
    }
    for (const problem of problems) {
      const row = makeButton("");
      row.className = "diagnostic-row";
      style(row, { textAlign: "left", padding: "5px 7px", display: "grid", gridTemplateColumns: "80px 1fr auto", gap: "8px", alignItems: "center" });
      const severity = document.createElement("strong");
      severity.textContent = problem.severity.toUpperCase();
      const message = document.createElement("span");
      message.textContent = `${problem.message}${problem.fileName ? ` — ${problem.fileName}:${problem.line + 1}:${problem.column + 1}` : ""}`;
      const code = document.createElement("code");
      code.textContent = problem.code;
      row.append(severity, message, code);
      row.disabled = !problem.fileName;
      row.addEventListener("click", () => { if (problem.fileName) openFile?.(problem.fileName); });
      fragment.append(row);
    }
    problemsList.replaceChildren(fragment);
    systemGraph?.setDiagnostics?.(problems);
  }

  function renderProfiler() {
    const fragment = document.createDocumentFragment();
    const entries = profiler.summary();
    if (!entries.length) {
      const empty = document.createElement("span");
      empty.textContent = "No measurements yet.";
      fragment.append(empty);
    }
    for (const item of entries) {
      const row = document.createElement("div");
      row.textContent = `${item.label}: ${item.last.toFixed(1)} ms · avg ${item.average.toFixed(1)} ms · n=${item.count}`;
      fragment.append(row);
    }
    profilerList.replaceChildren(fragment);
  }

  async function currentGraph() {
    const existing = systemGraph?.getGraph?.();
    if (existing?.nodes?.length) return existing;
    return buildSystemGraph({ workspace });
  }

  async function runChecks({ output = "", reveal = true } = {}) {
    const result = await profiler.measure("workspace diagnostics", () => runWorkspaceDiagnostics({ workspace, graph: systemGraph?.getGraph?.() }));
    model.setSource("architecture", result.architecture);
    model.setSource("dependency-cycles", result.cycles);
    model.setSource("orphan-modules", result.orphans);
    if (output) model.setSource("npm-check", parseCheckOutput(output));
    if (reveal) {
      showBottomView?.("problems");
      notify?.(`npm check completed: ${model.list().length} problem(s)`);
    }
    renderProfiler();
    return { problems: model.list(), counts: model.counts() };
  }

  const tests = [
    {
      id: "architecture",
      label: "Architecture rules",
      run: async () => {
        const diagnostics = await findArchitectureViolations(workspace);
        model.setSource("architecture", diagnostics);
        return diagnostics;
      }
    },
    {
      id: "dependency-cycles",
      label: "Dependency cycles",
      run: async () => {
        const diagnostics = findDependencyCycles(await currentGraph());
        model.setSource("dependency-cycles", diagnostics);
        return diagnostics;
      }
    },
    {
      id: "orphan-modules",
      label: "Orphan modules",
      run: async () => {
        const diagnostics = findOrphanModules(await currentGraph());
        model.setSource("orphan-modules", diagnostics);
        return diagnostics;
      }
    },
    {
      id: "workspace-integrity",
      label: "Workspace integrity",
      run: async () => (await runChecks({ reveal: false })).problems
    }
  ];

  async function runTest(id) {
    const test = tests.find((item) => item.id === id);
    if (!test) throw new Error(`Unknown diagnostic test: ${id}`);
    const diagnostics = await profiler.measure(`test:${test.id}`, test.run);
    renderProfiler();
    notify?.(`${test.label}: ${diagnostics.length ? `${diagnostics.length} issue(s)` : "passed"}`);
    return diagnostics;
  }

  function renderTests() {
    const fragment = document.createDocumentFragment();
    for (const test of tests) {
      const row = style(document.createElement("div"), { display: "flex", gap: "6px", alignItems: "center" });
      const label = document.createElement("span");
      label.textContent = test.label;
      style(label, { flex: "1" });
      const run = makeButton("Run");
      run.dataset.testId = test.id;
      run.addEventListener("click", () => runTest(test.id).catch((error) => notify?.(error instanceof Error ? error.message : String(error))));
      row.append(label, run);
      fragment.append(row);
    }
    testsList.replaceChildren(fragment);
  }

  async function refreshActionsStatus() {
    if (!fetchImpl) {
      actionsStatus.textContent = "Actions unavailable";
      return null;
    }
    actionsStatus.textContent = "Actions: loading…";
    return profiler.measure("github actions status", async () => {
      const response = await fetchImpl(DEFAULT_ACTIONS_URL, { headers: { Accept: "application/vnd.github+json" } });
      if (!response.ok) throw new Error(`GitHub Actions status failed (${response.status})`);
      const payload = await response.json();
      const run = payload.workflow_runs?.[0];
      if (!run) {
        actionsStatus.textContent = "Actions: no runs";
        return null;
      }
      actionsStatus.textContent = `Actions #${run.run_number}: ${run.conclusion || run.status}`;
      return run;
    }).finally(renderProfiler);
  }

  model.subscribe(renderProblems);
  profiler.subscribe(() => renderProfiler());
  runChecksButton.addEventListener("click", () => runChecks().catch((error) => notify?.(error instanceof Error ? error.message : String(error))));
  actionsButton.addEventListener("click", () => refreshActionsStatus().catch((error) => {
    actionsStatus.textContent = "Actions: unavailable";
    notify?.(error instanceof Error ? error.message : String(error));
  }));
  renderTests();
  renderProblems();
  renderProfiler();

  return Object.freeze({
    model,
    profiler,
    runChecks,
    runTest,
    refreshActionsStatus,
    ingestCheckOutput(text) {
      model.setSource("npm-check", parseCheckOutput(text));
      showBottomView?.("problems");
      return model.list();
    }
  });
}
