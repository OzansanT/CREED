import { GIT_WORKSPACE_STORAGE_KEY } from "../../core/config.js";
import { WORKSPACE_FILES } from "../editor-panel/source-files.js";

const GIT_SCHEMA_VERSION = 1;

function createMemoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key)
  };
}

function getDefaultStorage() {
  return typeof localStorage === "undefined" ? createMemoryStorage() : localStorage;
}

async function defaultReadBaseline(fileName, { signal } = {}) {
  const filePath = fileName.split("/").map(encodeURIComponent).join("/");
  const response = await fetch("./" + filePath, { cache: "no-store", signal });
  if (!response.ok) throw new Error("Unable to load repository baseline " + fileName + " (" + response.status + ")");
  return response.text();
}

function cloneTree(tree = {}) {
  return Object.fromEntries(Object.entries(tree).map(([path, value]) => [path, value]));
}

function normalizeBranchName(value) {
  const name = String(value ?? "").trim();
  if (!name || !/^[A-Za-z0-9._/-]+$/.test(name) || name.startsWith("/") || name.endsWith("/") || name.includes("..")) {
    throw new Error("Invalid branch name.");
  }
  return name;
}

function normalizeState(value) {
  if (!value || typeof value !== "object" || value.version !== GIT_SCHEMA_VERSION) {
    return {
      version: GIT_SCHEMA_VERSION,
      currentBranch: "main",
      branches: {
        main: { head: null, tree: {}, baseTree: {} }
      },
      commits: [],
      staged: {}
    };
  }
  const branches = {};
  for (const [rawName, rawBranch] of Object.entries(value.branches || {})) {
    let name;
    try { name = normalizeBranchName(rawName); } catch { continue; }
    const branch = rawBranch && typeof rawBranch === "object" ? rawBranch : {};
    branches[name] = {
      head: typeof branch.head === "string" ? branch.head : null,
      tree: cloneTree(branch.tree),
      baseTree: cloneTree(branch.baseTree)
    };
  }
  if (!branches.main) branches.main = { head: null, tree: {}, baseTree: {} };
  const currentBranch = branches[value.currentBranch] ? value.currentBranch : "main";
  const commits = Array.isArray(value.commits)
    ? value.commits.filter((commit) => commit && typeof commit.id === "string" && typeof commit.message === "string")
      .map((commit) => ({
        id: commit.id,
        parent: typeof commit.parent === "string" ? commit.parent : null,
        branch: typeof commit.branch === "string" ? commit.branch : "main",
        message: commit.message,
        timestamp: Number(commit.timestamp) || 0,
        changes: Array.isArray(commit.changes) ? commit.changes.map((change) => ({ ...change })) : []
      }))
    : [];
  const staged = {};
  for (const [path, change] of Object.entries(value.staged || {})) {
    if (!change || typeof change !== "object" || !["modified", "created", "deleted"].includes(change.status)) continue;
    staged[path] = {
      path,
      status: change.status,
      ...(change.status === "deleted" ? {} : { content: String(change.content ?? "") })
    };
  }
  return { version: GIT_SCHEMA_VERSION, currentBranch, branches, commits, staged };
}

function own(tree, path) {
  return Object.prototype.hasOwnProperty.call(tree, path);
}

export function createGitProvider({
  workspace,
  baseFiles = WORKSPACE_FILES,
  readBaseline = defaultReadBaseline,
  storage = getDefaultStorage(),
  now = () => Date.now(),
  random = () => Math.random()
} = {}) {
  if (!workspace?.getChanges || !workspace?.readFile || !workspace?.listFiles) {
    throw new TypeError("Git provider requires the writable workspace file-system.");
  }
  const baseSet = new Set(baseFiles);
  const listeners = new Set();
  let state;
  try {
    state = normalizeState(JSON.parse(storage.getItem(GIT_WORKSPACE_STORAGE_KEY)));
  } catch {
    state = normalizeState(null);
  }

  function persist() {
    try {
      storage.setItem(GIT_WORKSPACE_STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch {
      return false;
    }
  }

  function emit(type, detail = {}) {
    const snapshot = Object.freeze({ type, ...detail, branch: state.currentBranch });
    listeners.forEach((listener) => listener(snapshot));
  }

  function currentBranchRecord() {
    return state.branches[state.currentBranch];
  }

  async function readTreeContent(tree, path) {
    if (own(tree, path)) return tree[path];
    if (!baseSet.has(path)) return null;
    try {
      return await readBaseline(path);
    } catch {
      return null;
    }
  }

  async function getHeadContent(path) {
    return readTreeContent(currentBranchRecord().tree, path);
  }

  async function getWorkingChanges() {
    const rawChanges = new Map(workspace.getChanges().map((change) => [change.path, change]));
    const tree = currentBranchRecord().tree;
    const candidates = new Set([...rawChanges.keys(), ...Object.keys(tree)]);
    const changes = [];

    for (const path of [...candidates].sort((left, right) => left.localeCompare(right))) {
      if (own(tree, path)) {
        const headContent = tree[path];
        const exists = workspace.hasFile(path);
        if (headContent === null) {
          if (!exists) continue;
          changes.push({ path, status: "created", content: await workspace.readFile(path) });
          continue;
        }
        if (!exists) {
          changes.push({ path, status: "deleted" });
          continue;
        }
        const content = await workspace.readFile(path);
        if (content !== headContent) changes.push({ path, status: "modified", content });
        continue;
      }

      const raw = rawChanges.get(path);
      if (!raw) continue;
      changes.push({
        path,
        status: raw.status,
        ...(raw.status === "deleted" ? {} : { content: raw.content ?? await workspace.readFile(path) })
      });
    }
    return changes;
  }

  async function stage(path) {
    const change = (await getWorkingChanges()).find((candidate) => candidate.path === path);
    if (!change) throw new Error("No working-tree change for " + path);
    state.staged[path] = {
      path,
      status: change.status,
      ...(change.status === "deleted" ? {} : { content: change.content ?? await workspace.readFile(path) })
    };
    persist();
    emit("staged", { path });
    return { ...state.staged[path] };
  }

  function unstage(path) {
    if (!state.staged[path]) return false;
    delete state.staged[path];
    persist();
    emit("unstaged", { path });
    return true;
  }

  function getStaged() {
    return Object.values(state.staged).sort((left, right) => left.path.localeCompare(right.path)).map((change) => ({ ...change }));
  }

  function createCommitId() {
    const time = Math.max(0, Math.trunc(now())).toString(36);
    const entropy = Math.floor(Math.max(0, Math.min(0.999999999, random())) * 0xffffffff).toString(36);
    return `${time}-${entropy}`;
  }

  async function commit(message) {
    const summary = String(message ?? "").trim();
    if (!summary) throw new Error("Commit message cannot be empty.");
    const staged = getStaged();
    if (!staged.length) throw new Error("Nothing staged to commit.");

    const branch = currentBranchRecord();
    const nextTree = cloneTree(branch.tree);
    for (const change of staged) {
      nextTree[change.path] = change.status === "deleted" ? null : String(change.content ?? "");
    }
    const record = {
      id: createCommitId(),
      parent: branch.head,
      branch: state.currentBranch,
      message: summary,
      timestamp: now(),
      changes: staged.map((change) => ({ path: change.path, status: change.status }))
    };
    branch.tree = nextTree;
    branch.head = record.id;
    state.commits.push(record);
    state.staged = {};
    persist();
    emit("committed", { commit: { ...record } });
    return { ...record };
  }

  function createBranch(rawName) {
    const name = normalizeBranchName(rawName);
    if (state.branches[name]) throw new Error("Branch already exists: " + name);
    const source = currentBranchRecord();
    state.branches[name] = {
      head: source.head,
      tree: cloneTree(source.tree),
      baseTree: cloneTree(source.tree)
    };
    persist();
    emit("branch-created", { name });
    return name;
  }

  async function applyBranchTree(branch) {
    workspace.clearChanges();
    for (const [path, content] of Object.entries(branch.tree)) {
      if (content === null) {
        if (workspace.hasFile(path)) workspace.deleteFile(path, { recordHistory: false });
      } else {
        workspace.writeFile(path, content);
      }
    }
  }

  async function switchBranch(rawName) {
    const name = normalizeBranchName(rawName);
    if (!state.branches[name]) throw new Error("Branch not found: " + name);
    if (name === state.currentBranch) return name;
    if (getStaged().length) throw new Error("Unstage or commit changes before switching branches.");
    const dirty = await getWorkingChanges();
    if (dirty.length) throw new Error("Commit or discard working-tree changes before switching branches.");
    state.currentBranch = name;
    await applyBranchTree(state.branches[name]);
    persist();
    emit("branch-switched", { name });
    return name;
  }

  async function getDiff(path, { staged = false } = {}) {
    const before = await getHeadContent(path);
    const stagedChange = state.staged[path];
    let after;
    let status;
    if (staged && stagedChange) {
      status = stagedChange.status;
      after = status === "deleted" ? null : stagedChange.content;
    } else {
      const change = (await getWorkingChanges()).find((candidate) => candidate.path === path);
      if (!change && stagedChange) {
        status = stagedChange.status;
        after = status === "deleted" ? null : stagedChange.content;
      } else if (change) {
        status = change.status;
        after = status === "deleted" ? null : change.content ?? await workspace.readFile(path);
      } else {
        status = "clean";
        after = workspace.hasFile(path) ? await workspace.readFile(path) : null;
      }
    }
    return { path, status, before: before ?? "", after: after ?? "" };
  }

  async function resolveConflict(path, content) {
    if (content === null) {
      if (workspace.hasFile(path)) workspace.deleteFile(path, { recordHistory: false });
    } else {
      workspace.writeFile(path, String(content));
    }
    const staged = await stage(path);
    emit("conflict-resolved", { path });
    return staged;
  }

  async function mergeBranch(rawSourceName) {
    const sourceName = normalizeBranchName(rawSourceName);
    if (sourceName === state.currentBranch) throw new Error("Cannot merge a branch into itself.");
    const source = state.branches[sourceName];
    if (!source) throw new Error("Branch not found: " + sourceName);
    if (getStaged().length) throw new Error("Unstage or commit changes before merging.");
    const dirty = await getWorkingChanges();
    if (dirty.length) throw new Error("Commit or discard working-tree changes before merging.");

    const target = currentBranchRecord();
    const paths = new Set([...Object.keys(source.tree), ...Object.keys(source.baseTree)]);
    const conflicts = [];
    const applicable = [];

    for (const path of [...paths].sort((left, right) => left.localeCompare(right))) {
      const sourceTreeValue = own(source.tree, path) ? source.tree[path] : undefined;
      const sourceBaseValue = own(source.baseTree, path) ? source.baseTree[path] : undefined;
      if (sourceTreeValue === sourceBaseValue) continue;

      const baseContent = await readTreeContent(source.baseTree, path);
      const incomingContent = await readTreeContent(source.tree, path);
      const currentContent = await readTreeContent(target.tree, path);
      const targetChanged = currentContent !== baseContent;

      if (targetChanged && currentContent !== incomingContent) {
        conflicts.push({
          path,
          base: baseContent ?? "",
          current: currentContent ?? "",
          incoming: incomingContent ?? "",
          currentDeleted: currentContent === null,
          incomingDeleted: incomingContent === null
        });
      } else {
        applicable.push({ path, content: incomingContent });
      }
    }

    for (const change of applicable) {
      if (change.content === null) {
        if (workspace.hasFile(change.path)) workspace.deleteFile(change.path, { recordHistory: false });
      } else {
        workspace.writeFile(change.path, change.content);
      }
      await stage(change.path);
    }

    emit("merge-prepared", { source: sourceName, conflicts: conflicts.map((conflict) => conflict.path) });
    return { source: sourceName, staged: applicable.map((change) => change.path), conflicts };
  }

  function getBranches() {
    return Object.entries(state.branches)
      .map(([name, branch]) => ({ name, head: branch.head, current: name === state.currentBranch }))
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  function getCommitGraph() {
    return [...state.commits].reverse().map((commit) => ({ ...commit, changes: commit.changes.map((change) => ({ ...change })) }));
  }

  function resetProvider() {
    state = normalizeState(null);
    try { storage.removeItem(GIT_WORKSPACE_STORAGE_KEY); } catch { /* ignore */ }
    emit("provider-reset");
  }

  persist();

  return Object.freeze({
    getCurrentBranch: () => state.currentBranch,
    getBranches,
    getCommitGraph,
    getWorkingChanges,
    getStaged,
    getHeadContent,
    getDiff,
    stage,
    unstage,
    commit,
    createBranch,
    switchBranch,
    mergeBranch,
    resolveConflict,
    resetProvider,
    subscribe(listener) {
      if (typeof listener !== "function") throw new TypeError("Git listener must be a function.");
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  });
}
