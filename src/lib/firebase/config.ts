/**
 * Firebase client configuration and single-instance app initialisation.
 *
 * Design rules enforced here:
 *
 * 1. ONE app. Every Firebase service in SHOPRi8 shares this instance. Roles are
 *    distinguished by the `capabilities` array on `users/{uid}`, never by a
 *    second Firebase app or a second project.
 * 2. SSR safe. Nothing runs at module scope and no browser-only API is touched
 *    during server rendering. On the server the accessors return `null` unless
 *    the config is explicitly usable, so a server render degrades to the local
 *    demo layer instead of crashing.
 * 3. No secrets. Only publishable web-client values are read, and they arrive
 *    through Vite env vars. Service-account keys and gateway secrets must never
 *    appear here — they belong in Cloud Functions configuration.
 */

import {
  getApp,
  getApps,
  initializeApp,
  type FirebaseApp,
  type FirebaseOptions,
} from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import { connectFirebaseEmulators } from "./emulator";
import { isBrowser, isEmulatorRequested, readEmulatorHost } from "./emulatorEnv";

export { isBrowser, isEmulatorRequested, readEmulatorHost };

export type DataSourceMode = "demo" | "firebase" | "auto";

export interface FirebaseClientConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

const env = import.meta.env as Record<string, string | undefined>;

function readEnv(key: string): string {
  const value = env[key];
  return typeof value === "string" ? value.trim() : "";
}

/** The intended Firebase project. Changing this changes the whole backend. */
export const FIREBASE_PROJECT_ID = readEnv("VITE_FIREBASE_PROJECT_ID");

/**
 * Publishable web-client values. Absent values stay empty strings so a partial
 * `.env` fails the completeness check instead of producing a half-configured app.
 */
export const firebaseClientConfig: Readonly<FirebaseClientConfig> = Object.freeze({
  apiKey: readEnv("VITE_FIREBASE_API_KEY"),
  authDomain: readEnv("VITE_FIREBASE_AUTH_DOMAIN"),
  projectId: FIREBASE_PROJECT_ID,
  storageBucket: readEnv("VITE_FIREBASE_STORAGE_BUCKET"),
  messagingSenderId: readEnv("VITE_FIREBASE_MESSAGING_SENDER_ID"),
  appId: readEnv("VITE_FIREBASE_APP_ID"),
});

/**
 * Values that must exist before the Firebase SDK can be constructed. Bucket and
 * messaging values are optional: Storage is only touched by retailer uploads
 * and messaging is not wired yet.
 */
const REQUIRED_KEYS = ["apiKey", "projectId", "appId"] as const;

const missingKeys = REQUIRED_KEYS.filter((key) => !firebaseClientConfig[key]);

/**
 * True when every required client value is present. This is the single source
 * of truth the UI uses to decide whether Firebase is usable at all.
 */
export const isFirebaseConfigured = missingKeys.length === 0;

/** Which required values are absent. Safe to log — contains no secret values. */
export const missingFirebaseKeys: readonly string[] = missingKeys;

/** True when the client should attach to the local Emulator Suite. */
const emulatorRequested = isEmulatorRequested;

/**
 * Effective data source.
 *
 * `demo`     — localStorage demo stores only, regardless of config.
 * `firebase` — Firebase is required; an incomplete config is a hard error.
 * `auto`     — Firebase when configured, otherwise the demo layer.
 */
export const dataSourceMode: DataSourceMode = ((): DataSourceMode => {
  const requested = readEnv("VITE_DATA_SOURCE").toLowerCase();
  if (requested === "demo" || requested === "firebase" || requested === "auto") {
    return requested;
  }
  return "auto";
})();

/** True when the app should read and write through Firebase. */
export const isFirebaseActive = (() => {
  if (dataSourceMode === "demo") return false;
  if (dataSourceMode === "firebase") return true;
  return isFirebaseConfigured;
})();

/**
 * Human-readable reason Firebase is unavailable, or `null` when it is usable.
 * Surfaced in developer tooling and the setup screen — never a secret value.
 */
export function firebaseUnavailableReason(): string | null {
  if (!isFirebaseConfigured) {
    return (
      `Firebase is not configured. Missing: ${missingKeys.join(", ")}. ` +
      `Copy .env.example to .env.local and fill in the web-client values.`
    );
  }
  if (dataSourceMode === "demo") {
    return "VITE_DATA_SOURCE=demo — the app is intentionally using local demo stores.";
  }
  return null;
}

const appOptions = firebaseClientConfig as unknown as FirebaseOptions;

let cachedApp: FirebaseApp | null = null;
let cachedAuth: Auth | null = null;
let cachedDb: Firestore | null = null;
let cachedStorage: FirebaseStorage | null = null;

/**
 * The single Firebase app, created on first use.
 *
 * Returns `null` when unconfigured. `getApps()` is checked first so hot module
 * reload and duplicated module instances cannot create a second app.
 */
export function getFirebaseApp(): FirebaseApp | null {
  if (!isFirebaseConfigured) return null;
  if (cachedApp) return cachedApp;
  cachedApp = getApps().length ? getApp() : initializeApp(appOptions);
  return cachedApp;
}

export function getFirebaseAuth(): Auth | null {
  const app = getFirebaseApp();
  if (!app) return null;
  if (!cachedAuth) {
    cachedAuth = getAuth(app);
    // Connect before the first Auth operation, as the SDK requires.
    connectFirebaseEmulators({ auth: cachedAuth });
  }
  return cachedAuth;
}

/**
 * @deprecated Retailer, worker and admin share the ONE auth instance above.
 * Roles are resolved from `users/{uid}.capabilities`, so a separate app is not
 * needed and must not be created. Kept only so existing callers keep compiling.
 */
export function getRetailerFirebaseAuth(): Auth | null {
  return getFirebaseAuth();
}

export function getDb(): Firestore | null {
  const app = getFirebaseApp();
  if (!app) return null;
  if (!cachedDb) {
    cachedDb = getFirestore(app);
    connectFirebaseEmulators({ db: cachedDb });
  }
  return cachedDb;
}

/**
 * Cloud Storage for retailer uploads. Catalogue images stay bundled with the
 * app and never pass through Storage.
 */
export function getFirebaseStorage(): FirebaseStorage | null {
  if (!firebaseClientConfig.storageBucket) return null;
  const app = getFirebaseApp();
  if (!app) return null;
  if (!cachedStorage) {
    cachedStorage = getStorage(app);
    connectFirebaseEmulators({ storage: cachedStorage });
  }
  return cachedStorage;
}

/** Test seam: drops memoised service instances. Never called in app code. */
export function resetFirebaseClientsForTests(): void {
  cachedApp = null;
  cachedAuth = null;
  cachedDb = null;
  cachedStorage = null;
}
