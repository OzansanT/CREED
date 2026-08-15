import { createCreedDocument, normalizeCreedDocument } from "./creed-document.js";
import { clamp, replaceObjectContents } from "./state-utils.js";

export const state = createCreedDocument();

export function replaceState(document) {
  return replaceObjectContents(state, normalizeCreedDocument(document));
}

export { clamp };
