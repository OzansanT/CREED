import { createIndexedDatabase } from "./indexed-db.js";
import { serializeCreedDocument } from "./creed-document.js";

const DOCUMENT_KEY = "document.current";
const WORKSPACE_KEY = "workspace.current";
const SESSION_KEY = "editor.session";
const SETTINGS_KEY = "settings.current";
const PANEL_KEY = "panels.current";
const RECOVERY_PREFIX = "recovery.";
const SAVE_DELAY = 450;
const RECOVERY_INTERVAL = 10 * 60 * 1000;

export function createDurablePersistence({
  database = createIndexedDatabase(),
  workspaceStore,
  getDocument,
  restoreDocument,
  getEditorSession,
  restoreEditorSession,
  settingsStore,
  getPanelLayout,
  restorePanelLayout,
  notify
}) {
  let saveTimer = 0;
  let started = false;
  let lastRecoveryAt = 0;
  let unsubscribeWorkspace = null;
  let unsubscribeSettings = null;

  function payload(reason = "manual") {
    return {
      format: "creed-recovery",
      version: 1,
      id: `recovery-${Date.now().toString(36)}`,
      reason,
      createdAt: new Date().toISOString(),
      document: serializeCreedDocument(getDocument()),
      workspace: workspaceStore.createSnapshot(),
      editorSession: getEditorSession(),
      settings: settingsStore.get(),
      panels: getPanelLayout()
    };
  }

  async function writeCurrent() {
    await Promise.all([
      database.set(DOCUMENT_KEY, serializeCreedDocument(getDocument())),
      database.set(WORKSPACE_KEY, workspaceStore.createSnapshot()),
      database.set(SESSION_KEY, getEditorSession()),
      database.set(SETTINGS_KEY, settingsStore.get()),
      database.set(PANEL_KEY, getPanelLayout())
    ]);
    if (Date.now() - lastRecoveryAt >= RECOVERY_INTERVAL) {
      await createRecovery("automatic");
    }
    return true;
  }

  function queue() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = 0;
      writeCurrent().catch((error) => notify?.(`Durable save failed: ${error.message}`));
    }, SAVE_DELAY);
  }

  async function flush() {
    clearTimeout(saveTimer);
    saveTimer = 0;
    return writeCurrent();
  }

  async function createRecovery(reason = "manual") {
    const recovery = payload(reason);
    await database.set(RECOVERY_PREFIX + recovery.id, recovery);
    lastRecoveryAt = Date.now();
    const entries = await database.entries(RECOVERY_PREFIX);
    const ordered = entries.sort((a, b) => String(b[1]?.createdAt || "").localeCompare(String(a[1]?.createdAt || "")));
    await Promise.all(ordered.slice(10).map(([key]) => database.delete(key)));
    return recovery;
  }

  async function start({ localDocumentLoaded = false } = {}) {
    if (started) return { restored: false, persistent: await database.isPersistent() };
    const [savedDocument, savedWorkspace, editorSession, savedSettings, savedPanels] = await Promise.all([
      database.get(DOCUMENT_KEY),
      database.get(WORKSPACE_KEY),
      database.get(SESSION_KEY),
      database.get(SETTINGS_KEY),
      database.get(PANEL_KEY)
    ]);
    if (savedSettings) settingsStore.replace(savedSettings);
    if (savedPanels) restorePanelLayout(savedPanels);
    if (savedWorkspace) workspaceStore.restoreSnapshot(savedWorkspace);
    let documentRestored = false;
    if (savedDocument) {
      const currentUpdated = Date.parse(getDocument()?.updatedAt || "") || 0;
      const savedUpdated = Date.parse(savedDocument.updatedAt || "") || 0;
      if (!localDocumentLoaded || savedUpdated > currentUpdated) {
        restoreDocument(savedDocument);
        documentRestored = true;
      }
    }
    if (editorSession) await restoreEditorSession(editorSession);
    unsubscribeWorkspace = workspaceStore.subscribe(queue);
    unsubscribeSettings = settingsStore.subscribe(queue);
    started = true;
    await writeCurrent();
    return {
      restored: Boolean(savedDocument || savedWorkspace || editorSession),
      documentRestored,
      workspaceRestored: Boolean(savedWorkspace),
      sessionRestored: Boolean(editorSession),
      persistent: await database.isPersistent()
    };
  }

  async function listRecoveries() {
    const entries = await database.entries(RECOVERY_PREFIX);
    return entries.map(([, value]) => value).filter((value) => value?.format === "creed-recovery").sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  }

  async function restoreRecovery(recoveryValue) {
    const recovery = typeof recoveryValue === "string"
      ? await database.get(RECOVERY_PREFIX + recoveryValue)
      : recoveryValue;
    if (!recovery || recovery.format !== "creed-recovery" || recovery.version !== 1) throw new Error("Invalid CREED recovery point.");
    restoreDocument(recovery.document);
    workspaceStore.restoreSnapshot(recovery.workspace);
    settingsStore.replace(recovery.settings);
    restorePanelLayout(recovery.panels);
    await restoreEditorSession(recovery.editorSession);
    await flush();
    return recovery;
  }

  return Object.freeze({
    start,
    queue,
    queueDocument: queue,
    queueSession: queue,
    flush,
    createRecovery,
    listRecoveries,
    restoreRecovery,
    createBackupPayload: () => payload("export"),
    async clearWorkspace() {
      workspaceStore.resetToSource();
      await Promise.all([database.delete(WORKSPACE_KEY), database.delete(SESSION_KEY)]);
    },
    async clearAll() {
      unsubscribeWorkspace?.();
      unsubscribeSettings?.();
      started = false;
      await database.clear();
    },
    isPersistent: database.isPersistent
  });
}
