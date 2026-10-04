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
 *
 * Every form of the env var has to yield a usable `host:port`. Notably an empty
 * value must become `127.0.0.1:<default>` and not `:<default>`: a bare `:9099`
 * passes a port check but is not a parseable URL, so `connectAuthEmulator` would
 * silently register `http://:9099` and every Auth call would fail with
 * `auth/network-request-failed` instead of a clear error.
 */
export function readEmulatorHost(key: string, defaultPort: number): string {
  const raw = readEnv(key);
  if (!raw) return `127.0.0.1:${defaultPort}`;
  try {
    const address = new URL(raw.includes("://") ? raw : `http://${raw}`);
    if (
      !["http:", "https:"].includes(address.protocol) ||
      !address.hostname ||
      (address.pathname !== "/" && address.pathname !== "")
    ) {
      return `127.0.0.1:${defaultPort}`;
    }
    const host = address.hostname.includes(":") ? `[${address.hostname}]` : address.hostname;
    const port = address.port ? Number(address.port) : defaultPort;
    return `${host}:${port}`;
  } catch {
    return `127.0.0.1:${defaultPort}`;
  }
}
