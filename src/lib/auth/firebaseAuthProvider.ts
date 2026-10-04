/**
 * Firebase authentication adapter.
 *
 * Satisfies the same `AuthSession` contract as the demo adapter, backed by
 * Firebase Auth for credentials and `users/{uid}` for capabilities.
 *
 * Capability resolution is the important part:
 *
 *   - The credential provider (phone vs email) does NOT decide the role.
 *   - `users/{uid}.capabilities` is the single source of truth.
 *   - On first sign-in a profile document is created with only the capabilities
 *     the caller is allowed to self-assign — `customer` for phone sign-in.
 *     Privileged roles are granted by an admin, and the Firestore security rules
 *     reject a self-write that tries to grant more than `customer`.
 *
 * The session lives in a module-scoped external store rather than React state so
 * that the customer gate, all three portal shells and the sign-in screens share
 * one `onAuthStateChanged` subscription and one resolved identity. Several
 * copies of this state would disagree mid-sign-in.
 *
 * Server rendering never reads a session: the server snapshot stays
 * `initialising`, so no protected markup is emitted and hydration agrees with
 * the first client render.
 */

import { useCallback, useSyncExternalStore } from "react";
import type { ConfirmationResult, User } from "firebase/auth";
import {
  clearPhoneVerification,
  confirmPhoneOtp,
  isBrowser,
  isFirebaseConfigured,
  normalisePhoneE164,
  registerWithEmail,
  signInWithEmail,
  signOut as firebaseSignOut,
  startPhoneSignIn,
  subscribeToAuth,
  toUserCredentialResult,
} from "../firebase";
import type { Capability } from "../types";
import { userRepository } from "../repositories/userRepository";
import { toAuthErrorMessage } from "./authErrors";
import {
  DEFAULT_CUSTOMER_CAPABILITY,
  identityHasCapability,
  type AuthIdentity,
  type AuthSession,
  type AuthStatus,
} from "./types";

/** A pending phone sign-in, held between sending and verifying the SMS code. */
export interface PendingPhoneSignIn {
  confirmation: ConfirmationResult;
  phone: string;
}

interface FirebaseAuthState {
  status: AuthStatus;
  identity: AuthIdentity | null;
  error: string | null;
  pendingPhone: PendingPhoneSignIn | null;
}

const INITIAL_STATE: FirebaseAuthState = {
  status: isFirebaseConfigured ? "initialising" : "signed-out",
  identity: null,
  error: null,
  pendingPhone: null,
};

/**
 * The snapshot used during server rendering and for the client's first render.
 *
 * A constant, so `useSyncExternalStore` sees a stable value and hydration does
 * not mismatch while the real session is still being resolved.
 */
const SERVER_STATE: FirebaseAuthState = {
  status: isFirebaseConfigured ? "initialising" : "signed-out",
  identity: null,
  error: null,
  pendingPhone: null,
};

let state: FirebaseAuthState = INITIAL_STATE;
const listeners = new Set<() => void>();
let unsubscribe: (() => void) | null = null;
/** The Firebase user behind `state`. Never exposed to consumers. */
let currentUser: User | null = null;
let authChangeId = 0;

function emit(patch: Partial<FirebaseAuthState>): void {
  state = { ...state, ...patch };
  for (const listener of listeners) listener();
}

async function identityFromFirebaseUser(user: User): Promise<AuthIdentity> {
  let result = await userRepository.getUserProfile(user.uid);
  if (!result.ok) throw new Error(result.message);
  let profile = result.data;
  if (!profile) {
    const created = await userRepository.createUserProfile(user.uid, {
      displayName: user.displayName || "",
      ...(user.email ? { email: user.email } : {}),
      ...(user.phoneNumber ? { phoneNumber: user.phoneNumber } : {}),
      ...(user.photoURL ? { photoURL: user.photoURL } : {}),
    });
    if (!created.ok) throw new Error(created.message);
    result = await userRepository.getUserProfile(user.uid);
    if (!result.ok) throw new Error(result.message);
    profile = result.data;
  } else if (profile.status === "active") {
    const displayName = user.displayName || profile.displayName || profile.name;
    const email = user.email ?? profile.email;
    const phoneNumber = user.phoneNumber ?? profile.phoneNumber ?? profile.phone;
    const photoURL = user.photoURL ?? profile.photoURL ?? profile.profileImage;
    const migrated = await userRepository.ensure(user.uid, {
      ...(displayName ? { displayName } : {}),
      ...(email ? { email } : {}),
      ...(phoneNumber ? { phoneNumber } : {}),
      ...(photoURL ? { photoURL } : {}),
    });
    if (!migrated.ok) throw new Error(migrated.message);
    result = await userRepository.getUserProfile(user.uid);
    if (!result.ok) throw new Error(result.message);
    profile = result.data;
  }
  if (!profile) throw new Error("Your account profile could not be created.");
  return {
    uid: user.uid,
    displayName: profile.displayName || user.displayName || "",
    email: user.email ?? profile.email,
    phoneNumber: user.phoneNumber ?? profile.phoneNumber,
    phone: user.phoneNumber ?? profile.phoneNumber,
    photoURL: user.photoURL ?? profile.photoURL,
    capabilities: profile.capabilities,
    status: profile.status,
    provider: "firebase",
  };
}

/**
 * Starts observing Firebase Auth exactly once.
 *
 * `subscribeToAuth` is a no-op on the server and when Firebase is unconfigured,
 * so nothing browser-only is touched during SSR.
 */
function ensureStarted(): void {
  if (unsubscribe || !isBrowser || !isFirebaseConfigured) return;
  unsubscribe = subscribeToAuth((user) => {
    const changeId = ++authChangeId;
    currentUser = user;
    if (!user) {
      emit({ status: "signed-out", identity: null, pendingPhone: null });
      return;
    }
    emit({ status: "initialising", identity: null, error: null });
    void identityFromFirebaseUser(user)
      .then((identity) => {
        if (changeId !== authChangeId || currentUser?.uid !== user.uid) return;
        emit({ status: "signed-in", identity });
      })
      .catch((cause: unknown) => {
        if (changeId !== authChangeId || currentUser?.uid !== user.uid) return;
        // Signed in, but the profile could not be read. No capabilities means no
        // portal access, which is the safe outcome.
        emit({
          status: "signed-in",
          identity: null,
          error: toAuthErrorMessage(cause),
        });
      });
  });
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  ensureStarted();
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): FirebaseAuthState {
  return state;
}

function getServerSnapshot(): FirebaseAuthState {
  return SERVER_STATE;
}

/** Re-reads `users/{uid}` for the signed-in account. */
export async function refreshIdentity(): Promise<void> {
  const user = currentUser;
  const changeId = authChangeId;
  if (!user || !isBrowser) return;
  const identity = await identityFromFirebaseUser(user);
  if (changeId !== authChangeId || currentUser?.uid !== user.uid) return;
  emit({ status: "signed-in", identity });
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/**
 * Re-throws a Firebase failure as a plain Error carrying the readable message.
 *
 * The `FirebaseError` itself says things like `Firebase: Error
 * (auth/invalid-verification-code).`, which is meant for developers. A screen that
 * shows `error.message` directly would leak that string to customers, so every
 * action below normalises the message once and throws that instead. The original
 * error is kept as `cause` for logging.
 */
function throwReadable(cause: unknown, fallback: string): never {
  const message = toAuthErrorMessage(cause, fallback);
  emit({ error: message });
  throw new Error(message, { cause });
}

/** Starts customer phone sign-in. Resolves once the SMS code has been sent. */
export async function signInWithPhone(phone: string, containerId: string): Promise<void> {
  emit({ error: null });
  try {
    const normalised = normalisePhoneE164(phone);
    const confirmation = await startPhoneSignIn(normalised, containerId);
    emit({ pendingPhone: { confirmation, phone: normalised } });
  } catch (cause: unknown) {
    emit({ pendingPhone: null });
    throwReadable(cause, "Could not send the verification code.");
  }
}

/** Confirms the SMS code and self-assigns the customer capability. */
export async function verifyPhoneCode(code: string): Promise<void> {
  const pending = state.pendingPhone;
  if (!pending) {
    const error = new Error("Request a verification code first.");
    emit({ error: error.message });
    throw error;
  }
  emit({ error: null });
  try {
    const credential = await confirmPhoneOtp(pending.confirmation, code);
    const result = toUserCredentialResult(credential);
    const ensured = await userRepository.ensure(result.uid, {
      ...(result.email ? { email: result.email } : {}),
      ...(result.phoneNumber ? { phoneNumber: result.phoneNumber } : {}),
      ...(result.displayName ? { displayName: result.displayName } : {}),
    });
    if (!ensured.ok) throw new Error(ensured.message);
    await credential.user.getIdToken(true);
    emit({ pendingPhone: null });
    await refreshIdentity();
  } catch (cause: unknown) {
    throwReadable(cause, "That verification code is not valid.");
  }
}

/** Drops a pending phone attempt and releases the reCAPTCHA widget. */
export function cancelPhoneSignIn(): void {
  clearPhoneVerification();
  emit({ pendingPhone: null, error: null });
}

export async function signInWithPassword(email: string, password: string): Promise<void> {
  emit({ error: null });
  try {
    await signInWithEmail(email, password);
    await refreshIdentity();
  } catch (cause: unknown) {
    throwReadable(cause, "Could not sign in with those details.");
  }
}

/**
 * Creates an email account.
 *
 * A new account may only self-assign a customer capability. Privileged roles are
 * granted later by an admin through the same document.
 */
export async function registerWithPassword(
  email: string,
  password: string,
  options?: { capability?: typeof DEFAULT_CUSTOMER_CAPABILITY; displayName?: string },
): Promise<void> {
  emit({ error: null });
  try {
    const credential = await registerWithEmail(email, password);
    const result = toUserCredentialResult(credential);
    const ensured = await userRepository.ensure(result.uid, {
      email: result.email ?? email,
      ...(options?.displayName ? { displayName: options.displayName } : {}),
    });
    if (!ensured.ok) throw new Error(ensured.message);
    await credential.user.getIdToken(true);
    await refreshIdentity();
  } catch (cause: unknown) {
    throwReadable(cause, "Could not create that account.");
  }
}

export async function signOut(): Promise<void> {
  emit({ error: null, pendingPhone: null });
  clearPhoneVerification();
  await firebaseSignOut();
  currentUser = null;
  authChangeId += 1;
  emit({ status: "signed-out", identity: null });
}

export function clearError(): void {
  if (state.error) emit({ error: null });
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface FirebaseAuthSession extends AuthSession {
  signInWithPhone: typeof signInWithPhone;
  verifyPhoneCode: typeof verifyPhoneCode;
  cancelPhoneSignIn: typeof cancelPhoneSignIn;
  signInWithPassword: typeof signInWithPassword;
  registerWithPassword: typeof registerWithPassword;
  signOut: typeof signOut;
  clearError: typeof clearError;
  refreshIdentity: typeof refreshIdentity;
  pendingPhone: PendingPhoneSignIn | null;
}

/**
 * The shared Firebase session, plus the actions that change it.
 *
 * Safe to call when Firebase is unconfigured: the session stays signed out and no
 * browser-only API is touched, so SSR and an unconfigured checkout behave the
 * same as the demo layer.
 */
export function useFirebaseAuthSession(): FirebaseAuthSession {
  const current = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const hasCapability = useCallback(
    (capability: Capability) => identityHasCapability(current.identity, capability),
    [current.identity],
  );

  const capabilitiesIn = useCallback(
    <T extends readonly Capability[]>(available: T) =>
      available.filter((capability) => identityHasCapability(current.identity, capability)),
    [current.identity],
  );

  return {
    status: current.status,
    identity: current.identity,
    error: current.error,
    isAuthenticated:
      current.status === "signed-in" &&
      current.identity !== null &&
      current.identity.status === "active",
    isInitialising: current.status === "initialising",
    hasCapability,
    capabilitiesIn,
    provider: "firebase",
    signInWithPhone,
    verifyPhoneCode,
    cancelPhoneSignIn,
    signInWithPassword,
    registerWithPassword,
    signOut,
    clearError,
    refreshIdentity,
    pendingPhone: current.pendingPhone,
  };
}
