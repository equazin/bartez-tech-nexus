// IndexedDB-backed offline action queue.
// Designed for the portal so that field sellers can keep working without
// network: actions (place_order, save_quote, etc.) are persisted locally
// and drained when the connection returns.

const DB_NAME = "bartez_sync_queue";
const STORE = "actions";
const VERSION = 1;

export type SyncActionType = "place_order" | "save_quote";

export interface SyncAction<TPayload = unknown> {
  id: string;
  type: SyncActionType;
  payload: TPayload;
  createdAt: number;
  retries: number;
  lastError?: string;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB error"));
  });
}

function isSupported(): boolean {
  return typeof indexedDB !== "undefined";
}

let idCounter = 0;
function newId(): string {
  idCounter = (idCounter + 1) % 1_000_000;
  return `${Date.now()}-${String(idCounter).padStart(6, "0")}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function enqueueAction<TPayload>(
  type: SyncActionType,
  payload: TPayload,
): Promise<SyncAction<TPayload>> {
  if (!isSupported()) {
    throw new Error("IndexedDB no disponible en este navegador");
  }
  const db = await openDb();
  const action: SyncAction<TPayload> = {
    id: newId(),
    type,
    payload,
    createdAt: Date.now(),
    retries: 0,
  };
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(action);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("write error"));
  });
  db.close();
  notifyChange();
  return action;
}

export async function listActions(): Promise<SyncAction[]> {
  if (!isSupported()) return [];
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const request = tx.objectStore(STORE).getAll();
    request.onsuccess = () => {
      db.close();
      resolve(
        (request.result as SyncAction[]).sort((a, b) =>
          a.createdAt !== b.createdAt ? a.createdAt - b.createdAt : a.id.localeCompare(b.id),
        ),
      );
    };
    request.onerror = () => {
      db.close();
      reject(request.error ?? new Error("read error"));
    };
  });
}

export async function removeAction(id: string): Promise<void> {
  if (!isSupported()) return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("delete error"));
  });
  db.close();
  notifyChange();
}

export async function updateAction(action: SyncAction): Promise<void> {
  if (!isSupported()) return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(action);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("update error"));
  });
  db.close();
  notifyChange();
}

// ── Drainer ──────────────────────────────────────────────────────────────────
// Handlers are registered by the app once on bootstrap; the drainer reads them
// when processing queued actions. Keeping this out of the lib avoids a hard
// dependency on Supabase from this file.

type Handler = (payload: unknown) => Promise<void>;
const handlers = new Map<SyncActionType, Handler>();

export function registerSyncHandler<TPayload>(
  type: SyncActionType,
  handler: (payload: TPayload) => Promise<void>,
): void {
  handlers.set(type, handler as Handler);
}

const MAX_RETRIES = 5;

export interface DrainResult {
  succeeded: number;
  failed: number;
  remaining: number;
}

let isDraining = false;

export async function drainQueue(): Promise<DrainResult> {
  if (isDraining) return { succeeded: 0, failed: 0, remaining: 0 };
  isDraining = true;
  let succeeded = 0;
  let failed = 0;
  try {
    const actions = await listActions();
    for (const action of actions) {
      const handler = handlers.get(action.type);
      if (!handler) {
        failed += 1;
        continue;
      }
      try {
        await handler(action.payload);
        await removeAction(action.id);
        succeeded += 1;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Error desconocido";
        const retries = action.retries + 1;
        if (retries >= MAX_RETRIES) {
          await removeAction(action.id);
        } else {
          await updateAction({ ...action, retries, lastError: message });
        }
        failed += 1;
      }
    }
  } finally {
    isDraining = false;
  }
  const remaining = (await listActions()).length;
  return { succeeded, failed, remaining };
}

// ── Change notifications ─────────────────────────────────────────────────────
const listeners = new Set<() => void>();

export function onQueueChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notifyChange() {
  for (const listener of listeners) listener();
}
