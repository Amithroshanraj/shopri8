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
 * Nothing in this module is wired into the running portals yet. Phase 10 of the
 * Firebase foundation deliberately leaves every screen on the demo adapter.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";
import type { ConfirmationResult } from "firebase/auth";
import {
  confirmPhoneOtp,
  ensureUserProfile,
  fetchUser,
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
import {
  DEFAULT_CUSTOMER_CAPABILITY,
  SELF_ASSIGNABLE_CAPABILITIES,
  errorMessage,
  identityHasCapability,
  type AuthIdentity,
  type AuthSession,
} from "./types";

/** A pending phone sign-in, held between sending and verifying the SMS code. */
interface PendingPhoneSignIn {
  confirmation: ConfirmationResult;
  phone: string;
}

async function identityFromFirebaseUser(user: User): Promise<AuthIdentity> {
  const profile = await fetchUser(user.uid);
  return {
    uid: user.uid,
    displayName: profile?.name || user.displayName || "",
    email: user.email ?? profile?.email ?? null,
    phone: user.phoneNumber ?? profile?.phone ?? null,
    photoURL: profile?.profileImage ?? user.photoURL ?? null,
    // A profile that has not been created yet has no granted roles.
    capabilities: profile?.capabilities ?? [],
    provider: "firebase",
  };
}

/**
 * Subscribes to the Firebase session and resolves capabilities.
 *
 * Safe to call when Firebase is unconfigured: the session stays signed out and
 * no browser-only API is touched, so SSR and an unconfigured checkout behave the
 * same as the demo layer.
 */
export function useFirebaseAuthSession(): AuthSession & {
  signInWithPhone: (phone: string, containerId: string) => Promise<void>;
  verifyPhoneCode: (code: string) => Promise<void>;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  registerWithPassword: (
    email: string,
    password: string,
    options?: { capability?: Capability; displayName?: string },
  ) => Promise<void>;
  signOut: () => Promise<void>;
} {
  const [user, setUser] = useState<User | null>(null);
  const [identity, setIdentity] = useState<AuthIdentity | null>(null);
  const [initialising, setInitialising] = useState(isFirebaseConfigured);
  const [error, setError] = useState<string | null>(null);
  const [pendingPhone, setPendingPhone] = useState<PendingPhoneSignIn | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setInitialising(false);
      return;
    }
    let active = true;
    const unsubscribe = subscribeToAuth((nextUser) => {
      setUser(nextUser);
      if (!nextUser) {
        setIdentity(null);
        setInitialising(false);
        return;
      }
      void identityFromFirebaseUser(nextUser)
        .then((nextIdentity) => {
          if (active) setIdentity(nextIdentity);
        })
        .catch((cause: unknown) => {
          if (active) setError(errorMessage(cause, "Could not load your profile."));
        })
        .finally(() => {
          if (active) setInitialising(false);
        });
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const hasCapability = useCallback(
    (capability: Capability) => identityHasCapability(identity, capability),
    [identity],
  );

  const capabilitiesIn = useCallback(
    <T extends readonly Capability[]>(available: T) =>
      available.filter((capability) => identityHasCapability(identity, capability)),
    [identity],
  );

  const signInWithPhone = useCallback(async (phone: string, containerId: string) => {
    setError(null);
    try {
      const confirmation = await startPhoneSignIn(normalisePhoneE164(phone), containerId);
      setPendingPhone({ confirmation, phone: normalisePhoneE164(phone) });
    } catch (cause: unknown) {
      const message = errorMessage(cause, "Could not send the verification code.");
      setError(message);
      throw cause;
    }
  }, []);

  const verifyPhoneCode = useCallback(
    async (code: string) => {
      if (!pendingPhone) {
        setError("Request a verification code first.");
        throw new Error("Request a verification code first.");
      }
      setError(null);
      try {
        const credential = await confirmPhoneOtp(pendingPhone.confirmation, code);
        const result = toUserCredentialResult(credential);
        await ensureUserProfile(result.uid, {
          ...(result.phoneNumber ? { phone: result.phoneNumber } : {}),
          ...(result.displayName ? { name: result.displayName } : {}),
          capabilities: [DEFAULT_CUSTOMER_CAPABILITY],
        });
        setPendingPhone(null);
      } catch (cause: unknown) {
        const message = errorMessage(cause, "That verification code is not valid.");
        setError(message);
        throw cause;
      }
    },
    [pendingPhone],
  );

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    setError(null);
    try {
      await signInWithEmail(email, password);
    } catch (cause: unknown) {
      const message = errorMessage(cause, "Invalid email or password.");
      setError(message);
      throw cause;
    }
  }, []);

  const registerWithPassword = useCallback(
    async (
      email: string,
      password: string,
      options?: { capability?: Capability; displayName?: string },
    ) => {
      setError(null);
      try {
        const credential = await registerWithEmail(email, password);
        const result = toUserCredentialResult(credential);
        // A new account may only self-assign a customer capability. Privileged
        // roles are granted later by an admin through the same document.
        const requested = options?.capability ? [options.capability] : [];
        const capabilities = requested.filter((capability) =>
          SELF_ASSIGNABLE_CAPABILITIES.includes(capability),
        );
        await ensureUserProfile(result.uid, {
          email: result.email ?? email,
          ...(options?.displayName ? { name: options.displayName } : {}),
          capabilities,
        });
      } catch (cause: unknown) {
        const message = errorMessage(cause, "Could not create that account.");
        setError(message);
        throw cause;
      }
    },
    [],
  );

  const signOut = useCallback(async () => {
    setError(null);
    setPendingPhone(null);
    await firebaseSignOut();
  }, []);

  const status = useMemo<AuthSession["status"]>(() => {
    if (initialising) return "initialising";
    return user ? "signed-in" : "signed-out";
  }, [initialising, user]);

  return {
    status,
    identity,
    error,
    isAuthenticated: status === "signed-in",
    isInitialising: initialising,
    hasCapability,
    capabilitiesIn,
    provider: "firebase",
    signInWithPhone,
    verifyPhoneCode,
    signInWithPassword,
    registerWithPassword,
    signOut,
  };
}
