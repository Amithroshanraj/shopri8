/**
 * Account linking — one Firebase UID with several sign-in methods.
 *
 * The intended shape of a SHOPRi8 account is a single Firebase user that may
 * carry a phone number, an email address and a set of capabilities:
 *
 *     users/{uid} = { uid, phone, email, capabilities: ["customer"] }
 *
 * A customer who signs up with a phone number and later adds an email should end
 * up as one account with one `users/{uid}` document, not two accounts. Firebase
 * models that with `linkWithCredential`, and it is the only safe way to do it:
 * linking never merges two existing users.
 *
 * When the credential already belongs to somebody else Firebase refuses with
 * `auth/credential-already-in-use`. That refusal is a feature and is reported to
 * the caller as `taken-elsewhere`; SHOPRi8 does not attempt to reconcile the two
 * accounts, because merging them silently would hand one person's orders, cart
 * and addresses to another.
 *
 * No screen exposes linking yet — see `linkEmailToAccount` / `linkPhoneToAccount`
 * callers. The service is implemented and exported so the profile screen can add
 * a "add email" / "add phone" section without re-deriving the safety rules.
 */

import { useCallback, useState } from "react";
import type { ConfirmationResult } from "firebase/auth";
import {
  getCurrentUser,
  linkEmailToUser,
  linkPhoneToUser,
  startPhoneLink,
  updateUserProfile,
} from "../firebase";
import { toAuthErrorMessage } from "./authErrors";
import { refreshIdentity, useFirebaseAuthSession } from "./firebaseAuthProvider";

export type LinkResult =
  | { status: "linked"; message: string }
  | { status: "already-linked"; message: string }
  | { status: "unavailable"; message: string }
  | { status: "failed"; message: string };

function credentialTakenByAnotherAccount(cause: unknown): boolean {
  const code = (cause as { code?: unknown } | null)?.code;
  return (
    code === "auth/credential-already-in-use" ||
    code === "auth/email-already-in-use" ||
    code === "auth/phone-number-already-in-use"
  );
}

function requireSignedInUser() {
  const user = getCurrentUser();
  if (!user) throw new Error("Sign in before adding another sign-in method.");
  return user;
}

/**
 * Adds an email + password to the signed-in account.
 *
 * After a successful link the `users/{uid}` document is patched so the profile
 * keeps listing every sign-in method, then the shared identity is re-read.
 */
export async function linkEmailToAccount(email: string, password: string): Promise<LinkResult> {
  try {
    const user = requireSignedInUser();
    if (user.email && user.email.toLowerCase() === email.trim().toLowerCase()) {
      return { status: "already-linked", message: "That email is already on your account." };
    }
    await linkEmailToUser(user, email, password);
    await updateUserProfile(user.uid, { email: email.trim() });
    await refreshIdentity();
    return {
      status: "linked",
      message: "Email added. You can now sign in with it.",
    };
  } catch (cause: unknown) {
    if (credentialTakenByAnotherAccount(cause)) {
      return {
        status: "failed",
        message:
          "Those details already belong to a different account. Sign in with that account, then add the new method from its profile.",
      };
    }
    return { status: "failed", message: toAuthErrorMessage(cause) };
  }
}

/**
 * Step 1 of phone linking: sends the code and returns the pending confirmation.
 *
 * The caller must keep the returned result and pass it to `linkPhoneToAccount`.
 */
export async function beginPhoneLink(
  phone: string,
  containerId: string,
): Promise<ConfirmationResult> {
  return startPhoneLink(phone, containerId);
}

/**
 * Step 2 of phone linking: confirms the code onto the signed-in account.
 */
export async function linkPhoneToAccount(
  confirmation: ConfirmationResult,
  code: string,
): Promise<LinkResult> {
  try {
    const user = requireSignedInUser();
    const credential = await linkPhoneToUser(user, confirmation, code);
    const phoneNumber = credential.user.phoneNumber;
    if (phoneNumber) await updateUserProfile(user.uid, { phone: phoneNumber });
    await refreshIdentity();
    return { status: "linked", message: "Phone number added to your account." };
  } catch (cause: unknown) {
    if (credentialTakenByAnotherAccount(cause)) {
      return {
        status: "failed",
        message:
          "That number already belongs to a different account. Sign in with it, then add your email from its profile.",
      };
    }
    return { status: "failed", message: toAuthErrorMessage(cause) };
  }
}

export interface AccountLinking {
  /** Adds an email + password to the signed-in account. */
  linkEmail: (email: string, password: string) => Promise<LinkResult>;
  /** Sends a code to a phone number the account does not have yet. */
  beginPhone: (phone: string, containerId: string) => Promise<void>;
  /** Confirms the code onto the signed-in account. */
  confirmPhone: (confirmation: ConfirmationResult, code: string) => Promise<LinkResult>;
  busy: boolean;
  pendingPhone: string | null;
  error: string | null;
  clearError: () => void;
  /** False when Firebase is not the active backend. */
  available: boolean;
}

/**
 * Account-linking actions for the signed-in account.
 *
 * Returns `available: false` on the demo backend, where there is only one
 * sign-in method and therefore nothing to link.
 */
export function useAccountLinking(): AccountLinking {
  const { identity, provider } = useFirebaseAuthSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingPhone, setPendingPhone] = useState<string | null>(null);

  const available = provider === "firebase" && identity !== null;

  const linkEmail = useCallback(async (email: string, password: string) => {
    setBusy(true);
    setError(null);
    try {
      const result = await linkEmailToAccount(email, password);
      if (result.status === "failed") setError(result.message);
      return result;
    } finally {
      setBusy(false);
    }
  }, []);

  const beginPhone = useCallback(async (phone: string, containerId: string) => {
    setBusy(true);
    setError(null);
    try {
      await beginPhoneLink(phone, containerId);
      setPendingPhone(phone.trim());
    } catch (cause: unknown) {
      setError(toAuthErrorMessage(cause));
      throw cause;
    } finally {
      setBusy(false);
    }
  }, []);

  const confirmPhone = useCallback(async (confirmation: ConfirmationResult, code: string) => {
    setBusy(true);
    setError(null);
    try {
      const result = await linkPhoneToAccount(confirmation, code);
      if (result.status === "failed") setError(result.message);
      else setPendingPhone(null);
      return result;
    } finally {
      setBusy(false);
    }
  }, []);

  return {
    linkEmail,
    beginPhone,
    confirmPhone,
    busy,
    pendingPhone,
    error,
    clearError: () => setError(null),
    available,
  };
}
