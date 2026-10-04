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
  EmailAuthProvider,
  PhoneAuthProvider,
  RecaptchaVerifier,
  createUserWithEmailAndPassword,
  linkWithCredential,
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
  if (!isBrowser) return () => {};
  const auth = getFirebaseAuth();
  if (!auth) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
}

export function getCurrentUser(): User | null {
  if (!isBrowser) return null;
  const auth = getFirebaseAuth();
  if (!auth) return null;
  return auth.currentUser;
}

// ---------------------------------------------------------------------------
// Customer — phone + OTP
// ---------------------------------------------------------------------------

/**
 * The reCAPTCHA verifier for the phone flow currently in progress.
 *
 * Kept module-scoped so a resend replaces the previous widget instead of leaking
 * a second invisible iframe, and so the UI can drop the widget when the user backs
 * out of the code step.
 */
let activeVerifier: RecaptchaVerifier | null = null;

function createVerifier(containerId: string): RecaptchaVerifier {
  clearPhoneVerification();
  const verifier = new RecaptchaVerifier(requireAuth(), containerId, { size: "invisible" });
  activeVerifier = verifier;
  return verifier;
}

/**
 * Removes the reCAPTCHA widget for an abandoned phone attempt.
 *
 * Safe to call when nothing is pending and on the server.
 */
export function clearPhoneVerification(): void {
  const verifier = activeVerifier;
  activeVerifier = null;
  if (!verifier || !isBrowser) return;
  try {
    verifier.clear();
  } catch {
    // The widget may already be gone; nothing to release.
  }
}

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
  const verifier = createVerifier(containerId);
  try {
    return await signInWithPhoneNumber(auth, normalisePhoneE164(phoneE164), verifier);
  } catch (cause: unknown) {
    // A failed send leaves no confirmation to confirm, so release the widget.
    clearPhoneVerification();
    throw cause;
  }
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
  clearPhoneVerification();
  await firebaseSignOut(auth);
}

// ---------------------------------------------------------------------------
// Account linking — one Firebase UID, several sign-in methods
// ---------------------------------------------------------------------------

/**
 * Attaches an email + password credential to the account that is already signed
 * in.
 *
 * Firebase refuses the link when the credential belongs to a different account
 * (`auth/credential-already-in-use` / `auth/email-already-in-use`), so two
 * unrelated users are never merged. The UI reports that case instead of
 * attempting a merge.
 */
export async function linkEmailToUser(user: User, email: string, password: string) {
  requireBrowser("linkEmailToUser");
  const credential = EmailAuthProvider.credential(email.trim(), password);
  return linkWithCredential(user, credential);
}

/**
 * Starts phone verification for an account that is already signed in.
 *
 * Same reCAPTCHA requirements as `startPhoneSignIn`; the returned
 * `ConfirmationResult` carries the verification id that
 * `linkPhoneToUser` needs.
 */
export async function startPhoneLink(
  phoneE164: string,
  containerId: string,
): Promise<ConfirmationResult> {
  requireBrowser("startPhoneLink");
  const auth = requireAuth();
  const verifier = createVerifier(containerId);
  try {
    return await signInWithPhoneNumber(auth, normalisePhoneE164(phoneE164), verifier);
  } catch (cause: unknown) {
    clearPhoneVerification();
    throw cause;
  }
}

/**
 * Completes phone linking for a signed-in account.
 *
 * `user` must be the account being extended — linking onto a different account
 * would silently reassign the number, which Firebase prevents here by requiring
 * an explicit `user`.
 */
export async function linkPhoneToUser(
  user: User,
  confirmation: ConfirmationResult,
  code: string,
): Promise<UserCredential> {
  requireBrowser("linkPhoneToUser");
  const verificationId = confirmation.verificationId;
  if (!verificationId) {
    throw new Error("This verification attempt expired. Request a new code.");
  }
  const credential = PhoneAuthProvider.credential(verificationId, code.trim());
  return linkWithCredential(user, credential);
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
