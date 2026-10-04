import { useState } from "react";
import { useDemoSession } from "@/lib/demoAuth";

export interface AdminUser {
  id: string;
  email: string;
  displayName: string;
  role: "admin";
}

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

export function useAdminAuth() {
  const { session, loading, isAuthenticated, startSession, updateSession, endSession } =
    useDemoSession("admin");
  const [error, setError] = useState<string | null>(null);
  const user: AdminUser | null = session
    ? {
        id: session.userId,
        email: session.email ?? DEMO_ADMIN_CREDENTIALS.email,
        displayName: session.displayName,
        role: "admin",
      }
    : null;

  const login = async (email: string, password: string) => {
    setError(null);
    if (
      email.trim().toLowerCase() !== DEMO_ADMIN_CREDENTIALS.email ||
      password !== DEMO_ADMIN_CREDENTIALS.password
    ) {
      const loginError = new Error("Invalid email or password.");
      setError(loginError.message);
      throw loginError;
    }

    startSession({
      userId: DEFAULT_ADMIN.id,
      role: "admin",
      displayName: DEFAULT_ADMIN.displayName,
      email: DEFAULT_ADMIN.email,
    });
  };

  const logout = () => endSession();

  const updateDisplayName = (displayName: string) => {
    if (!session) return;
    const normalizedName = displayName.trim();
    if (!normalizedName) throw new Error("Admin name is required.");
    updateSession({ displayName: normalizedName });
  };

  return { user, loading, isAuthenticated, error, login, logout, updateDisplayName };
}
