import { downloadTextFile } from "./download.js";

const MAX_BACKUP_BYTES = 20 * 1024 * 1024;

function validateBackup(value) {
  if (!value || value.format !== "creed-recovery" || value.version !== 1) throw new Error("This is not a supported CREED backup.");
  if (!value.document || !value.workspace || !value.editorSession || !value.settings || !value.panels) {
    throw new Error("The CREED backup is incomplete.");
  }
  return value;
}

export function createBackupManager({ durablePersistence, update, onRestore, notify }) {
  async function exportBackup() {
    await durablePersistence.flush();
    const backup = durablePersistence.createBackupPayload();
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    downloadTextFile(`creed-backup-${stamp}.json`, JSON.stringify(backup, null, 2), "application/json");
    notify?.("Complete CREED backup exported");
    return backup;
  }

  async function importBackup(backupValue) {
    const backup = validateBackup(backupValue);
    await durablePersistence.createRecovery("before-import");
    await durablePersistence.restoreRecovery(backup);
    onRestore?.();
    update?.();
    notify?.("CREED backup restored");
    return backup;
  }

  async function importFile(file) {
    if (!file) return null;
    if (file.size > MAX_BACKUP_BYTES) throw new Error("Backups must be 20 MB or smaller.");
    let parsed;
    try { parsed = JSON.parse(await file.text()); }
    catch { throw new Error("The selected backup is not valid JSON."); }
    return importBackup(parsed);
  }

  async function render(container) {
    const section = document.createElement("section");
    section.className = "activity-section";
    const heading = document.createElement("h3");
    heading.textContent = "Backup and recovery";
    const actions = document.createElement("div");
    actions.className = "activity-actions";
    const exportButton = document.createElement("button");
    exportButton.type = "button";
    exportButton.textContent = "Export backup";
    const recoveryButton = document.createElement("button");
    recoveryButton.type = "button";
    recoveryButton.textContent = "Create recovery point";
    const importButton = document.createElement("button");
    importButton.type = "button";
    importButton.textContent = "Import backup";
    const importInput = document.createElement("input");
    importInput.hidden = true;
    importInput.type = "file";
    importInput.accept = "application/json,.json";
    actions.append(exportButton, recoveryButton, importButton, importInput);
    const status = document.createElement("div");
    status.className = "activity-progress";
    status.textContent = await durablePersistence.isPersistent()
      ? "IndexedDB durable storage is active."
      : "IndexedDB is unavailable; this session uses an in-memory fallback.";
    const list = document.createElement("div");
    list.className = "commit-list";
    section.append(heading, actions, status, list);
    if (!container.isConnected) return;
    container.append(section);

    async function renderRecoveries() {
      const recoveries = await durablePersistence.listRecoveries();
      const fragment = document.createDocumentFragment();
      recoveries.forEach((recovery) => {
        const item = document.createElement("div");
        item.className = "commit-item";
        const title = document.createElement("strong");
        title.textContent = recovery.reason.replaceAll("-", " ");
        const meta = document.createElement("small");
        meta.textContent = new Date(recovery.createdAt).toLocaleString();
        const restore = document.createElement("button");
        restore.type = "button";
        restore.textContent = "Restore";
        restore.addEventListener("click", async () => {
          if (!window.confirm(`Restore the recovery point from ${new Date(recovery.createdAt).toLocaleString()}?`)) return;
          try {
            await durablePersistence.createRecovery("before-recovery-restore");
            await durablePersistence.restoreRecovery(recovery);
            onRestore?.();
            update?.();
            notify?.("Recovery point restored");
            await renderRecoveries();
          } catch (error) { notify?.(error.message); }
        });
        item.append(title, document.createTextNode(" "), meta, document.createTextNode(" "), restore);
        fragment.append(item);
      });
      if (!recoveries.length) {
        const empty = document.createElement("div");
        empty.className = "activity-empty";
        empty.textContent = "No recovery points yet.";
        fragment.append(empty);
      }
      list.replaceChildren(fragment);
    }

    exportButton.addEventListener("click", () => exportBackup().catch((error) => notify?.(error.message)));
    recoveryButton.addEventListener("click", async () => {
      try { await durablePersistence.createRecovery("manual"); notify?.("Recovery point created"); await renderRecoveries(); }
      catch (error) { notify?.(error.message); }
    });
    importButton.addEventListener("click", () => importInput.click());
    importInput.addEventListener("change", async () => {
      try { await importFile(importInput.files?.[0]); await renderRecoveries(); }
      catch (error) { notify?.(error.message); }
      finally { importInput.value = ""; }
    });
    await renderRecoveries();
  }

  return Object.freeze({ exportBackup, importBackup, importFile, render, validateBackup });
}
