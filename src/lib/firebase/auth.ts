import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut as fbSignOut,
  type ConfirmationResult,
  type User,
} from "firebase/auth";
import { getFirebaseAuth, isFirebaseConfigured } from "./config";

export class FirebaseNotConfiguredError extends Error {
  constructor() {
    super("Firebase is not connected yet. Add your Firebase web config to enable sign in.");
    this.name = "FirebaseNotConfiguredError";
  }
}

function requireAuth() {
  const auth = getFirebaseAuth();
  if (!auth) throw new FirebaseNotConfiguredError();
  return auth;
}

export { isFirebaseConfigured };

/**
 * Customer sign-in: phone number + OTP. No email required.
 * `containerId` must point at an element rendered in the DOM for reCAPTCHA.
 */
export async function startPhoneSignIn(
  phoneE164: string,
  containerId: string,
): Promise<ConfirmationResult> {
  const auth = requireAuth();
  const verifier = new RecaptchaVerifier(auth, containerId, { size: "invisible" });
  return signInWithPhoneNumber(auth, phoneE164, verifier);
}

export async function confirmPhoneOtp(confirmation: ConfirmationResult, code: string) {
  return confirmation.confirm(code);
}

/** Retailer and Delivery Worker sign-in: email + password. */
export async function signInWithEmail(email: string, password: string) {
  return signInWithEmailAndPassword(requireAuth(), email, password);
}

export async function registerWithEmail(email: string, password: string) {
  return createUserWithEmailAndPassword(requireAuth(), email, password);
}

export async function signOut() {
  const auth = getFirebaseAuth();
  if (auth) await fbSignOut(auth);
}

export function subscribeToAuth(cb: (user: User | null) => void) {
  const auth = getFirebaseAuth();
  if (!auth) {
    cb(null);
    return () => {};
  }
  return onAuthStateChanged(auth, cb);
}
