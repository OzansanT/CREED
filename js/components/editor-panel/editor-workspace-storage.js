import { EDITOR_WORKSPACE_STORAGE_KEY } from "../../core/config.js";
import { normalizeEditorSessionState } from "./editor-session-state.js";
import { WORKSPACE_FILES } from "./source-files.js";

export const EDITOR_WORKSPACE_SCHEMA_VERSION = 1;
const validWorkspaceFiles = new Set(WORKSPACE_FILES);

function normalizeFileList(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  return value.filter((fileName) => {
    if (typeof fileName !== "string" || !validWorkspaceFiles.has(fileName) || seen.has(fileName)) {
      return false;
    }
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

export function normalizeEditorWorkspaceState(value = {}) {
  const openFiles = normalizeFileList(value.openFiles);
  const requestedActiveFile = typeof value.activeFile === "string" ? value.activeFile : "";
  const activeFile = openFiles.includes(requestedActiveFile) ? requestedActiveFile : "";
  return {
    version: EDITOR_WORKSPACE_SCHEMA_VERSION,
    openFiles,
    activeFile,
    sessions: normalizeSessions(value.sessions, openFiles)
  };
}

export function saveEditorWorkspace(value) {
  const workspace = normalizeEditorWorkspaceState(value);
  try {
    localStorage.setItem(EDITOR_WORKSPACE_STORAGE_KEY, JSON.stringify(workspace));
    return true;
  } catch {
    return false;
  }
}

export function loadEditorWorkspace() {
  try {
    const saved = JSON.parse(localStorage.getItem(EDITOR_WORKSPACE_STORAGE_KEY));
    if (!saved || typeof saved !== "object") return null;
    if (saved.version !== EDITOR_WORKSPACE_SCHEMA_VERSION) return null;
    return normalizeEditorWorkspaceState(saved);
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
