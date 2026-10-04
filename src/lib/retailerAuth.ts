import { useState } from "react";
import type { Capability } from "./types";
import { useDemoSession } from "./demoAuth";

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

export function useRetailerAuth() {
  const { session, loading, startSession, updateSession, endSession, isAuthenticated } =
    useDemoSession("retailer");
  const [error, setError] = useState<string | null>(null);
  const user: RetailerUser | null = session
    ? {
        uid: session.userId,
        id: session.userId,
        email: session.email ?? DEMO_RETAILER_CREDENTIALS.email,
        displayName: session.displayName,
        name: session.displayName,
        ...(session.phone ? { phoneNumber: session.phone, phone: session.phone } : {}),
        capabilities: ["retailer"],
      }
    : null;
  const login = async (credentials: RetailerCredentials) => {
    setError(null);
    if (
      credentials.email.trim().toLowerCase() !== DEMO_RETAILER_CREDENTIALS.email ||
      credentials.password !== DEMO_RETAILER_CREDENTIALS.password
    ) {
      const loginError = new Error("Invalid email or password.");
      setError(loginError.message);
      throw loginError;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
    startSession({
      userId: DEFAULT_DEMO_RETAILER.id,
      role: "retailer",
      displayName: DEFAULT_DEMO_RETAILER.displayName,
      email: DEFAULT_DEMO_RETAILER.email,
      ...(DEFAULT_DEMO_RETAILER.phoneNumber ? { phone: DEFAULT_DEMO_RETAILER.phoneNumber } : {}),
    });
  };

  const logout = () => endSession();

  const updateProfile = async (displayName: string) => {
    const normalizedName = displayName.trim();
    const currentUser = user;
    if (!currentUser || !normalizedName) throw new Error("A retailer name is required.");
    updateSession({ displayName: normalizedName });
  };

  return {
    user,
    loading,
    error,
    isAuthenticated,
    isRetailer: isAuthenticated,
    login,
    logout,
    updateProfile,
  };
}
