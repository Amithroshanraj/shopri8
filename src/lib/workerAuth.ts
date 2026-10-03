import { useEffect, useState } from "react";
import { DEMO_WORKER_ID } from "@/data/worker";

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

const STORAGE_KEY = "shopri8.worker.auth.v1";
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

function parseWorker(raw: string | null): WorkerUser | null {
  if (!raw) return null;
  try {
    const user = JSON.parse(raw) as WorkerUser;
    return user.workerId && user.email && user.displayName ? user : null;
  } catch {
    return null;
  }
}

let sharedState: WorkerAuthState = {
  user: null,
  loading: true,
  isAuthenticated: false,
  error: null,
};
const listeners = new Set<(state: WorkerAuthState) => void>();

function setSharedState(next: Partial<WorkerAuthState>) {
  sharedState = { ...sharedState, ...next };
  listeners.forEach((listener) => listener(sharedState));
}

function persistWorker(user: WorkerUser) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  } catch {
    // In-memory demo auth remains usable when browser storage is unavailable.
  }
  setSharedState({ user, isAuthenticated: true, loading: false, error: null });
}

export function useWorkerAuth() {
  const [state, setState] = useState(sharedState);

  useEffect(() => {
    const listener = (next: WorkerAuthState) => setState(next);
    listeners.add(listener);
    setState(sharedState);

    const storedWorker = parseWorker(localStorage.getItem(STORAGE_KEY));
    setSharedState({
      user: storedWorker,
      isAuthenticated: Boolean(storedWorker),
      loading: false,
      error: null,
    });

    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return;
      const user = parseWorker(event.newValue);
      setSharedState({ user, isAuthenticated: Boolean(user), loading: false, error: null });
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const login = async ({ email, password }: WorkerCredentials) => {
    setSharedState({ loading: true, error: null });
    if (
      email.trim().toLowerCase() !== DEMO_WORKER_CREDENTIALS.email ||
      password !== DEMO_WORKER_CREDENTIALS.password
    ) {
      const error = new Error("Use the SHOPRi8 Delivery Worker demo credentials.");
      setSharedState({ loading: false, error: error.message });
      throw error;
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
    persistWorker(parseWorker(localStorage.getItem(STORAGE_KEY)) ?? DEFAULT_DEMO_WORKER);
  };

  const logout = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Clear the in-memory worker session even if storage is unavailable.
    }
    setSharedState({ user: null, isAuthenticated: false, loading: false, error: null });
  };

  const updateProfile = (updates: {
    displayName: string;
    phoneNumber: string;
    deliveryModes: DeliveryMode[];
  }) => {
    if (!sharedState.user) return;
    const displayName = updates.displayName.trim();
    if (!displayName) throw new Error("Worker name is required.");
    persistWorker({
      ...sharedState.user,
      displayName,
      phoneNumber: updates.phoneNumber.trim(),
      deliveryModes: updates.deliveryModes,
    });
  };

  const setAvailable = (available: boolean) => {
    if (sharedState.user) persistWorker({ ...sharedState.user, available });
  };

  return { ...state, login, logout, updateProfile, setAvailable };
}
