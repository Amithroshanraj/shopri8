import { useCallback } from "react";
import { useDemoSession } from "@/lib/demoAuth";
import {
  cancelPhoneSignIn,
  firebaseIsActive,
  registerWithPassword,
  signInWithPassword,
  signOutOfFirebase,
  useFirebaseAuthSession,
  verifyPhoneCode,
} from "@/lib/auth";
import { toAuthErrorMessage } from "@/lib/auth/authErrors";
import type { Capability } from "@/lib/types";

export interface CustomerAuthUser {
  uid: string;
  id: string;
  displayName: string;
  phoneNumber: string;
  email?: string;
}

const CUSTOMER: Capability = "customer";

/**
 * Customer session.
 *
 * Two sign-in methods, one account shape:
 *
 *   phone + OTP    Firebase Phone Auth, invisible reCAPTCHA, then `users/{uid}`
 *                  with a self-assigned `customer` capability
 *   email + password  Firebase Email Auth, then the same `users/{uid}`
 *
 * Both produce the same `CustomerAuthUser`, so nothing downstream — cart, orders,
 * addresses, profile — has to know which method was used. A retailer or delivery
 * worker account only reaches the storefront when its `users/{uid}` actually
 * contains `customer`; possessing valid credentials is not enough.
 *
 * In demo mode this is the previous localStorage session, unchanged, including the
 * fixed OTP. That path is unreachable while `VITE_DATA_SOURCE=firebase`.
 */
export function useAuth() {
  const demo = useDemoSession("customer");
  const firebase = useFirebaseAuthSession();
  const useFirebase = firebaseIsActive();

  const identity = useFirebase ? firebase.identity : null;
  const user: CustomerAuthUser | null = useFirebase
    ? identity && firebase.hasCapability(CUSTOMER)
      ? {
          uid: identity.uid,
          id: identity.uid,
          displayName: identity.displayName,
          phoneNumber: identity.phoneNumber ?? "",
          ...(identity.email ? { email: identity.email } : {}),
        }
      : null
    : demo.session
      ? {
          uid: demo.session.userId,
          id: demo.session.userId,
          displayName: demo.session.displayName,
          phoneNumber: demo.session.phone ?? "",
          ...(demo.session.email ? { email: demo.session.email } : {}),
        }
      : null;

  const logout = useCallback(async () => {
    if (useFirebase) {
      await signOutOfFirebase();
      return;
    }
    demo.endSession();
  }, [demo, useFirebase]);

  /**
   * Starts a local demo customer session — the fixed-`123456` OTP path.
   *
   * Refuses while Firebase is the active backend, so the demo OTP can never run
   * in production configuration even if a caller forgets to branch.
   */
  const startDemoSession = useCallback(
    (input: Parameters<typeof demo.startSession>[0]) => {
      if (useFirebase) {
        throw new Error("Demo sign-in is unavailable while Firebase is active.");
      }
      demo.startSession(input);
    },
    [demo, useFirebase],
  );

  return {
    user,
    loading: useFirebase ? firebase.isInitialising : demo.loading,
    isAuthenticated: useFirebase ? user !== null : demo.isAuthenticated,
    provider: useFirebase ? ("firebase" as const) : ("demo" as const),
    accountStatus: useFirebase ? (identity?.status ?? null) : null,
    capabilities: user ? [CUSTOMER] : [],
    /** Phone + OTP. Resolves once the code has been sent. */
    requestPhoneCode: firebase.signInWithPhone,
    /** Confirms the OTP and self-assigns the customer capability. */
    confirmPhoneCode: firebase.verifyPhoneCode,
    /** Abandons a pending phone attempt and releases the reCAPTCHA widget. */
    cancelPhoneCode: cancelPhoneSignIn,
    /** Email + password. */
    signInWithPassword,
    /** Creates a customer account. Never self-assigns a privileged role. */
    registerWithPassword,
    logout,
    startDemoSession,
    error: useFirebase ? firebase.error : null,
  };
}

/** Message helper for screens that catch their own errors. */
export function customerAuthErrorMessage(cause: unknown): string {
  return toAuthErrorMessage(cause);
}
