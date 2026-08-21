import { WORKSPACE_FS_STORAGE_KEY } from "../../core/config.js";
import { WORKSPACE_FILES } from "./source-files.js";

export const WORKSPACE_FS_SCHEMA_VERSION = 1;
const DEFAULT_MAX_PATH_LENGTH = 240;

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
  if (path.length > DEFAULT_MAX_PATH_LENGTH) {
    throw new Error("Workspace path is too long.");
  }
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

function normalizeStoredState(value) {
  if (!value || typeof value !== "object" || value.version !== WORKSPACE_FS_SCHEMA_VERSION) {
    return { version: WORKSPACE_FS_SCHEMA_VERSION, overlays: {}, deleted: [], directories: [] };
  }
  const overlays = {};
  for (const [rawPath, rawContent] of Object.entries(value.overlays || {})) {
    try {
      const path = normalizeWorkspacePath(rawPath);
      if (typeof rawContent === "string") overlays[path] = rawContent;
    } catch {
      // Ignore invalid persisted entries.
    }
  }
  const deleted = [];
  for (const rawPath of Array.isArray(value.deleted) ? value.deleted : []) {
    try {
      const path = normalizeWorkspacePath(rawPath);
      if (!deleted.includes(path)) deleted.push(path);
    } catch {
      // Ignore invalid persisted entries.
    }
  }
  const directories = [];
  for (const rawPath of Array.isArray(value.directories) ? value.directories : []) {
    try {
      const path = normalizeWorkspacePath(rawPath);
      if (!directories.includes(path)) directories.push(path);
    } catch {
      // Ignore invalid persisted entries.
    }
  }
  return { version: WORKSPACE_FS_SCHEMA_VERSION, overlays, deleted, directories };
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
  let stored;
  try {
    stored = normalizeStoredState(JSON.parse(storage.getItem(WORKSPACE_FS_STORAGE_KEY)));
  } catch {
    stored = normalizeStoredState(null);
  }
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

  function deleteFile(rawPath) {
    const path = normalizeWorkspacePath(rawPath);
    if (!hasFile(path)) return false;
    overlays.delete(path);
    if (baseSet.has(path)) deleted.add(path);
    else deleted.delete(path);
    persist();
    emit({ type: "file-deleted", path });
    return true;
  }

  function deleteDirectory(rawPath) {
    const path = normalizeWorkspacePath(rawPath);
    const prefix = path + "/";
    const files = listFiles().filter((fileName) => fileName.startsWith(prefix));
    const directories = listDirectories().filter((directory) => directory === path || directory.startsWith(prefix));
    if (!files.length && !directories.length) return false;
    for (const fileName of files) {
      overlays.delete(fileName);
      if (baseSet.has(fileName)) deleted.add(fileName);
      else deleted.delete(fileName);
    }
    directories.forEach((directory) => explicitDirectories.delete(directory));
    persist();
    emit({ type: "directory-deleted", path, files });
    return true;
  }

  async function rename(rawSource, rawTarget) {
    const source = normalizeWorkspacePath(rawSource);
    const target = validateAvailablePath(rawTarget);
    if (hasFile(source)) {
      const content = await readFile(source);
      createFile(target, content);
      deleteFile(source);
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
      if (hasFile(entry.target) || hasDirectory(entry.target)) {
        throw new Error("Workspace path already exists: " + entry.target);
      }
    }
    explicitDirectories.add(target);
    for (const entry of entries) {
      createFile(entry.target, entry.content);
      deleteFile(entry.source);
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
