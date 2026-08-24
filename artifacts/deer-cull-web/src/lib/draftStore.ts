// Draft store with localStorage primary + IndexedDB fallback for large drafts
// (e.g. embedded photos that exceed the ~5MB localStorage quota).

const DB_NAME = "deercull_drafts";
const STORE_NAME = "drafts";
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
  });
}

async function idbSet(key: string, value: unknown): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function idbGet<T = unknown>(key: string): Promise<T | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(key);
    req.onsuccess = () => { db.close(); resolve(req.result as T | undefined); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

async function idbDelete(key: string): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

const TOMBSTONE = "__idb__";

export async function saveDraft(key: string, value: unknown): Promise<"local" | "idb"> {
  const json = JSON.stringify(value);
  try {
    localStorage.setItem(key, json);
    // If we previously fell back to IDB, clean it up so the two stores don't drift.
    void idbDelete(key).catch(() => {});
    return "local";
  } catch {
    // Quota exceeded (commonly large photo payloads on iOS Safari) — fall back to IDB.
    try {
      await idbSet(key, value);
      try { localStorage.setItem(key, TOMBSTONE); } catch { /* ignore */ }
      return "idb";
    } catch (err) {
      console.warn("Draft save failed (both localStorage and IndexedDB)", err);
      throw err;
    }
  }
}

export async function loadDraft<T = unknown>(key: string): Promise<T | null> {
  try {
    const raw = localStorage.getItem(key);
    if (raw && raw !== TOMBSTONE) {
      try { return JSON.parse(raw) as T; } catch { return null; }
    }
  } catch { /* ignore */ }
  try {
    const v = await idbGet<T>(key);
    return v ?? null;
  } catch {
    return null;
  }
}

export async function clearDraft(key: string): Promise<void> {
  try { localStorage.removeItem(key); } catch { /* ignore */ }
  try { await idbDelete(key); } catch { /* ignore */ }
}

export async function hasDraft(key: string): Promise<boolean> {
  try {
    const raw = localStorage.getItem(key);
    if (raw && raw !== TOMBSTONE) return true;
  } catch { /* ignore */ }
  try {
    const v = await idbGet(key);
    return v !== undefined;
  } catch {
    return false;
  }
}
