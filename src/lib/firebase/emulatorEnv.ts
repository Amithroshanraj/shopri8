/**
 * Emulator environment detection.
 *
 * Deliberately a leaf module: it imports nothing from the rest of the Firebase
 * layer, so both `config.ts` (which lazily connects emulators) and
 * `emulator.ts` (the public connector API) can depend on it without creating an
 * import cycle.
 */

const env = import.meta.env as Record<string, string | undefined>;

function readEnv(key: string): string {
  const value = env[key];
  return typeof value === "string" ? value.trim() : "";
}

/** True only in a browser document. Guards every browser-only Firebase API. */
export const isBrowser = typeof window !== "undefined" && typeof document !== "undefined";

/** True when the client should attach to the local Emulator Suite. */
export const isEmulatorRequested = readEnv("VITE_USE_FIREBASE_EMULATOR").toLowerCase() === "true";

/** Standard local emulator ports. 8081 avoids the app dev server on 8080. */
export const DEFAULT_EMULATOR_PORTS = {
  auth: 9099,
  firestore: 8081,
  storage: 9199,
} as const;

/**
 * Resolves an emulator host, falling back to the standard local port when the
 * env var is absent or malformed.
 */
export function readEmulatorHost(key: string, defaultPort: number): string {
  const raw = readEnv(key);
  const candidate = raw.includes(":") ? raw : `${raw}:${defaultPort}`;
  const port = Number(candidate.split(":")[1]);
  return Number.isFinite(port) && port > 0 ? candidate : `127.0.0.1:${defaultPort}`;
}
