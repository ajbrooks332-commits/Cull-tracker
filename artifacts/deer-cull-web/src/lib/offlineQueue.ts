/**
 * Offline queue backed by IndexedDB.
 *
 * Stores pending culls and pending assessments locally when the device has no
 * network connection.  When connectivity returns the queues are flushed to the
 * API automatically.
 */

const DB_NAME = "deer-cull-offline";
const DB_VERSION = 2;        // bumped from 1 → 2 to add assessments store
const CULL_STORE = "pending-culls";
const ASSESSMENT_STORE = "pending-assessments";

export interface PendingCull {
  localId: string;
  displayId: number;
  payload: {
    stalkerId?: number | null;
    species: string;
    sex: string;
    weight?: number | null;
    condition: string;
    pregnant?: boolean | null;
    latitude: number;
    longitude: number;
    notes?: string | null;
    culledAt: string;
  };
  stalkerName: string | null;
  queuedAt: string;
  attempts: number;
}

export interface PendingAssessment {
  localId: string;
  payload: Record<string, unknown>;
  queuedAt: string;
  attempts: number;
}

// ── DB helpers ──────────────────────────────────────────────────────────────

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(CULL_STORE)) {
        db.createObjectStore(CULL_STORE, { keyPath: "localId" });
      }
      if (!db.objectStoreNames.contains(ASSESSMENT_STORE)) {
        db.createObjectStore(ASSESSMENT_STORE, { keyPath: "localId" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(
  db: IDBDatabase,
  storeName: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = db.transaction(storeName, mode);
    const req = fn(t.objectStore(storeName));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function getAll<T>(db: IDBDatabase, storeName: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const t = db.transaction(storeName, "readonly");
    const req = t.objectStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(req.error);
  });
}

// ── Cull queue ──────────────────────────────────────────────────────────────

export async function enqueue(
  payload: PendingCull["payload"],
  stalkerName: string | null
): Promise<PendingCull> {
  const item: PendingCull = {
    localId: crypto.randomUUID(),
    displayId: -(Date.now() + Math.floor(Math.random() * 1000)),
    payload,
    stalkerName,
    queuedAt: new Date().toISOString(),
    attempts: 0,
  };
  const db = await openDB();
  await tx(db, CULL_STORE, "readwrite", store => store.add(item));
  return item;
}

export async function getPending(): Promise<PendingCull[]> {
  const db = await openDB();
  const all = await getAll<PendingCull>(db, CULL_STORE);
  return all.sort((a, b) => new Date(a.queuedAt).getTime() - new Date(b.queuedAt).getTime());
}

export async function dequeue(localId: string): Promise<void> {
  const db = await openDB();
  await tx(db, CULL_STORE, "readwrite", store => store.delete(localId));
}

export async function incrementAttempts(localId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction(CULL_STORE, "readwrite");
    const store = t.objectStore(CULL_STORE);
    const getReq = store.get(localId);
    getReq.onsuccess = () => {
      const item = getReq.result as PendingCull;
      if (item) {
        item.attempts += 1;
        store.put(item);
      }
      resolve();
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

export interface FlushResult {
  succeeded: number;
  failed: number;
  lastError: string | null;
}

export async function flushQueue(
  apiPost: (payload: PendingCull["payload"]) => Promise<unknown>
): Promise<FlushResult> {
  const pending = await getPending();
  let succeeded = 0;
  let failed = 0;
  let lastError: string | null = null;
  for (const item of pending) {
    try {
      await apiPost(item.payload);
      await dequeue(item.localId);
      succeeded++;
    } catch (err) {
      await incrementAttempts(item.localId);
      failed++;
      lastError = err instanceof Error ? err.message : String(err);
    }
  }
  return { succeeded, failed, lastError };
}

// ── Assessment queue ────────────────────────────────────────────────────────

export async function enqueueAssessment(
  payload: Record<string, unknown>
): Promise<PendingAssessment> {
  const item: PendingAssessment = {
    localId: crypto.randomUUID(),
    payload,
    queuedAt: new Date().toISOString(),
    attempts: 0,
  };
  const db = await openDB();
  await tx(db, ASSESSMENT_STORE, "readwrite", store => store.add(item));
  return item;
}

export async function getPendingAssessments(): Promise<PendingAssessment[]> {
  const db = await openDB();
  const all = await getAll<PendingAssessment>(db, ASSESSMENT_STORE);
  return all.sort((a, b) => new Date(a.queuedAt).getTime() - new Date(b.queuedAt).getTime());
}

export async function dequeueAssessment(localId: string): Promise<void> {
  const db = await openDB();
  await tx(db, ASSESSMENT_STORE, "readwrite", store => store.delete(localId));
}

async function incrementAssessmentAttempts(localId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction(ASSESSMENT_STORE, "readwrite");
    const store = t.objectStore(ASSESSMENT_STORE);
    const getReq = store.get(localId);
    getReq.onsuccess = () => {
      const row = getReq.result as PendingAssessment;
      if (row) { row.attempts += 1; store.put(row); }
      resolve();
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

export async function flushAssessmentQueue(
  apiPost: (payload: Record<string, unknown>) => Promise<unknown>
): Promise<FlushResult> {
  const pending = await getPendingAssessments();
  let succeeded = 0;
  let failed = 0;
  let lastError: string | null = null;
  for (const item of pending) {
    try {
      await apiPost(item.payload);
      await dequeueAssessment(item.localId);
      succeeded++;
    } catch (err) {
      await incrementAssessmentAttempts(item.localId);
      failed++;
      lastError = err instanceof Error ? err.message : String(err);
    }
  }
  return { succeeded, failed, lastError };
}
