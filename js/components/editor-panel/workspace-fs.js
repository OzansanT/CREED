import { WORKSPACE_FS_STORAGE_KEY } from "../../core/config.js";
import { WORKSPACE_FILES } from "./source-files.js";

export const WORKSPACE_FS_SCHEMA_VERSION = 3;
const SOURCE_CONTROL_SCHEMA_VERSION = 1;
const RUN_DEBUG_SCHEMA_VERSION = 2;
const DEFAULT_MAX_PATH_LENGTH = 240;
const MAX_DELETE_HISTORY = 20;

const SOURCE_CONTROL_MIGRATION_RESET_FILES = new Set([
  "index.html",
  "js/components/ai/ai-main.js",
  "js/components/ai/ai-patch.js",
  "js/components/ai/chat-main.js",
  "js/components/editor-panel/source-files.js",
  "js/components/primary-sidebar/primary-sidebar-input.js",
  "js/core/config.js",
  "js/core/elements.js",
  "js/main.js",
  "package.json",
  "scripts/check-ai-workbench.mjs",
  "scripts/check-architecture.mjs",
  "scripts/check-post-roadmap-integration.mjs",
  "scripts/check-run-debug.mjs",
  "ui/bars/activity-bar/activity-bar.html",
  "ui/main-frame.html"
]);
const SOURCE_CONTROL_MIGRATION_RETIRED_FILES = new Set([
  "js/components/ai/self-development.js",
  "scripts/check-source-control.mjs"
]);
const SOURCE_CONTROL_MIGRATION_RETIRED_DIRECTORIES = Object.freeze([
  "js/components/source-control"
]);

const RUN_DEBUG_MIGRATION_RESET_FILES = new Set([
  "index.html",
  "js/components/editor-panel/source-files.js",
  "js/components/editor-panel/workspace-fs.js",
  "js/components/primary-sidebar/primary-sidebar-input.js",
  "js/core/elements.js",
  "js/main.js",
  "scripts/check-architecture.mjs",
  "scripts/check-post-roadmap-integration.mjs",
  "scripts/check-run-debug.mjs",
  "scripts/check-workspace-fs.mjs",
  "ui/bars/activity-bar/activity-bar.html"
]);
const RUN_DEBUG_MIGRATION_RETIRED_DIRECTORIES = Object.freeze([
  "js/components/run-debug"
]);

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

export function normalizeWorkspacePath(value, { allowEmpty = false } = {}) {
  let path = String(value ?? "").trim().replaceAll("\\", "/");
  path = path.replace(/^\.\//, "").replace(/\/+$/g, "");
  if (!path) {
    if (allowEmpty) return "";
    throw new Error("Workspace path cannot be empty.");
  }
  if (path.startsWith("/") || /^[A-Za-z]:\//.test(path)) {
    throw new Error("Workspace paths must be repository-relative.");
  }
  if (path.length > DEFAULT_MAX_PATH_LENGTH) throw new Error("Workspace path is too long.");
  const segments = path.split("/");
  if (segments.some((segment) => !segment || segment === "." || segment === ".." || segment.includes("\0"))) {
    throw new Error("Workspace path contains an invalid segment.");
  }
  return segments.join("/");
}

function parentDirectory(path) {
  const index = path.lastIndexOf("/");
  return index < 0 ? "" : path.slice(0, index);
}

function collectParentDirectories(path) {
  const directories = [];
  let current = parentDirectory(path);
  while (current) {
    directories.push(current);
    current = parentDirectory(current);
  }
  return directories;
}

function isWithinDirectory(path, directory) {
  return path === directory || path.startsWith(directory + "/");
}

function purgeRetiredFeatureState(state, {
  resetFiles = new Set(),
  retiredFiles = new Set(),
  retiredDirectories = [],
  nextVersion
} = {}) {
  for (const fileName of resetFiles) delete state.overlays[fileName];

  for (const fileName of Object.keys(state.overlays)) {
    if (retiredFiles.has(fileName)
      || retiredDirectories.some((directory) => isWithinDirectory(fileName, directory))) {
      delete state.overlays[fileName];
    }
  }

  state.deleted = state.deleted.filter((fileName) => (
    !resetFiles.has(fileName)
    && !retiredFiles.has(fileName)
    && !retiredDirectories.some((directory) => isWithinDirectory(fileName, directory))
  ));
  state.directories = state.directories.filter((directory) => (
    !retiredDirectories.some((retired) => isWithinDirectory(directory, retired))
  ));
  state.version = nextVersion;
  return state;
}

function migrateSourceControlState(state) {
  return purgeRetiredFeatureState(state, {
    resetFiles: SOURCE_CONTROL_MIGRATION_RESET_FILES,
    retiredFiles: SOURCE_CONTROL_MIGRATION_RETIRED_FILES,
    retiredDirectories: SOURCE_CONTROL_MIGRATION_RETIRED_DIRECTORIES,
    nextVersion: RUN_DEBUG_SCHEMA_VERSION
  });
}

function migrateRunDebugState(state) {
  return purgeRetiredFeatureState(state, {
    resetFiles: RUN_DEBUG_MIGRATION_RESET_FILES,
    retiredDirectories: RUN_DEBUG_MIGRATION_RETIRED_DIRECTORIES,
    nextVersion: WORKSPACE_FS_SCHEMA_VERSION
  });
}

function normalizeStoredState(value) {
  const supportedVersion = [
    SOURCE_CONTROL_SCHEMA_VERSION,
    RUN_DEBUG_SCHEMA_VERSION,
    WORKSPACE_FS_SCHEMA_VERSION
  ].includes(value?.version);
  if (!value || typeof value !== "object" || !supportedVersion) {
    return { version: WORKSPACE_FS_SCHEMA_VERSION, overlays: {}, deleted: [], directories: [] };
  }
  const overlays = {};
  for (const [rawPath, rawContent] of Object.entries(value.overlays || {})) {
    try {
      const path = normalizeWorkspacePath(rawPath);
      if (typeof rawContent === "string") overlays[path] = rawContent;
    } catch { /* ignore invalid persisted entries */ }
  }
  const deleted = [];
  for (const rawPath of Array.isArray(value.deleted) ? value.deleted : []) {
    try {
      const path = normalizeWorkspacePath(rawPath);
      if (!deleted.includes(path)) deleted.push(path);
    } catch { /* ignore invalid persisted entries */ }
  }
  const directories = [];
  for (const rawPath of Array.isArray(value.directories) ? value.directories : []) {
    try {
      const path = normalizeWorkspacePath(rawPath);
      if (!directories.includes(path)) directories.push(path);
    } catch { /* ignore invalid persisted entries */ }
  }
  const normalized = { version: value.version, overlays, deleted, directories };
  if (normalized.version === SOURCE_CONTROL_SCHEMA_VERSION) migrateSourceControlState(normalized);
  if (normalized.version === RUN_DEBUG_SCHEMA_VERSION) migrateRunDebugState(normalized);
  return normalized;
}

async function defaultReadBaseline(fileName, { signal } = {}) {
  const filePath = fileName.split("/").map(encodeURIComponent).join("/");
  const response = await fetch("./" + filePath, { cache: "no-store", signal });
  if (!response.ok) throw new Error("Unable to load " + fileName + " (" + response.status + ")");
  return response.text();
}

export function createWorkspaceFileSystem({
  baseFiles = WORKSPACE_FILES,
  storage = getDefaultStorage(),
  readBaseline = defaultReadBaseline
} = {}) {
  const baseSet = new Set(baseFiles.map((fileName) => normalizeWorkspacePath(fileName)));
  const listeners = new Set();
  const deleteHistory = [];
  let rawStored = null;
  try {
    rawStored = JSON.parse(storage.getItem(WORKSPACE_FS_STORAGE_KEY));
  } catch {
    rawStored = null;
  }
  const shouldPersistMigration = [SOURCE_CONTROL_SCHEMA_VERSION, RUN_DEBUG_SCHEMA_VERSION].includes(rawStored?.version);
  const stored = normalizeStoredState(rawStored);
  const overlays = new Map(Object.entries(stored.overlays));
  const deleted = new Set(stored.deleted);
  const explicitDirectories = new Set(stored.directories);

  function persist() {
    const value = {
      version: WORKSPACE_FS_SCHEMA_VERSION,
      overlays: Object.fromEntries(overlays),
      deleted: [...deleted].sort(),
      directories: [...explicitDirectories].sort()
    };
    try {
      storage.setItem(WORKSPACE_FS_STORAGE_KEY, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  if (shouldPersistMigration) persist();

  function emit(change) {
    const snapshot = Object.freeze({ ...change, files: listFiles(), directories: listDirectories() });
    listeners.forEach((listener) => listener(snapshot));
  }

  function listFiles() {
    const files = new Set([...baseSet].filter((fileName) => !deleted.has(fileName)));
    overlays.forEach((_content, fileName) => {
      if (!deleted.has(fileName)) files.add(fileName);
    });
    return [...files].sort((left, right) => left.localeCompare(right));
  }

  function listDirectories() {
    const directories = new Set(explicitDirectories);
    for (const fileName of listFiles()) {
      for (const directory of collectParentDirectories(fileName)) directories.add(directory);
    }
    return [...directories].sort((left, right) => left.localeCompare(right));
  }

  function hasFile(rawPath) {
    const path = normalizeWorkspacePath(rawPath);
    if (deleted.has(path)) return false;
    return overlays.has(path) || baseSet.has(path);
  }

  function hasDirectory(rawPath) {
    const path = normalizeWorkspacePath(rawPath);
    return listDirectories().includes(path);
  }

  function validateAvailablePath(rawPath, { allowExisting = false } = {}) {
    const path = normalizeWorkspacePath(rawPath);
    if (!allowExisting && (hasFile(path) || hasDirectory(path))) {
      throw new Error("Workspace path already exists: " + path);
    }
    const parent = parentDirectory(path);
    if (parent && hasFile(parent)) throw new Error("A file blocks the parent directory: " + parent);
    return path;
  }

  async function readFile(rawPath, options = {}) {
    const path = normalizeWorkspacePath(rawPath);
    if (!hasFile(path)) throw new Error("Workspace file not found: " + path);
    if (overlays.has(path)) return overlays.get(path);
    return readBaseline(path, options);
  }

  function ensureParentDirectories(path) {
    for (const directory of collectParentDirectories(path)) explicitDirectories.add(directory);
  }

  function rememberDelete(snapshot) {
    deleteHistory.push(snapshot);
    if (deleteHistory.length > MAX_DELETE_HISTORY) deleteHistory.shift();
  }

  function createDirectory(rawPath) {
    const path = validateAvailablePath(rawPath);
    explicitDirectories.add(path);
    ensureParentDirectories(path + "/placeholder");
    persist();
    emit({ type: "directory-created", path });
    return path;
  }

  function createFile(rawPath, content = "") {
    const path = validateAvailablePath(rawPath);
    if (typeof content !== "string") throw new TypeError("Workspace file content must be a string.");
    deleted.delete(path);
    overlays.set(path, content);
    ensureParentDirectories(path);
    persist();
    emit({ type: "file-created", path });
    return path;
  }

  function writeFile(rawPath, content) {
    const path = normalizeWorkspacePath(rawPath);
    if (typeof content !== "string") throw new TypeError("Workspace file content must be a string.");
    const existed = hasFile(path);
    if (!existed) validateAvailablePath(path);
    deleted.delete(path);
    overlays.set(path, content);
    ensureParentDirectories(path);
    persist();
    emit({ type: existed ? "file-written" : "file-created", path });
    return path;
  }

  function deleteFile(rawPath, { recordHistory = true } = {}) {
    const path = normalizeWorkspacePath(rawPath);
    if (!hasFile(path)) return false;
    if (recordHistory) {
      rememberDelete({
        kind: "file",
        path,
        overlayPresent: overlays.has(path),
        overlayValue: overlays.get(path) ?? "",
        base: baseSet.has(path)
      });
    }
    overlays.delete(path);
    if (baseSet.has(path)) deleted.add(path);
    else deleted.delete(path);
    persist();
    emit({ type: "file-deleted", path, undoAvailable: deleteHistory.length > 0 });
    return true;
  }

  function deleteDirectory(rawPath, { recordHistory = true } = {}) {
    const path = normalizeWorkspacePath(rawPath);
    const prefix = path + "/";
    const files = listFiles().filter((fileName) => fileName.startsWith(prefix));
    const directories = listDirectories().filter((directory) => directory === path || directory.startsWith(prefix));
    if (!files.length && !directories.length) return false;
    if (recordHistory) {
      rememberDelete({
        kind: "directory",
        path,
        files: files.map((fileName) => ({
          path: fileName,
          overlayPresent: overlays.has(fileName),
          overlayValue: overlays.get(fileName) ?? "",
          base: baseSet.has(fileName)
        })),
        explicitDirectories: directories.filter((directory) => explicitDirectories.has(directory))
      });
    }
    for (const fileName of files) {
      overlays.delete(fileName);
      if (baseSet.has(fileName)) deleted.add(fileName);
      else deleted.delete(fileName);
    }
    directories.forEach((directory) => explicitDirectories.delete(directory));
    persist();
    emit({ type: "directory-deleted", path, files, undoAvailable: deleteHistory.length > 0 });
    return true;
  }

  function undoLastDelete() {
    const snapshot = deleteHistory.pop();
    if (!snapshot) return null;
    if (snapshot.kind === "file") {
      deleted.delete(snapshot.path);
      if (snapshot.overlayPresent) overlays.set(snapshot.path, snapshot.overlayValue);
      else overlays.delete(snapshot.path);
      ensureParentDirectories(snapshot.path);
      persist();
      emit({ type: "delete-undone", path: snapshot.path, kind: "file" });
      return { path: snapshot.path, kind: "file", files: [snapshot.path] };
    }

    const restoredFiles = [];
    for (const entry of snapshot.files) {
      deleted.delete(entry.path);
      if (entry.overlayPresent) overlays.set(entry.path, entry.overlayValue);
      else overlays.delete(entry.path);
      ensureParentDirectories(entry.path);
      restoredFiles.push(entry.path);
    }
    snapshot.explicitDirectories.forEach((directory) => explicitDirectories.add(directory));
    explicitDirectories.add(snapshot.path);
    persist();
    emit({ type: "delete-undone", path: snapshot.path, kind: "directory", files: restoredFiles });
    return { path: snapshot.path, kind: "directory", files: restoredFiles };
  }

  async function rename(rawSource, rawTarget) {
    const source = normalizeWorkspacePath(rawSource);
    const target = validateAvailablePath(rawTarget);
    if (hasFile(source)) {
      const content = await readFile(source);
      createFile(target, content);
      deleteFile(source, { recordHistory: false });
      emit({ type: "file-renamed", path: source, target });
      return target;
    }
    if (!hasDirectory(source)) throw new Error("Workspace path not found: " + source);
    if (target.startsWith(source + "/")) throw new Error("Cannot move a directory inside itself.");
    const prefix = source + "/";
    const files = listFiles().filter((fileName) => fileName.startsWith(prefix));
    const entries = await Promise.all(files.map(async (fileName) => ({
      source: fileName,
      target: target + fileName.slice(source.length),
      content: await readFile(fileName)
    })));
    for (const entry of entries) {
      if (hasFile(entry.target) || hasDirectory(entry.target)) throw new Error("Workspace path already exists: " + entry.target);
    }
    explicitDirectories.add(target);
    for (const entry of entries) {
      createFile(entry.target, entry.content);
      deleteFile(entry.source, { recordHistory: false });
    }
    for (const directory of [...explicitDirectories]) {
      if (directory === source || directory.startsWith(prefix)) explicitDirectories.delete(directory);
    }
    persist();
    emit({ type: "directory-renamed", path: source, target });
    return target;
  }

  async function duplicateFile(rawSource, rawTarget) {
    const source = normalizeWorkspacePath(rawSource);
    if (!hasFile(source)) throw new Error("Workspace file not found: " + source);
    const target = validateAvailablePath(rawTarget);
    createFile(target, await readFile(source));
    emit({ type: "file-duplicated", path: source, target });
    return target;
  }

  function resetFile(rawPath) {
    const path = normalizeWorkspacePath(rawPath);
    const hadChange = overlays.has(path) || deleted.has(path);
    overlays.delete(path);
    deleted.delete(path);
    if (!baseSet.has(path) && hadChange) {
      persist();
      emit({ type: "file-reset", path });
      return false;
    }
    if (hadChange) {
      persist();
      emit({ type: "file-reset", path });
    }
    return hadChange;
  }

  function getChanges() {
    const changes = [];
    for (const fileName of [...deleted].sort()) {
      if (baseSet.has(fileName)) changes.push({ path: fileName, status: "deleted" });
    }
    for (const [fileName, content] of [...overlays.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      changes.push({ path: fileName, status: baseSet.has(fileName) ? "modified" : "created", content });
    }
    return changes;
  }

  function clearChanges() {
    overlays.clear();
    deleted.clear();
    explicitDirectories.clear();
    deleteHistory.length = 0;
    try { storage.removeItem(WORKSPACE_FS_STORAGE_KEY); } catch { /* ignore */ }
    emit({ type: "workspace-reset" });
  }

  return Object.freeze({
    readFile,
    writeFile,
    createFile,
    createDirectory,
    deleteFile,
    deleteDirectory,
    undoLastDelete,
    canUndoDelete: () => deleteHistory.length > 0,
    rename,
    duplicateFile,
    resetFile,
    clearChanges,
    getChanges,
    listFiles,
    listDirectories,
    hasFile,
    hasDirectory,
    validatePath: (path) => normalizeWorkspacePath(path),
    refresh: () => emit({ type: "workspace-refreshed" }),
    subscribe(listener) {
      if (typeof listener !== "function") throw new TypeError("Workspace listener must be a function.");
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  });
}
