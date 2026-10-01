import { useEffect, useState } from "react";
import type { Capability } from "./types";
import { getRetailerFirebaseAuth, isFirebaseConfigured } from "./firebase/config";

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

const STORAGE_KEY = "shopri8.retailer.auth.v1";
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

function parseStoredRetailer(raw: string | null): RetailerUser | null {
  if (!raw) return null;
  try {
    const user = JSON.parse(raw) as RetailerUser;
    const hasRetailerAccess =
      user.capabilities?.includes("retailer") || user.capabilities?.includes("admin");
    return hasRetailerAccess ? user : null;
  } catch {
    return null;
  }
}

// Keep server and first client render identical; restore the session after mount.
let sharedState: RetailerAuthState = {
  user: null,
  loading: true,
  error: null,
  isAuthenticated: false,
  isRetailer: false,
};
const listeners = new Set<(state: RetailerAuthState) => void>();

function setSharedState(nextState: Partial<RetailerAuthState>) {
  sharedState = { ...sharedState, ...nextState };
  listeners.forEach((listener) => listener(sharedState));
}

/**
 * Retailer authentication hook.
 * Shared across all components and persisted in localStorage for demo mode.
 * Supports Firebase email/password authentication when configured.
 */
export function useRetailerAuth() {
  const [state, setState] = useState<RetailerAuthState>(sharedState);

  useEffect(() => {
    const listener = (newState: RetailerAuthState) => {
      setState(newState);
    };

    listeners.add(listener);
    setState(sharedState);

    const storedUser = parseStoredRetailer(localStorage.getItem(STORAGE_KEY));
    setSharedState({
      user: storedUser,
      loading: false,
      error: null,
      isAuthenticated: Boolean(storedUser),
      isRetailer: Boolean(storedUser),
    });

    // Cross-tab synchronization
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        const user = parseStoredRetailer(e.newValue);
        if (user) {
          setSharedState({
            user,
            isAuthenticated: true,
            isRetailer: true,
            loading: false,
            error: null,
          });
        } else {
          setSharedState({
            user: null,
            isAuthenticated: false,
            isRetailer: false,
            loading: false,
            error: null,
          });
        }
      }
    };

    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const login = async (credentials: RetailerCredentials) => {
    setSharedState({ loading: true, error: null });

    if (!isFirebaseConfigured) {
      if (
        credentials.email.trim().toLowerCase() !== DEMO_RETAILER_CREDENTIALS.email ||
        credentials.password !== DEMO_RETAILER_CREDENTIALS.password
      ) {
        const error = new Error("Use the Green Basket demo email and password.");
        setSharedState({ loading: false, error: error.message });
        throw error;
      }

      await new Promise((resolve) => setTimeout(resolve, 350));

      const demoUser: RetailerUser = {
        ...DEFAULT_DEMO_RETAILER,
      };

      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(demoUser));
      } catch (e) {
        console.error("Failed to save retailer auth to localStorage:", e);
      }

      setSharedState({
        user: demoUser,
        loading: false,
        error: null,
        isAuthenticated: true,
        isRetailer: true,
      });
      return;
    }

    // Real Firebase authentication
    try {
      const auth = getRetailerFirebaseAuth();
      if (!auth) throw new Error("Firebase Auth not available");

      const { signInWithEmailAndPassword } = await import("firebase/auth");
      const cred = await signInWithEmailAndPassword(auth, credentials.email, credentials.password);

      const fbUser = cred.user;
      const retailerUser: RetailerUser = {
        uid: fbUser.uid,
        id: fbUser.uid,
        email: fbUser.email || credentials.email,
        displayName: fbUser.displayName || "Retailer",
        name: fbUser.displayName || "Retailer",
        phoneNumber: fbUser.phoneNumber,
        phone: fbUser.phoneNumber,
        capabilities: ["retailer"],
      };

      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(retailerUser));
      } catch {
        // ignore
      }

      setSharedState({
        user: retailerUser,
        loading: false,
        error: null,
        isAuthenticated: true,
        isRetailer: true,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Login failed";
      setSharedState({
        user: null,
        loading: false,
        error: msg,
        isAuthenticated: false,
        isRetailer: false,
      });
      throw error;
    }
  };

  const logout = async () => {
    setSharedState({ loading: true });

    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }

    if (isFirebaseConfigured) {
      try {
        const auth = getRetailerFirebaseAuth();
        if (auth) {
          const { signOut } = await import("firebase/auth");
          await signOut(auth);
        }
      } catch {
        // ignore
      }
    }

    setSharedState({
      user: null,
      loading: false,
      error: null,
      isAuthenticated: false,
      isRetailer: false,
    });
  };

  const updateProfile = async (displayName: string) => {
    const normalizedName = displayName.trim();
    const currentUser = sharedState.user;
    if (!currentUser || !normalizedName) throw new Error("A retailer name is required.");

    if (isFirebaseConfigured) {
      const auth = getRetailerFirebaseAuth();
      if (!auth?.currentUser) throw new Error("Retailer authentication is unavailable.");
      const { updateProfile: updateFirebaseProfile } = await import("firebase/auth");
      await updateFirebaseProfile(auth.currentUser, { displayName: normalizedName });
    }

    const updatedUser = { ...currentUser, displayName: normalizedName, name: normalizedName };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedUser));
    } catch {
      // Keep the in-memory profile available if browser storage is unavailable.
    }
    setSharedState({ user: updatedUser, error: null });
  };

  return {
    ...state,
    login,
    logout,
    updateProfile,
  };
}
