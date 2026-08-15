const DATABASE_NAME = "creed-workbench";
const DATABASE_VERSION = 1;
const STORE_NAME = "keyval";
const memory = new Map();

function requestPromise(request) {
  return new Promise((resolve, reject) => {
    request.addEventListener("success", () => resolve(request.result), { once: true });
    request.addEventListener("error", () => reject(request.error || new Error("IndexedDB request failed")), { once: true });
  });
}

function openDatabase() {
  if (!globalThis.indexedDB) return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.addEventListener("upgradeneeded", () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME);
    });
    request.addEventListener("success", () => resolve(request.result), { once: true });
    request.addEventListener("error", () => reject(request.error || new Error("Unable to open IndexedDB")), { once: true });
    request.addEventListener("blocked", () => reject(new Error("IndexedDB upgrade is blocked by another CREED tab")), { once: true });
  });
}

export function createIndexedDatabase() {
  let databasePromise = null;

  function database() {
    databasePromise ||= openDatabase().catch(() => null);
    return databasePromise;
  }

  async function transaction(mode, operation) {
    const db = await database();
    if (!db) return operation(null);
    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);
    const completed = new Promise((resolve, reject) => {
      tx.addEventListener("complete", resolve, { once: true });
      tx.addEventListener("abort", () => reject(tx.error || new Error("IndexedDB transaction aborted")), { once: true });
      tx.addEventListener("error", () => reject(tx.error || new Error("IndexedDB transaction failed")), { once: true });
    });
    const result = await operation(store);
    await completed;
    return result;
  }

  return Object.freeze({
    async get(key) {
      const db = await database();
      if (!db) return structuredClone(memory.get(key));
      return transaction("readonly", (store) => requestPromise(store.get(key)));
    },
    async set(key, value) {
      const copy = structuredClone(value);
      const db = await database();
      if (!db) { memory.set(key, copy); return true; }
      await transaction("readwrite", (store) => requestPromise(store.put(copy, key)));
      return true;
    },
    async delete(key) {
      const db = await database();
      if (!db) return memory.delete(key);
      await transaction("readwrite", (store) => requestPromise(store.delete(key)));
      return true;
    },
    async entries(prefix = "") {
      const db = await database();
      if (!db) return [...memory.entries()].filter(([key]) => String(key).startsWith(prefix)).map(([key, value]) => [key, structuredClone(value)]);
      return transaction("readonly", async (store) => {
        const keysRequest = store.getAllKeys();
        const valuesRequest = store.getAll();
        const [keys, values] = await Promise.all([requestPromise(keysRequest), requestPromise(valuesRequest)]);
        return keys.map((key, index) => [key, values[index]]).filter(([key]) => String(key).startsWith(prefix));
      });
    },
    async clear() {
      const db = await database();
      if (!db) { memory.clear(); return true; }
      await transaction("readwrite", (store) => requestPromise(store.clear()));
      return true;
    },
    isPersistent: async () => Boolean(await database())
  });
}
