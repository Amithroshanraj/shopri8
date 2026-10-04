import { useCallback, useMemo, useState } from "react";
import type { Capability } from "./types";
import { useDemoSession } from "./demoAuth";
import { getCurrentUser, setDisplayName, updateUserProfile } from "./firebase";
import {
  firebaseIsActive,
  refreshIdentity,
  signInForPortal,
  signOutOfFirebase,
  useFirebaseAuthSession,
} from "./auth";
import { toAuthErrorMessage } from "./auth/authErrors";

export interface RetailerCredentials {
  email: string;
  password: string;
}

export interface RetailerUser {
  uid: string;
  id: string;
  email: string;
  displayName: string;
  name: string;
  phoneNumber?: string | null;
  phone?: string | null;
  capabilities: Capability[];
}

export interface RetailerAuthState {
  user: RetailerUser | null;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  isRetailer: boolean;
}

/**
 * Demo credentials. Only reachable when `VITE_DATA_SOURCE=demo`; the Firebase path
 * authenticates against Firebase Auth and ignores these entirely.
 */
export const DEMO_RETAILER_CREDENTIALS = {
  email: "retailer@greenbasket.com",
  password: "retailer123",
} as const;

export const DEFAULT_DEMO_RETAILER: RetailerUser = {
  uid: "demo-retailer-1",
  id: "demo-retailer-1",
  email: DEMO_RETAILER_CREDENTIALS.email,
  displayName: "Green Basket Grocers",
  name: "Green Basket Grocers",
  phoneNumber: "+91 98765 43210",
  phone: "+91 98765 43210",
  capabilities: ["retailer"],
};

function retailerFromIdentity(identity: {
  uid: string;
  displayName: string;
  email: string | null;
  phone: string | null;
  capabilities: Capability[];
}): RetailerUser {
  return {
    uid: identity.uid,
    id: identity.uid,
    email: identity.email ?? "",
    displayName: identity.displayName || "Retailer",
    name: identity.displayName || "Retailer",
    ...(identity.phone ? { phoneNumber: identity.phone, phone: identity.phone } : {}),
    capabilities: identity.capabilities,
  };
}

/**
 * Retailer session.
 *
 * `isRetailer` is true only when the signed-in Firebase account holds the
 * `retailer` capability on `users/{uid}`. Firebase verifying an email and password
 * is not sufficient — `signInForPortal` signs the account back out and refuses if
 * the capability is missing, so the retailer portal stays closed to customers.
 */
export function useRetailerAuth() {
  const demo = useDemoSession("retailer");
  const firebase = useFirebaseAuthSession();
  const useFirebase = firebaseIsActive();
  const [error, setError] = useState<string | null>(null);

  const firebaseUser = useMemo(
    () =>
      useFirebase && firebase.identity?.capabilities.includes("retailer")
        ? retailerFromIdentity(firebase.identity)
        : null,
    [firebase.identity, useFirebase],
  );

  const user: RetailerUser | null = useMemo(
    () =>
      useFirebase
        ? firebaseUser
        : demo.session
          ? {
              uid: demo.session.userId,
              id: demo.session.userId,
              email: demo.session.email ?? DEMO_RETAILER_CREDENTIALS.email,
              displayName: demo.session.displayName,
              name: demo.session.displayName,
              ...(demo.session.phone
                ? { phoneNumber: demo.session.phone, phone: demo.session.phone }
                : {}),
              capabilities: ["retailer"],
            }
          : null,
    [demo.session, firebaseUser, useFirebase],
  );

  const login = async (credentials: RetailerCredentials) => {
    setError(null);
    if (useFirebase) {
      try {
        await signInForPortal("retailer", credentials.email, credentials.password);
      } catch (cause: unknown) {
        const message = toAuthErrorMessage(cause);
        setError(message);
        throw new Error(message);
      }
      return;
    }
    if (
      credentials.email.trim().toLowerCase() !== DEMO_RETAILER_CREDENTIALS.email ||
      credentials.password !== DEMO_RETAILER_CREDENTIALS.password
    ) {
      const loginError = new Error("Invalid email or password.");
      setError(loginError.message);
      throw loginError;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
    demo.startSession({
      userId: DEFAULT_DEMO_RETAILER.id,
      role: "retailer",
      displayName: DEFAULT_DEMO_RETAILER.displayName,
      email: DEFAULT_DEMO_RETAILER.email,
      ...(DEFAULT_DEMO_RETAILER.phoneNumber ? { phone: DEFAULT_DEMO_RETAILER.phoneNumber } : {}),
    });
  };

  const logout = useCallback(async () => {
    if (useFirebase) {
      await signOutOfFirebase();
      return;
    }
    demo.endSession();
  }, [demo, useFirebase]);

  /**
   * Renames the shop-facing account.
   *
   * Writes both the Firestore profile and the Firebase Auth display name, then
   * re-reads the shared identity so every portal surface updates together.
   */
  const updateProfile = useCallback(
    async (displayName: string) => {
      const normalizedName = displayName.trim();
      if (!user || !normalizedName) throw new Error("A retailer name is required.");
      if (!useFirebase) {
        demo.updateSession({ displayName: normalizedName });
        return;
      }
      await updateUserProfile(user.uid, { name: normalizedName });
      const authUser = getCurrentUser();
      if (authUser) await setDisplayName(authUser, normalizedName);
      await refreshIdentity();
    },
    [demo, useFirebase, user],
  );

  return {
    user,
    loading: useFirebase ? firebase.isInitialising : demo.loading,
    error,
    isAuthenticated: useFirebase ? firebaseUser !== null : demo.isAuthenticated,
    isRetailer: useFirebase ? firebaseUser !== null : demo.isAuthenticated,
    capabilities: user?.capabilities ?? [],
    login,
    logout,
    updateProfile,
  };
}
