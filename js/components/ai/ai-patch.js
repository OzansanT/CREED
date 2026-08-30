export const AI_PATCH_SCHEMA_VERSION = 1;

export function hashPatchContent(value) {
  let hash = 2166136261;
  const text = String(value ?? "");
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function normalizeAIPatch(value) {
  if (!value || typeof value !== "object") throw new TypeError("AI patch must be an object.");
  const version = Number(value.version ?? AI_PATCH_SCHEMA_VERSION);
  if (version !== AI_PATCH_SCHEMA_VERSION) throw new Error("Unsupported AI patch version.");
  if (!Array.isArray(value.files) || !value.files.length) throw new Error("AI patch must contain files.");
  const files = value.files.map((entry) => {
    if (!entry || typeof entry !== "object" || typeof entry.path !== "string") throw new Error("AI patch file requires a path.");
    const operation = ["write", "delete"].includes(entry.operation) ? entry.operation : "write";
    if (operation === "write" && typeof entry.content !== "string") throw new Error(`AI patch write requires string content: ${entry.path}`);
    return Object.freeze({
      path: entry.path,
      operation,
      ...(operation === "write" ? { content: entry.content } : {}),
      ...(typeof entry.beforeHash === "string" ? { beforeHash: entry.beforeHash } : {})
    });
  });
  const duplicates = files.map((entry) => entry.path).filter((path, index, all) => all.indexOf(path) !== index);
  if (duplicates.length) throw new Error("AI patch contains duplicate file paths: " + [...new Set(duplicates)].join(", "));
  return Object.freeze({ version, title: String(value.title || "AI patch"), description: String(value.description || ""), files });
}

export async function inspectAIPatch(patchValue, workspace) {
  const patch = normalizeAIPatch(patchValue);
  const files = [];
  for (const entry of patch.files) {
    const exists = workspace.hasFile?.(entry.path) || false;
    let before = "";
    if (exists) before = await workspace.readFile(entry.path);
    if (entry.beforeHash && hashPatchContent(before) !== entry.beforeHash) {
      throw new Error(`AI patch is stale for ${entry.path}; source changed after proposal.`);
    }
    const after = entry.operation === "delete" ? "" : entry.content;
    files.push(Object.freeze({
      ...entry,
      exists,
      before,
      after
    }));
  }
  return Object.freeze({ patch, files });
}

export async function applyAIPatch(patchValue, workspace, { approved = false } = {}) {
  if (!approved) throw new Error("AI patch requires explicit approval before mutation.");
  const inspection = await inspectAIPatch(patchValue, workspace);
  for (const entry of inspection.files) {
    if (entry.operation === "delete") {
      if (workspace.hasFile?.(entry.path)) workspace.deleteFile(entry.path);
      continue;
    }
    if (workspace.hasFile?.(entry.path)) workspace.writeFile(entry.path, entry.content);
    else workspace.createFile(entry.path, entry.content);
  }
  return inspection.files.map((entry) => ({ path: entry.path, operation: entry.operation }));
}

function renderPatchPreview(file) {
  const pre = document.createElement("pre");
  Object.assign(pre.style, { maxHeight: "230px", overflow: "auto", margin: "4px 0 8px", fontSize: "11px", whiteSpace: "pre" });
  if (file.operation === "delete") {
    pre.textContent = file.before || "(empty file)";
    return pre;
  }
  pre.textContent = file.after || "(empty file)";
  return pre;
}

export async function renderPatchApproval({ container, patch, workspace, onApprove, onReject } = {}) {
  if (!container) throw new TypeError("Patch approval requires a container.");
  const inspection = await inspectAIPatch(patch, workspace);
  const root = document.createElement("section");
  root.className = "ai-patch-approval";
  root.dataset.patchStatus = "pending";
  const heading = document.createElement("strong");
  heading.textContent = inspection.patch.title;
  const description = document.createElement("p");
  description.textContent = inspection.patch.description || `${inspection.files.length} file change(s)`;
  root.append(heading, description);

  for (const file of inspection.files) {
    const fileHeading = document.createElement("div");
    fileHeading.textContent = `${file.operation.toUpperCase()} ${file.path}`;
    root.append(fileHeading, renderPatchPreview(file));
  }

  const actions = document.createElement("div");
  actions.className = "toolbar";
  const approve = document.createElement("button");
  approve.type = "button";
  approve.textContent = "Approve Patch";
  approve.dataset.patchAction = "approve";
  const reject = document.createElement("button");
  reject.type = "button";
  reject.textContent = "Reject";
  reject.dataset.patchAction = "reject";
  actions.append(approve, reject);
  root.append(actions);
  container.append(root);

  approve.addEventListener("click", async () => {
    if (root.dataset.patchStatus !== "pending") return;
    try {
      await onApprove?.(inspection.patch, inspection);
      root.dataset.patchStatus = "approved";
      approve.disabled = true;
      reject.disabled = true;
    } catch (error) {
      root.dataset.patchStatus = "failed";
      throw error;
    }
  });
  reject.addEventListener("click", () => {
    if (root.dataset.patchStatus !== "pending") return;
    root.dataset.patchStatus = "rejected";
    approve.disabled = true;
    reject.disabled = true;
    onReject?.(inspection.patch, inspection);
  });
  return root;
}
