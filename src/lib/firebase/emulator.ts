/**
 * Firebase Emulator Suite wiring.
 *
 * Everything here is browser-only and idempotent: connecting an emulator twice
 * throws inside the SDK, so each connector is guarded and only runs once per
 * page load. On the server this module is inert.
 *
 * Enable with `VITE_USE_FIREBASE_EMULATOR=true`, then run:
 *   npx firebase-tools emulators:start
 *
 * `config.ts` calls `connectFirebaseEmulators` automatically the first time a
 * Firebase service is created, so no application code needs to opt in. The
 * per-service functions stay exported for tests and manual wiring.
 */

import { connectAuthEmulator, type Auth } from "firebase/auth";
import { connectFirestoreEmulator, type Firestore } from "firebase/firestore";
import { connectStorageEmulator, type FirebaseStorage } from "firebase/storage";
import { isBrowser, isEmulatorRequested, readEmulatorHost } from "./emulatorEnv";

const connected = new Set<string>();

function claim(key: string): boolean {
  if (connected.has(key)) return false;
  connected.add(key);
  return true;
}

/** Points Auth at the local emulator. Must run before any Auth operation. */
export function connectAuth(auth: Auth): void {
  if (!isBrowser || !isEmulatorRequested) return;
  if (!claim("auth")) return;
  connectAuthEmulator(auth, `http://${readEmulatorHost("FIREBASE_AUTH_EMULATOR_HOST", 9099)}`, {
    disableWarnings: true,
  });
}

/** Points Firestore at the local emulator. */
export function connectFirestore(db: Firestore): void {
  if (!isBrowser || !isEmulatorRequested) return;
  if (!claim("firestore")) return;
  const [host, port] = readEmulatorHost("FIRESTORE_EMULATOR_HOST", 8080).split(":");
  connectFirestoreEmulator(db, `http://${host}`, Number(port));
}

/** Points Cloud Storage at the local emulator. */
export function connectStorage(storage: FirebaseStorage): void {
  if (!isBrowser || !isEmulatorRequested) return;
  if (!claim("storage")) return;
  const [host, port] = readEmulatorHost("FIREBASE_STORAGE_EMULATOR_HOST", 9199).split(":");
  connectStorageEmulator(storage, `http://${host}`, Number(port));
}

/** Connects every supplied service. Safe to call more than once. */
export function connectFirebaseEmulators(services: {
  auth?: Auth | null;
  db?: Firestore | null;
  storage?: FirebaseStorage | null;
}): void {
  if (services.auth) connectAuth(services.auth);
  if (services.db) connectFirestore(services.db);
  if (services.storage) connectStorage(services.storage);
}

/** Test seam: allows re-connection in a fresh test process. */
export function resetEmulatorConnectionsForTests(): void {
  connected.clear();
}
