import { useEffect, useState } from "react";
import type { Capability } from "./types";
import { getFirebaseAuth, isFirebaseConfigured } from "./firebase/config";

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

export const DEFAULT_DEMO_RETAILER: RetailerUser = {
  uid: "demo-retailer-1",
  id: "demo-retailer-1",
  email: "retailer@shop.com",
  displayName: "Green Basket Grocers",
  name: "Green Basket Grocers",
  phoneNumber: "+91 98765 43210",
  phone: "+91 98765 43210",
  capabilities: ["retailer"],
};

// Module-level shared state for retailer authentication
function getInitialState(): RetailerAuthState {
  if (typeof window === "undefined") {
    return {
      user: null,
      loading: false,
      error: null,
      isAuthenticated: false,
      isRetailer: false,
    };
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsedUser = JSON.parse(raw) as RetailerUser;
      const isRetailer =
        parsedUser.capabilities?.includes("retailer") || parsedUser.capabilities?.includes("admin");
      return {
        user: parsedUser,
        loading: false,
        error: null,
        isAuthenticated: true,
        isRetailer,
      };
    }
  } catch (e) {
    console.error("Failed to parse retailer auth from storage:", e);
  }

  return {
    user: null,
    loading: false,
    error: null,
    isAuthenticated: false,
    isRetailer: false,
  };
}

let sharedState: RetailerAuthState = getInitialState();
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
    // Sync with shared state on mount
    setState(sharedState);

    const listener = (newState: RetailerAuthState) => {
      setState(newState);
    };

    listeners.add(listener);

    // Cross-tab synchronization
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        if (e.newValue) {
          try {
            const user = JSON.parse(e.newValue) as RetailerUser;
            const isRetailer =
              user.capabilities?.includes("retailer") || user.capabilities?.includes("admin");
            setSharedState({
              user,
              isAuthenticated: true,
              isRetailer,
              loading: false,
              error: null,
            });
          } catch {
            // ignore
          }
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
      // Demo mode
      await new Promise((resolve) => setTimeout(resolve, 350));

      const email = credentials.email.trim() || "retailer@shop.com";
      const demoUser: RetailerUser = {
        ...DEFAULT_DEMO_RETAILER,
        email,
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
      const auth = getFirebaseAuth();
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
        const auth = getFirebaseAuth();
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

  return {
    ...state,
    login,
    logout,
  };
}
