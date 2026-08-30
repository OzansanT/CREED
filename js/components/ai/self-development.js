import { applyAIPatch, normalizeAIPatch } from "./ai-patch.js";
import { createTaskDag } from "./task-dag.js";
import { runVerifyRepairLoop } from "./verify-repair-loop.js";

function slugify(value) {
  const slug = String(value || "change").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 36);
  return slug || "change";
}

export function selectDevelopmentIssue(problems = []) {
  const rank = { error: 0, warning: 1, info: 2 };
  const candidates = [...problems].filter((problem) => problem && problem.message);
  candidates.sort((a, b) => (rank[a.severity] ?? 3) - (rank[b.severity] ?? 3) || String(a.fileName || "").localeCompare(String(b.fileName || "")));
  return candidates[0] ? { ...candidates[0] } : null;
}

export function createSelfDevelopmentWorkflow({
  workspace,
  sourceControlProvider,
  diagnostics,
  openPullRequest,
  now = () => Date.now()
} = {}) {
  if (!workspace || !sourceControlProvider?.getCurrentBranch || !diagnostics?.runChecks) {
    throw new TypeError("Self-development requires workspace, Source Control provider, and diagnostics.");
  }

  async function ensureCleanBase() {
    if (sourceControlProvider.getStaged().length) throw new Error("Self-development requires an unstaged base branch.");
    const working = await sourceControlProvider.getWorkingChanges();
    if (working.length) throw new Error("Self-development requires a clean working tree before creating its isolated branch.");
    return sourceControlProvider.getCurrentBranch();
  }

  async function detectIssue() {
    await diagnostics.runChecks({ reveal: false });
    return selectDevelopmentIssue(diagnostics.model?.list?.() || []);
  }

  async function execute({
    issue = null,
    patch,
    approved = false,
    title = "CREED self-development change",
    repairPatch,
    maxAttempts = 3
  } = {}) {
    if (!approved) throw new Error("Self-development requires explicit patch approval before branch mutation.");
    const normalizedPatch = normalizeAIPatch(patch);
    const detectedIssue = issue || await detectIssue();
    const baseBranch = await ensureCleanBase();
    const branchName = `agent/${slugify(detectedIssue?.code || detectedIssue?.message || title)}-${Math.max(0, Math.trunc(now())).toString(36)}`;
    if (branchName === "main" || baseBranch === branchName) throw new Error("Self-development cannot target main directly.");

    const runState = { branchName, baseBranch, issue: detectedIssue, patch: normalizedPatch, verification: null, commit: null };

    const dag = createTaskDag([
      {
        id: "branch",
        dependencies: [],
        run: async () => {
          sourceControlProvider.createBranch(branchName);
          await sourceControlProvider.switchBranch(branchName);
          if (sourceControlProvider.getCurrentBranch() === "main") throw new Error("Main branch protection failed.");
          return branchName;
        }
      },
      {
        id: "edit-verify-repair",
        dependencies: ["branch"],
        run: async () => {
          const loop = await runVerifyRepairLoop({
            maxAttempts,
            context: runState,
            edit: async () => applyAIPatch(normalizedPatch, workspace, { approved: true }),
            verify: async () => {
              const result = await diagnostics.runChecks({ reveal: false });
              return { passed: (result.counts?.error || 0) === 0, ...result };
            },
            repair: typeof repairPatch === "function" ? async ({ verification, attempt }) => {
              const nextPatch = await repairPatch({ issue: detectedIssue, verification, attempt, branchName });
              if (!nextPatch) return null;
              return applyAIPatch(nextPatch, workspace, { approved: true });
            } : undefined
          });
          runState.verification = loop;
          if (!loop.passed) throw new Error("Self-development verification failed; branch was not committed.");
          return loop;
        }
      },
      {
        id: "commit",
        dependencies: ["edit-verify-repair"],
        run: async () => {
          const changes = await sourceControlProvider.getWorkingChanges();
          if (!changes.length) throw new Error("Self-development produced no workspace changes.");
          for (const change of changes) await sourceControlProvider.stage(change.path);
          runState.commit = await sourceControlProvider.commit(title);
          return runState.commit;
        }
      },
      {
        id: "review",
        dependencies: ["commit"],
        run: async () => {
          const pullRequestProposal = {
            title,
            body: [
              "CREED self-development proposal.",
              `Issue: ${detectedIssue?.message || "user-requested improvement"}`,
              `Verification: ${runState.verification?.passed ? "passed" : "failed"}`
            ].join("\n\n"),
            base: baseBranch,
            head: branchName,
            commit: runState.commit?.id || null,
            status: "ready-for-review"
          };
          const pullRequest = typeof openPullRequest === "function"
            ? await openPullRequest(pullRequestProposal)
            : null;
          return { pullRequestProposal, pullRequest };
        }
      }
    ]);

    try {
      const result = await dag.execute(runState);
      const review = result.results.review;
      return Object.freeze({
        issue: detectedIssue,
        baseBranch,
        branch: branchName,
        commit: runState.commit,
        verification: runState.verification,
        pullRequestProposal: review.pullRequestProposal,
        pullRequest: review.pullRequest,
        tasks: result.events
      });
    } catch (error) {
      if (sourceControlProvider.getCurrentBranch() === "main") {
        throw new Error("Self-development aborted: main branch protection invariant was violated.", { cause: error });
      }
      throw error;
    }
  }

  return Object.freeze({ detectIssue, execute, ensureCleanBase });
}
