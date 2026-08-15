import { WORKSPACE_FILES } from "./source-files.js";

const TEXT_DECODER_ERROR = "The selected resource is not a text file.";

function normalizePath(value) {
  const path = String(value || "")
    .replaceAll("\\", "/")
    .replace(/^\/+|\/+$/g, "")
    .replace(/\/{2,}/g, "/");
  if (!path || path.split("/").some((part) => !part || part === "." || part === "..")) {
    throw new Error("Use a relative workspace path without . or .. segments.");
  }
  return path;
}

function parentDirectories(path) {
  const parts = path.split("/");
  const directories = [];
  for (let index = 1; index < parts.length; index += 1) {
    directories.push(parts.slice(0, index).join("/"));
  }
  return directories;
}

function changeKind(record) {
  if (!record?.dirty) return "unchanged";
  if (record.deleted) return "deleted";
  if (record.baseline === null) return "added";
  return "modified";
}

function createRecord(path, overrides = {}) {
  return {
    path,
    content: null,
    baseline: null,
    origin: undefined,
    loaded: false,
    dirty: false,
    deleted: false,
    staged: false,
    ...overrides
  };
}

async function fetchWorkspaceFile(path, signal) {
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  const response = await fetch("./" + encoded, { cache: "no-store", signal });
  if (!response.ok) throw new Error(`Unable to load ${path} (${response.status})`);
  const contentType = response.headers.get("content-type") || "";
  if (contentType.startsWith("image/") || contentType.startsWith("audio/") || contentType.startsWith("video/")) {
    throw new Error(TEXT_DECODER_ERROR);
  }
  return response.text();
}

function buildPatch(change) {
  const before = change.baseline === null ? [] : String(change.baseline).split("\n");
  const after = change.deleted ? [] : String(change.content ?? "").split("\n");
  return [
    `--- ${change.baseline === null ? "/dev/null" : "a/" + change.path}`,
    `+++ ${change.deleted ? "/dev/null" : "b/" + change.path}`,
    `@@ -1,${before.length} +1,${after.length} @@`,
    ...before.map((line) => "-" + line),
    ...after.map((line) => "+" + line)
  ].join("\n");
}

export function createWorkspaceStore({
  fileNames = WORKSPACE_FILES,
  loadSource = fetchWorkspaceFile,
  branch = "main"
} = {}) {
  const records = new Map();
  const directories = new Set();
  const listeners = new Set();
  const commits = [];
  let currentBranch = branch;

  fileNames.forEach((fileName) => {
    const path = normalizePath(fileName);
    records.set(path, createRecord(path, { baseline: undefined }));
    parentDirectories(path).forEach((directory) => directories.add(directory));
  });

  function emit(type, detail = {}) {
    const event = Object.freeze({ type, ...detail });
    listeners.forEach((listener) => listener(event));
  }

  function requireRecord(pathValue) {
    const path = normalizePath(pathValue);
    const record = records.get(path);
    if (!record || record.deleted) throw new Error(`${path} does not exist.`);
    return record;
  }

  async function readFile(pathValue, { signal } = {}) {
    const record = requireRecord(pathValue);
    if (record.loaded) return record.content;
    const source = await loadSource(record.path, signal);
    record.content = String(source);
    record.baseline = record.content;
    if (record.origin === undefined) record.origin = record.content;
    record.loaded = true;
    emit("load", { path: record.path });
    return record.content;
  }

  async function ensureAllLoaded({ onProgress, signal, concurrency = 8 } = {}) {
    const queue = [...records.values()].filter((record) => !record.deleted && !record.loaded);
    let completed = records.size - queue.length;
    const total = records.size;
    const worker = async () => {
      while (queue.length) {
        if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
        const record = queue.shift();
        try {
          await readFile(record.path, { signal });
        } catch (error) {
          if (error.name === "AbortError") throw error;
          record.content = "";
          record.baseline = "";
          record.loaded = true;
          record.loadError = error.message;
        }
        completed += 1;
        onProgress?.({ completed, total, path: record.path });
      }
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, Math.max(1, queue.length)) }, worker));
    return listFiles();
  }

  function listFiles({ includeDeleted = false } = {}) {
    return [...records.values()]
      .filter((record) => includeDeleted || !record.deleted)
      .map((record) => ({
        path: record.path,
        loaded: record.loaded,
        dirty: record.dirty,
        staged: record.staged,
        deleted: record.deleted,
        status: changeKind(record),
        loadError: record.loadError || ""
      }))
      .sort((a, b) => a.path.localeCompare(b.path));
  }

  function listDirectories() {
    return [...directories].sort((a, b) => a.localeCompare(b));
  }

  function getFile(pathValue) {
    const path = normalizePath(pathValue);
    const record = records.get(path);
    if (!record) return null;
    return {
      path: record.path,
      content: record.content,
      baseline: record.baseline,
      origin: record.origin,
      loaded: record.loaded,
      dirty: record.dirty,
      staged: record.staged,
      deleted: record.deleted,
      status: changeKind(record),
      loadError: record.loadError || ""
    };
  }

  function createFile(pathValue, content = "") {
    const path = normalizePath(pathValue);
    if (records.has(path) && !records.get(path).deleted) throw new Error(`${path} already exists.`);
    if (directories.has(path)) throw new Error(`${path} is a folder.`);
    parentDirectories(path).forEach((directory) => directories.add(directory));
    records.set(path, createRecord(path, {
      content: String(content),
      baseline: null,
      origin: null,
      loaded: true,
      dirty: true
    }));
    emit("create", { path });
    return path;
  }

  function createFolder(pathValue) {
    const path = normalizePath(pathValue);
    if (records.has(path)) throw new Error(`${path} is a file.`);
    if (directories.has(path)) throw new Error(`${path} already exists.`);
    parentDirectories(path).forEach((directory) => directories.add(directory));
    directories.add(path);
    emit("create-folder", { path });
    return path;
  }

  function writeFile(pathValue, content) {
    const record = requireRecord(pathValue);
    if (!record.loaded) throw new Error(`${record.path} must be loaded before it can be edited.`);
    record.content = String(content);
    record.dirty = record.baseline === null || record.content !== record.baseline;
    if (!record.dirty) record.staged = false;
    emit("write", { path: record.path, status: changeKind(record) });
    return getFile(record.path);
  }

  function deleteFileRecord(record) {
    if (record.baseline === null) {
      records.delete(record.path);
      return;
    }
    record.deleted = true;
    record.dirty = true;
    record.staged = false;
  }

  async function removePath(pathValue) {
    const path = normalizePath(pathValue);
    if (records.has(path) && !records.get(path).deleted) {
      const record = records.get(path);
      if (!record.loaded) await readFile(path);
      deleteFileRecord(record);
      emit("delete", { path });
      return [path];
    }
    if (!directories.has(path)) throw new Error(`${path} does not exist.`);
    const prefix = path + "/";
    const affected = [...records.values()].filter((record) => !record.deleted && record.path.startsWith(prefix));
    await Promise.all(affected.filter((record) => !record.loaded).map((record) => readFile(record.path)));
    affected.forEach(deleteFileRecord);
    [...directories].filter((directory) => directory === path || directory.startsWith(prefix)).forEach((directory) => directories.delete(directory));
    emit("delete-folder", { path, files: affected.map((record) => record.path) });
    return affected.map((record) => record.path);
  }

  async function renamePath(fromValue, toValue) {
    const from = normalizePath(fromValue);
    const to = normalizePath(toValue);
    if (from === to) return to;
    if (records.has(to) && !records.get(to).deleted || directories.has(to)) throw new Error(`${to} already exists.`);
    if (records.has(from) && !records.get(from).deleted) {
      const source = records.get(from);
      if (!source.loaded) await readFile(from);
      const content = source.content;
      deleteFileRecord(source);
      createFile(to, content);
      emit("rename", { from, to });
      return to;
    }
    if (!directories.has(from)) throw new Error(`${from} does not exist.`);
    const prefix = from + "/";
    const files = [...records.values()].filter((record) => !record.deleted && record.path.startsWith(prefix));
    for (const record of files) {
      if (!record.loaded) await readFile(record.path);
    }
    for (const record of files) {
      const nextPath = to + record.path.slice(from.length);
      const content = record.content;
      deleteFileRecord(record);
      createFile(nextPath, content);
    }
    const nextDirectories = [...directories]
      .filter((directory) => directory === from || directory.startsWith(prefix))
      .map((directory) => to + directory.slice(from.length));
    [...directories].filter((directory) => directory === from || directory.startsWith(prefix)).forEach((directory) => directories.delete(directory));
    nextDirectories.forEach((directory) => directories.add(directory));
    emit("rename-folder", { from, to });
    return to;
  }

  function listChanges() {
    return [...records.values()]
      .filter((record) => record.dirty)
      .map((record) => ({
        path: record.path,
        content: record.content,
        baseline: record.baseline,
        deleted: record.deleted,
        staged: record.staged,
        status: changeKind(record)
      }))
      .sort((a, b) => a.path.localeCompare(b.path));
  }

  function setStaged(pathValue, staged) {
    const path = normalizePath(pathValue);
    const record = records.get(path);
    if (!record?.dirty) throw new Error(`${path} has no changes to stage.`);
    record.staged = Boolean(staged);
    emit("stage", { path, staged: record.staged });
  }

  function stageAll(staged = true) {
    records.forEach((record) => {
      if (record.dirty) record.staged = Boolean(staged);
    });
    emit("stage-all", { staged: Boolean(staged) });
  }

  function discard(pathValue) {
    const path = normalizePath(pathValue);
    const record = records.get(path);
    if (!record?.dirty) throw new Error(`${path} has no changes to discard.`);
    if (record.baseline === null) {
      records.delete(path);
    } else {
      record.content = record.baseline ?? null;
      record.loaded = record.baseline !== undefined;
      record.deleted = false;
      record.dirty = false;
      record.staged = false;
    }
    emit("discard", { path });
  }

  function discardAll() {
    listChanges().forEach((change) => discard(change.path));
    emit("discard-all");
  }

  function commit(message, author = "CREED User") {
    const summary = String(message || "").trim();
    if (!summary) throw new Error("Enter a commit message.");
    const changes = listChanges().filter((change) => change.staged);
    if (!changes.length) throw new Error("Stage at least one changed file.");
    const commitRecord = Object.freeze({
      id: `local-${Date.now().toString(36)}-${commits.length + 1}`,
      message: summary,
      author,
      branch: currentBranch,
      createdAt: new Date().toISOString(),
      files: changes.map((change) => ({ path: change.path, status: change.status }))
    });
    changes.forEach((change) => {
      const record = records.get(change.path);
      if (record.deleted) {
        if (record.origin === null) records.delete(change.path);
        else {
          record.content = null;
          record.baseline = null;
          record.dirty = false;
          record.staged = false;
        }
        return;
      }
      record.baseline = record.content;
      record.dirty = false;
      record.staged = false;
    });
    commits.unshift(commitRecord);
    emit("commit", { commit: commitRecord });
    return commitRecord;
  }

  async function search(queryValue, { caseSensitive = false, useRegex = false, limit = 1000, signal, onProgress } = {}) {
    const query = String(queryValue || "");
    if (!query) return [];
    await ensureAllLoaded({ signal, onProgress });
    let matcher;
    if (useRegex) {
      try {
        matcher = new RegExp(query, caseSensitive ? "g" : "gi");
      } catch (error) {
        throw new Error("Invalid regular expression: " + error.message);
      }
    }
    const needle = caseSensitive ? query : query.toLowerCase();
    const results = [];
    for (const record of records.values()) {
      if (record.deleted || !record.loaded) continue;
      const lines = record.content.replace(/\r\n/g, "\n").split("\n");
      for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
        const line = lines[lineIndex];
        if (useRegex) {
          matcher.lastIndex = 0;
          let match;
          while ((match = matcher.exec(line))) {
            results.push({ path: record.path, line: lineIndex + 1, column: match.index + 1, preview: line, match: match[0] });
            if (!match[0]) matcher.lastIndex += 1;
            if (results.length >= limit) return results;
          }
        } else {
          const haystack = caseSensitive ? line : line.toLowerCase();
          let column = haystack.indexOf(needle);
          while (column >= 0) {
            results.push({ path: record.path, line: lineIndex + 1, column: column + 1, preview: line, match: line.slice(column, column + query.length) });
            if (results.length >= limit) return results;
            column = haystack.indexOf(needle, column + Math.max(1, needle.length));
          }
        }
      }
    }
    return results;
  }

  async function replaceAll(query, replacement, options = {}) {
    const results = await search(query, options);
    const paths = [...new Set(results.map((result) => result.path))];
    for (const path of paths) {
      const record = records.get(path);
      let next;
      if (options.useRegex) {
        const flags = options.caseSensitive ? "g" : "gi";
        next = record.content.replace(new RegExp(query, flags), replacement);
      } else if (options.caseSensitive) {
        next = record.content.split(query).join(replacement);
      } else {
        next = record.content.replace(new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), replacement);
      }
      writeFile(path, next);
    }
    emit("replace-all", { query, replacement, replacements: results.length, files: paths.length });
    return { replacements: results.length, files: paths.length };
  }

  function getDiagnostics() {
    const diagnostics = [];
    records.forEach((record) => {
      if (!record.loaded || record.deleted) return;
      const lines = record.content.split("\n");
      lines.forEach((line, index) => {
        if (/^(<{7}|={7}|>{7})/.test(line)) {
          diagnostics.push({ path: record.path, line: index + 1, severity: "error", message: "Unresolved merge-conflict marker." });
        }
      });
      if (record.path.endsWith(".json")) {
        try {
          JSON.parse(record.content);
        } catch (error) {
          diagnostics.push({ path: record.path, line: 1, severity: "error", message: error.message });
        }
      }
    });
    return diagnostics;
  }

  function createSnapshot() {
    const persistedRecords = [...records.values()]
      .filter((record) => record.deleted || record.dirty || record.staged || record.origin === null || (record.loaded && record.content !== record.origin) || record.baseline !== record.origin)
      .map((record) => ({
        path: record.path,
        content: record.content,
        baseline: record.baseline,
        origin: record.origin,
        loaded: record.loaded,
        dirty: record.dirty,
        deleted: record.deleted,
        staged: record.staged,
        loadError: record.loadError || ""
      }));
    return {
      format: "creed-workspace-snapshot",
      version: 1,
      savedAt: new Date().toISOString(),
      branch: currentBranch,
      directories: [...directories].sort(),
      records: persistedRecords,
      commits: commits.map((commit) => ({ ...commit, files: commit.files.map((file) => ({ ...file })) }))
    };
  }

  function restoreSnapshot(snapshot) {
    if (!snapshot || snapshot.format !== "creed-workspace-snapshot" || snapshot.version !== 1 || !Array.isArray(snapshot.records)) {
      throw new Error("Unsupported browser-workspace snapshot.");
    }
    records.forEach((record, path) => {
      if (record.origin === null) records.delete(path);
      else records.set(path, createRecord(path, { baseline: undefined, origin: undefined }));
    });
    directories.clear();
    fileNames.forEach((fileName) => parentDirectories(normalizePath(fileName)).forEach((directory) => directories.add(directory)));
    (Array.isArray(snapshot.directories) ? snapshot.directories : []).forEach((directory) => {
      try { directories.add(normalizePath(directory)); } catch { /* Ignore invalid backup paths. */ }
    });
    snapshot.records.forEach((candidate) => {
      const path = normalizePath(candidate.path);
      records.set(path, createRecord(path, {
        content: candidate.content == null ? null : String(candidate.content),
        baseline: candidate.baseline == null ? candidate.baseline : String(candidate.baseline),
        origin: candidate.origin == null ? candidate.origin : String(candidate.origin),
        loaded: candidate.loaded === true,
        dirty: candidate.dirty === true,
        deleted: candidate.deleted === true,
        staged: candidate.staged === true,
        loadError: typeof candidate.loadError === "string" ? candidate.loadError : ""
      }));
      parentDirectories(path).forEach((directory) => directories.add(directory));
    });
    commits.splice(0, commits.length, ...(Array.isArray(snapshot.commits) ? snapshot.commits.filter((commit) => commit && typeof commit.id === "string") : []));
    if (typeof snapshot.branch === "string" && /^[\w./-]+$/.test(snapshot.branch)) currentBranch = snapshot.branch;
    emit("restore", { snapshot: createSnapshot() });
    return true;
  }

  function resetToSource() {
    records.clear();
    directories.clear();
    fileNames.forEach((fileName) => {
      const path = normalizePath(fileName);
      records.set(path, createRecord(path, { baseline: undefined, origin: undefined }));
      parentDirectories(path).forEach((directory) => directories.add(directory));
    });
    commits.length = 0;
    currentBranch = branch;
    emit("reset");
  }

  return Object.freeze({
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    readFile,
    ensureAllLoaded,
    listFiles,
    listDirectories,
    getFile,
    createFile,
    createFolder,
    writeFile,
    removePath,
    renamePath,
    listChanges,
    setStaged,
    stageAll,
    discard,
    discardAll,
    commit,
    search,
    replaceAll,
    getDiagnostics,
    createSnapshot,
    restoreSnapshot,
    resetToSource,
    exportPatch: () => listChanges().map(buildPatch).join("\n\n"),
    getCommits: () => [...commits],
    getBranch: () => currentBranch,
    setBranch(nextBranch) {
      const name = String(nextBranch || "").trim();
      if (!/^[\w./-]+$/.test(name)) throw new Error("Use a valid branch name.");
      currentBranch = name;
      emit("branch", { branch: currentBranch });
    }
  });
}

export { normalizePath };
