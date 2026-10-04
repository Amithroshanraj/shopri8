import { useCallback, useMemo, useState } from "react";
import { useDemoSession } from "@/lib/demoAuth";
import { getCurrentUser, setDisplayName } from "@/lib/firebase";
import { userRepository } from "@/lib/repositories/userRepository";
import {
  firebaseIsActive,
  refreshIdentity,
  signInForPortal,
  signOutOfFirebase,
  useFirebaseAuthSession,
} from "@/lib/auth";
import { toAuthErrorMessage } from "@/lib/auth/authErrors";

export interface AdminUser {
  id: string;
  email: string;
  displayName: string;
  role: "admin";
}

/**
 * Demo credentials. Only reachable when `VITE_DATA_SOURCE=demo`.
 */
export const DEMO_ADMIN_CREDENTIALS = {
  email: "admin@shopri8.com",
  password: "admin123",
} as const;

const DEFAULT_ADMIN: AdminUser = {
  id: "demo-admin-1",
  email: DEMO_ADMIN_CREDENTIALS.email,
  displayName: "SHOPRi8 Admin",
  role: "admin",
};

/**
 * Administrator session.
 *
 * The admin portal requires the `admin` capability on `users/{uid}`. Firebase
 * authenticating the credential is not enough, and a client can never grant
 * itself the capability: privileged roles are written by an admin through the
 * Firestore rules, which reject a self-write.
 */
export function useAdminAuth() {
  const demo = useDemoSession("admin");
  const firebase = useFirebaseAuthSession();
  const useFirebase = firebaseIsActive();
  const [error, setError] = useState<string | null>(null);

  const identity = useFirebase && firebase.hasCapability("admin") ? firebase.identity : null;

  const user: AdminUser | null = useMemo(
    () =>
      useFirebase
        ? identity
          ? {
              id: identity.uid,
              email: identity.email ?? "",
              displayName: identity.displayName || "SHOPRi8 Admin",
              role: "admin" as const,
            }
          : null
        : demo.session
          ? {
              id: demo.session.userId,
              email: demo.session.email ?? DEMO_ADMIN_CREDENTIALS.email,
              displayName: demo.session.displayName,
              role: "admin" as const,
            }
          : null,
    [demo.session, identity, useFirebase],
  );

  const login = async (email: string, password: string) => {
    setError(null);
    if (useFirebase) {
      try {
        await signInForPortal("admin", email, password);
      } catch (cause: unknown) {
        const message = toAuthErrorMessage(cause);
        setError(message);
        throw new Error(message);
      }
      return;
    }
    if (
      email.trim().toLowerCase() !== DEMO_ADMIN_CREDENTIALS.email ||
      password !== DEMO_ADMIN_CREDENTIALS.password
    ) {
      const loginError = new Error("Invalid email or password.");
      setError(loginError.message);
      throw loginError;
    }

    demo.startSession({
      userId: DEFAULT_ADMIN.id,
      role: "admin",
      displayName: DEFAULT_ADMIN.displayName,
      email: DEFAULT_ADMIN.email,
    });
  };

  const logout = useCallback(async () => {
    if (useFirebase) {
      await signOutOfFirebase();
      return;
    }
    demo.endSession();
  }, [demo, useFirebase]);

  const updateDisplayName = useCallback(
    async (displayName: string) => {
      if (!user) return;
      const normalizedName = displayName.trim();
      if (!normalizedName) throw new Error("Admin name is required.");
      if (!useFirebase) {
        demo.updateSession({ displayName: normalizedName });
        return;
      }
      const updated = await userRepository.updateSafeUserProfile(user.id, {
        displayName: normalizedName,
      });
      if (!updated.ok) throw new Error(updated.message);
      const authUser = getCurrentUser();
      if (authUser) await setDisplayName(authUser, normalizedName);
      await refreshIdentity();
    },
    [demo, useFirebase, user],
  );

  return {
    user,
    loading: useFirebase ? firebase.isInitialising : demo.loading,
    isAuthenticated: useFirebase ? identity !== null : demo.isAuthenticated,
    error,
    login,
    logout,
    updateDisplayName,
  };
}
