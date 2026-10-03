import { useEffect, useState } from "react";

export interface AdminUser {
  id: string;
  email: string;
  displayName: string;
  role: "admin";
}

interface AdminAuthState {
  user: AdminUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  error: string | null;
}

const STORAGE_KEY = "shopri8.admin.auth.v1";
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

let sharedState: AdminAuthState = {
  user: null,
  loading: true,
  isAuthenticated: false,
  error: null,
};
const listeners = new Set<(state: AdminAuthState) => void>();

function setSharedState(next: Partial<AdminAuthState>) {
  sharedState = { ...sharedState, ...next };
  listeners.forEach((listener) => listener(sharedState));
}

function readStoredAdmin(raw: string | null): AdminUser | null {
  if (!raw) return null;
  try {
    const user = JSON.parse(raw) as AdminUser;
    return user.role === "admin" && user.id && user.email ? user : null;
  } catch {
    return null;
  }
}

export function useAdminAuth() {
  const [state, setState] = useState(sharedState);

  useEffect(() => {
    const listener = (next: AdminAuthState) => setState(next);
    listeners.add(listener);
    setState(sharedState);
    const user = readStoredAdmin(localStorage.getItem(STORAGE_KEY));
    setSharedState({ user, loading: false, isAuthenticated: Boolean(user), error: null });

    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return;
      const storedUser = readStoredAdmin(event.newValue);
      setSharedState({
        user: storedUser,
        isAuthenticated: Boolean(storedUser),
        loading: false,
        error: null,
      });
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const login = async (email: string, password: string) => {
    setSharedState({ loading: true, error: null });
    if (
      email.trim().toLowerCase() !== DEMO_ADMIN_CREDENTIALS.email ||
      password !== DEMO_ADMIN_CREDENTIALS.password
    ) {
      const error = new Error("Invalid admin email or password.");
      setSharedState({ loading: false, error: error.message });
      throw error;
    }

    const user = readStoredAdmin(localStorage.getItem(STORAGE_KEY)) ?? DEFAULT_ADMIN;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    setSharedState({ user, loading: false, isAuthenticated: true, error: null });
  };

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY);
    setSharedState({ user: null, loading: false, isAuthenticated: false, error: null });
  };

  const updateDisplayName = (displayName: string) => {
    if (!sharedState.user) return;
    const normalizedName = displayName.trim();
    if (!normalizedName) throw new Error("Admin name is required.");
    const user = { ...sharedState.user, displayName: normalizedName };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    setSharedState({ user, error: null });
  };

  return { ...state, login, logout, updateDisplayName };
}
