/**
 * Delivery-worker preferences that are not part of authentication.
 *
 * `available` and `deliveryModes` describe how a worker operates, not who they are.
 * Under Firebase the account itself lives in Firebase Auth and `users/{uid}`, so
 * there is nowhere server-side to keep them without widening the security rules —
 * and they carry no authority: a worker's ability to claim a task is enforced by
 * the Firestore rules, not by this flag.
 *
 * They are therefore stored per uid in localStorage, which mirrors how the demo
 * session kept them in its metadata, and broadcast to every mounted copy of the
 * hook through the same subscription pattern `demoAuth` uses.
 */

export type DeliveryMode = "Walking" | "Bicycle" | "Two-Wheeler";

export interface WorkerPreferences {
  deliveryModes: DeliveryMode[];
  available: boolean;
}

const STORAGE_KEY = "shopri8.worker.prefs.v1";
const UPDATED_EVENT = "shopri8:worker-prefs-updated";
const ALL_MODES: DeliveryMode[] = ["Walking", "Bicycle", "Two-Wheeler"];
const DEFAULT_PREFERENCES: WorkerPreferences = {
  deliveryModes: [...ALL_MODES],
  available: true,
};

let snapshot: Record<string, WorkerPreferences> = {};
let loaded = false;
const listeners = new Set<() => void>();

function isDeliveryMode(value: unknown): value is DeliveryMode {
  return typeof value === "string" && ALL_MODES.includes(value as DeliveryMode);
}

function parse(raw: string | null): Record<string, WorkerPreferences> {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return {};
    const result: Record<string, WorkerPreferences> = {};
    for (const [uid, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value !== "object" || value === null) continue;
      const entry = value as Partial<WorkerPreferences>;
      const deliveryModes = Array.isArray(entry.deliveryModes)
        ? entry.deliveryModes.filter(isDeliveryMode)
        : [...DEFAULT_PREFERENCES.deliveryModes];
      result[uid] = {
        deliveryModes: deliveryModes.length
          ? deliveryModes
          : [...DEFAULT_PREFERENCES.deliveryModes],
        available: entry.available !== false,
      };
    }
    return result;
  } catch {
    return {};
  }
}

function load(): void {
  if (loaded) return;
  loaded = true;
  if (typeof window === "undefined") return;
  try {
    snapshot = parse(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    snapshot = {};
  }
}

function persist(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Preferences are a convenience; losing them must not break sign-in.
  }
}

function emit(): void {
  snapshot = { ...snapshot };
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  load();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): Record<string, WorkerPreferences> {
  load();
  return snapshot;
}

/** Reads one worker's preferences. Safe on the server. */
export function readWorkerPreferences(uid: string): WorkerPreferences {
  const stored = getSnapshot()[uid];
  return stored
    ? { deliveryModes: [...stored.deliveryModes], available: stored.available }
    : { ...DEFAULT_PREFERENCES, deliveryModes: [...DEFAULT_PREFERENCES.deliveryModes] };
}

/** Merges a patch into one worker's preferences and notifies every listener. */
export function writeWorkerPreferences(uid: string, patch: Partial<WorkerPreferences>): void {
  load();
  const next = { ...readWorkerPreferences(uid), ...patch };
  snapshot = { ...snapshot, [uid]: next };
  persist();
  emit();
  if (typeof window !== "undefined") {
    try {
      window.dispatchEvent(new Event(UPDATED_EVENT));
    } catch {
      // Subscribers are already notified through the store; the event is a bonus
      // for non-React listeners.
    }
  }
}

/** `useSyncExternalStore` bindings, for hooks. */
export function subscribeToWorkerPreferences(listener: () => void): () => void {
  return subscribe(listener);
}

export function workerPreferencesSnapshot(): Record<string, WorkerPreferences> {
  return getSnapshot();
}
