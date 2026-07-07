export type SyncState = "idle" | "syncing" | "offline" | "error";

class SyncStatusStore {
  pendingCount = $state(0);
  online = $state(typeof navigator === "undefined" ? true : navigator.onLine);
  lastSyncAt = $state<string | null>(null);
  state = $state<SyncState>("idle");
}

export const syncStatus = new SyncStatusStore();

export interface ConflictEvent {
  entity: string;
  entityId: string;
  name?: string;
}

type ConflictListener = (event: ConflictEvent) => void;
const conflictListeners = new Set<ConflictListener>();

export function onConflict(listener: ConflictListener): () => void {
  conflictListeners.add(listener);
  return () => conflictListeners.delete(listener);
}

export function emitConflict(event: ConflictEvent): void {
  for (const listener of conflictListeners) listener(event);
}

// Fired after every successful pull_changes apply, so stores know to
// re-read their domain from Dexie (cross-device / realtime-driven changes
// don't otherwise have a way to reach store state).
type SyncedListener = () => void;
const syncedListeners = new Set<SyncedListener>();

export function onSynced(listener: SyncedListener): () => void {
  syncedListeners.add(listener);
  return () => syncedListeners.delete(listener);
}

export function emitSynced(): void {
  for (const listener of syncedListeners) listener();
}
