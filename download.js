import { safeDownloadName, safeMimeType } from "./security.js";

export function downloadTextFile(fileName, content, type = "text/plain") {
  const blob = new Blob([String(content)], { type: safeMimeType(type) });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = safeDownloadName(fileName);
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
