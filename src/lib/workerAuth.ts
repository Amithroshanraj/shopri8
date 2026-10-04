import { useState } from "react";
import { DEMO_WORKER_ID } from "@/data/worker";
import { useDemoSession } from "@/lib/demoAuth";

export type DeliveryMode = "Walking" | "Bicycle" | "Two-Wheeler";

export interface WorkerUser {
  id: string;
  workerId: string;
  email: string;
  displayName: string;
  phoneNumber: string;
  deliveryModes: DeliveryMode[];
  available: boolean;
}

interface WorkerAuthState {
  user: WorkerUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  error: string | null;
}

interface WorkerCredentials {
  email: string;
  password: string;
}

export const DEMO_WORKER_CREDENTIALS = {
  email: "worker@shopri8.com",
  password: "worker123",
} as const;

export const DEFAULT_DEMO_WORKER: WorkerUser = {
  id: DEMO_WORKER_ID,
  workerId: DEMO_WORKER_ID,
  email: DEMO_WORKER_CREDENTIALS.email,
  displayName: "Arjun Kumar",
  phoneNumber: "+91 90000 00010",
  deliveryModes: ["Walking", "Bicycle", "Two-Wheeler"],
  available: true,
};

export function useWorkerAuth() {
  const { session, loading, isAuthenticated, startSession, updateSession, endSession } =
    useDemoSession("deliveryWorker");
  const [error, setError] = useState<string | null>(null);
  const metadata = session?.metadata ?? {};
  const allowedModes: DeliveryMode[] = ["Walking", "Bicycle", "Two-Wheeler"];
  const deliveryModes = Array.isArray(metadata["deliveryModes"])
    ? metadata["deliveryModes"].filter((mode): mode is DeliveryMode =>
        allowedModes.includes(mode as DeliveryMode),
      )
    : [...DEFAULT_DEMO_WORKER.deliveryModes];
  const user: WorkerUser | null = session
    ? {
        id: session.userId,
        workerId: session.userId,
        email: session.email ?? DEMO_WORKER_CREDENTIALS.email,
        displayName: session.displayName,
        phoneNumber: session.phone ?? DEFAULT_DEMO_WORKER.phoneNumber,
        deliveryModes,
        available: metadata["available"] !== false,
      }
    : null;

  const login = async ({ email, password }: WorkerCredentials) => {
    setError(null);
    if (
      email.trim().toLowerCase() !== DEMO_WORKER_CREDENTIALS.email ||
      password !== DEMO_WORKER_CREDENTIALS.password
    ) {
      const error = new Error("Invalid email or password.");
      setError("Invalid email or password.");
      throw error;
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
    startSession({
      userId: DEFAULT_DEMO_WORKER.workerId,
      role: "deliveryWorker",
      displayName: DEFAULT_DEMO_WORKER.displayName,
      email: DEFAULT_DEMO_WORKER.email,
      phone: DEFAULT_DEMO_WORKER.phoneNumber,
      metadata: {
        deliveryModes: DEFAULT_DEMO_WORKER.deliveryModes,
        available: true,
      },
    });
  };

  const logout = () => endSession();

  const updateProfile = (updates: {
    displayName: string;
    phoneNumber: string;
    deliveryModes: DeliveryMode[];
  }) => {
    if (!session) return;
    const displayName = updates.displayName.trim();
    if (!displayName) throw new Error("Worker name is required.");
    updateSession({
      displayName,
      phone: updates.phoneNumber.trim(),
      metadata: { ...metadata, deliveryModes: updates.deliveryModes },
    });
  };

  const setAvailable = (available: boolean) => {
    if (session) updateSession({ metadata: { ...metadata, available } });
  };

  return { user, loading, isAuthenticated, error, login, logout, updateProfile, setAvailable };
}
