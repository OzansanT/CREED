import { EDITOR_WORKSPACE_STORAGE_KEY } from "../../core/config.js";
import { normalizeEditorSessionState } from "./editor-session-state.js";
import { WORKSPACE_FILES } from "./source-files.js";

export const EDITOR_WORKSPACE_SCHEMA_VERSION = 1;

function normalizeValidFiles(validFiles) {
  return validFiles instanceof Set ? validFiles : new Set(Array.isArray(validFiles) ? validFiles : WORKSPACE_FILES);
}

function normalizeFileList(value, validFiles) {
  if (!Array.isArray(value)) return [];
  const allowed = normalizeValidFiles(validFiles);
  const seen = new Set();
  return value.filter((fileName) => {
    if (typeof fileName !== "string" || !allowed.has(fileName) || seen.has(fileName)) return false;
    seen.add(fileName);
    return true;
  });
}

function normalizeSessions(value, openFiles) {
  const source = value && typeof value === "object" ? value : {};
  return Object.fromEntries(openFiles.map((fileName) => [
    fileName,
    normalizeEditorSessionState(source[fileName])
  ]));
}

export function normalizeEditorWorkspaceState(value = {}, { validFiles = WORKSPACE_FILES } = {}) {
  const openFiles = normalizeFileList(value.openFiles, validFiles);
  const requestedActiveFile = typeof value.activeFile === "string" ? value.activeFile : "";
  const activeFile = openFiles.includes(requestedActiveFile) ? requestedActiveFile : "";
  return {
    version: EDITOR_WORKSPACE_SCHEMA_VERSION,
    openFiles,
    activeFile,
    sessions: normalizeSessions(value.sessions, openFiles)
  };
}

export function migrateEditorWorkspaceState(value, options = {}) {
  if (!value || typeof value !== "object") return null;
  if (value.version === EDITOR_WORKSPACE_SCHEMA_VERSION) return normalizeEditorWorkspaceState(value, options);
  if (value.version == null && Array.isArray(value.openFiles)) return normalizeEditorWorkspaceState(value, options);
  return null;
}

export function saveEditorWorkspace(value, options = {}) {
  const workspace = normalizeEditorWorkspaceState(value, options);
  try {
    localStorage.setItem(EDITOR_WORKSPACE_STORAGE_KEY, JSON.stringify(workspace));
    return true;
  } catch {
    return false;
  }
}

export function loadEditorWorkspace(options = {}) {
  try {
    const saved = JSON.parse(localStorage.getItem(EDITOR_WORKSPACE_STORAGE_KEY));
    const migrated = migrateEditorWorkspaceState(saved, options);
    if (!migrated) return null;
    if (saved?.version !== EDITOR_WORKSPACE_SCHEMA_VERSION) saveEditorWorkspace(migrated, options);
    return migrated;
  } catch {
    return null;
  }
}

export function clearEditorWorkspace() {
  try {
    localStorage.removeItem(EDITOR_WORKSPACE_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}
