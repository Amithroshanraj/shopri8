/**
 * Firebase Authentication service.
 *
 * Role mapping (Phase 5):
 *
 *   customer        phone number + OTP        (no email required)
 *   retailer        email + password
 *   deliveryWorker  email + password
 *   admin           email + password
 *
 * A single Firebase account may hold several capabilities. The provider that
 * signs a user in never decides their role — the `capabilities` array on
 * `users/{uid}` does, which is what makes multi-role accounts work.
 *
 * The demo login system in `src/lib/demoAuth.ts` is untouched and still drives
 * the current portals. This module is the Firebase target that the migration
 * will switch over domain by domain.
 */

import {
  RecaptchaVerifier,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPhoneNumber,
  signOut as firebaseSignOut,
  updatePassword,
  updateProfile,
  type ConfirmationResult,
  type User,
  type UserCredential,
} from "firebase/auth";
import { getFirebaseAuth, isBrowser, isFirebaseConfigured } from "./config";

export class FirebaseNotConfiguredError extends Error {
  constructor() {
    super(
      "Firebase is not connected yet. Add the Firebase web-client values to .env.local to enable sign in.",
    );
    this.name = "FirebaseNotConfiguredError";
  }
}

/** Raised when a browser-only API is called during server rendering. */
export class FirebaseBrowserOnlyError extends Error {
  constructor(operation: string) {
    super(`Firebase Auth operation "${operation}" is browser-only and cannot run during SSR.`);
    this.name = "FirebaseBrowserOnlyError";
  }
}

function requireAuth() {
  const auth = getFirebaseAuth();
  if (!auth) throw new FirebaseNotConfiguredError();
  return auth;
}

function requireBrowser(operation: string) {
  if (!isBrowser) throw new FirebaseBrowserOnlyError(operation);
}

export { isFirebaseConfigured };

// ---------------------------------------------------------------------------
// Session observation
// ---------------------------------------------------------------------------

/**
 * Subscribes to Firebase auth state changes.
 *
 * Returns a no-op unsubscribe on the server or when unconfigured, so callers can
 * mount this unconditionally without breaking SSR.
 */
export function subscribeToAuth(callback: (user: User | null) => void): () => void {
  const auth = getFirebaseAuth();
  if (!auth || !isBrowser) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
}

export function getCurrentUser(): User | null {
  const auth = getFirebaseAuth();
  if (!auth || !isBrowser) return null;
  return auth.currentUser;
}

// ---------------------------------------------------------------------------
// Customer — phone + OTP
// ---------------------------------------------------------------------------

/**
 * Starts customer phone sign-in.
 *
 * `containerId` must reference an element that is actually in the DOM, because
 * the invisible reCAPTCHA widget mounts inside it. Phone authentication must be
 * enabled in the Firebase Console before this can succeed.
 */
export async function startPhoneSignIn(
  phoneE164: string,
  containerId: string,
): Promise<ConfirmationResult> {
  requireBrowser("startPhoneSignIn");
  const auth = requireAuth();
  const verifier = new RecaptchaVerifier(auth, containerId, { size: "invisible" });
  return signInWithPhoneNumber(auth, normalisePhoneE164(phoneE164), verifier);
}

/** Verifies the SMS code. No demo/fake code path exists here. */
export async function confirmPhoneOtp(
  confirmation: ConfirmationResult,
  code: string,
): Promise<UserCredential> {
  requireBrowser("confirmPhoneOtp");
  return confirmation.confirm(code.trim());
}

// ---------------------------------------------------------------------------
// Retailer / Delivery Worker / Admin — email + password
// ---------------------------------------------------------------------------

export async function signInWithEmail(email: string, password: string) {
  requireBrowser("signInWithEmail");
  return signInWithEmailAndPassword(requireAuth(), email.trim(), password);
}

export async function registerWithEmail(email: string, password: string) {
  requireBrowser("registerWithEmail");
  return createUserWithEmailAndPassword(requireAuth(), email.trim(), password);
}

export async function resetPassword(email: string) {
  requireBrowser("resetPassword");
  return sendPasswordResetEmail(requireAuth(), email.trim());
}

export async function changePassword(user: User, nextPassword: string) {
  requireBrowser("changePassword");
  return updatePassword(user, nextPassword);
}

export async function setDisplayName(user: User, displayName: string) {
  requireBrowser("setDisplayName");
  return updateProfile(user, { displayName: displayName.trim() });
}

export async function signOut() {
  const auth = getFirebaseAuth();
  if (!auth || !isBrowser) return;
  await firebaseSignOut(auth);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export interface UserCredentialResult {
  uid: string;
  email: string | null;
  phoneNumber: string | null;
  displayName: string | null;
}

type FirebaseUserCredential = UserCredential;

/**
 * Normalises an auth credential into the shape the user repository consumes.
 *
 * There is deliberately no `isNewUser` flag: Firebase does not report it
 * reliably for phone confirmation. Deciding "new vs returning" is done by
 * checking whether `users/{uid}` exists, which is authoritative.
 */
export function toUserCredentialResult(credential: FirebaseUserCredential): UserCredentialResult {
  const user = credential.user;
  return {
    uid: user.uid,
    email: user.email,
    phoneNumber: user.phoneNumber,
    displayName: user.displayName,
  };
}

/**
 * Normalises an Indian mobile number to the E.164 form Firebase expects.
 *
 * Accepts `9876543210`, `+91 98765 43210`, `098765 43210`. Returns the input
 * unchanged when it already looks like E.164 so no valid number is mangled.
 */
export function normalisePhoneE164(input: string): string {
  const trimmed = input.trim();
  if (trimmed.startsWith("+")) return trimmed.replace(/[\s-()]/g, "");
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  return trimmed;
}
