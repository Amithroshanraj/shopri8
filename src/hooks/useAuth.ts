import { useDemoSession } from "@/lib/demoAuth";

export interface CustomerAuthUser {
  uid: string;
  id: string;
  displayName: string;
  phoneNumber: string;
  email?: string;
}

export function useAuth() {
  const { session, loading, isAuthenticated, startSession, endSession } =
    useDemoSession("customer");
  const user: CustomerAuthUser | null = session
    ? {
        uid: session.userId,
        id: session.userId,
        displayName: session.displayName,
        phoneNumber: session.phone ?? "",
        ...(session.email ? { email: session.email } : {}),
      }
    : null;
  return { user, loading, isAuthenticated, startSession, logout: endSession };
}
