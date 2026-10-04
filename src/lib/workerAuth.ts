import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { DEMO_WORKER_ID } from "@/data/worker";
import { useDemoSession } from "@/lib/demoAuth";
import { getCurrentUser, setDisplayName } from "@/lib/firebase";
import { userRepository } from "@/lib/repositories/userRepository";
import {
  firebaseIsActive,
  signInForPortal,
  signOutOfFirebase,
  useFirebaseAuthSession,
} from "@/lib/auth";
import { toAuthErrorMessage } from "@/lib/auth/authErrors";
import {
  readWorkerPreferences,
  subscribeToWorkerPreferences,
  workerPreferencesSnapshot,
  writeWorkerPreferences,
  type DeliveryMode,
} from "@/lib/workerProfileState";

export type { DeliveryMode };

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

export interface WorkerUser {
  id: string;
  workerId: string;
  email: string;
  displayName: string;
  phoneNumber: string;
  deliveryModes: DeliveryMode[];
  available: boolean;
}

/**
 * Demo credentials. Only reachable when `VITE_DATA_SOURCE=demo`.
 */
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

/**
 * Delivery-worker session.
 *
 * Access requires the `deliveryWorker` capability on `users/{uid}`; a valid
 * email and password alone does not open the portal. `workerId` is the Firebase
 * uid, so a worker's own tasks are scoped to the account that signed in rather
 * than to a shared demo id.
 */
export function useWorkerAuth() {
  const demo = useDemoSession("deliveryWorker");
  const firebase = useFirebaseAuthSession();
  const useFirebase = firebaseIsActive();
  const [error, setError] = useState<string | null>(null);

  useSyncExternalStore(
    subscribeToWorkerPreferences,
    workerPreferencesSnapshot,
    workerPreferencesSnapshot,
  );

  const identity =
    useFirebase && firebase.hasCapability("delivery_worker") ? firebase.identity : null;
  const uid = identity?.uid ?? null;
  const preferences = uid ? readWorkerPreferences(uid) : null;

  const demoMetadata = useMemo(() => demo.session?.metadata ?? {}, [demo.session]);
  const demoDeliveryModes = useMemo(() => {
    const allowedModes: DeliveryMode[] = ["Walking", "Bicycle", "Two-Wheeler"];
    const modes = demoMetadata["deliveryModes"];
    return Array.isArray(modes)
      ? (modes as unknown[]).filter((mode): mode is DeliveryMode =>
          allowedModes.includes(mode as DeliveryMode),
        )
      : [...DEFAULT_DEMO_WORKER.deliveryModes];
  }, [demoMetadata]);

  const user: WorkerUser | null = useMemo(
    () =>
      useFirebase
        ? identity
          ? {
              id: identity.uid,
              workerId: identity.uid,
              email: identity.email ?? "",
              displayName: identity.displayName || "Delivery Partner",
              phoneNumber: identity.phone ?? "",
              deliveryModes: preferences?.deliveryModes ?? [...DEFAULT_DEMO_WORKER.deliveryModes],
              available: preferences?.available ?? true,
            }
          : null
        : demo.session
          ? {
              id: demo.session.userId,
              workerId: demo.session.userId,
              email: demo.session.email ?? DEMO_WORKER_CREDENTIALS.email,
              displayName: demo.session.displayName,
              phoneNumber: demo.session.phone ?? DEFAULT_DEMO_WORKER.phoneNumber,
              deliveryModes: demoDeliveryModes,
              available: demoMetadata["available"] !== false,
            }
          : null,
    [demo.session, demoDeliveryModes, demoMetadata, identity, preferences, useFirebase],
  );

  const login = async ({ email, password }: WorkerCredentials) => {
    setError(null);
    if (useFirebase) {
      try {
        await signInForPortal("delivery_worker", email, password);
      } catch (cause: unknown) {
        const message = toAuthErrorMessage(cause);
        setError(message);
        throw new Error(message);
      }
      return;
    }
    if (
      email.trim().toLowerCase() !== DEMO_WORKER_CREDENTIALS.email ||
      password !== DEMO_WORKER_CREDENTIALS.password
    ) {
      const error = new Error("Invalid email or password.");
      setError("Invalid email or password.");
      throw error;
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
    demo.startSession({
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

  const logout = useCallback(async () => {
    if (useFirebase) {
      await signOutOfFirebase();
      return;
    }
    demo.endSession();
  }, [demo, useFirebase]);

  const updateProfile = useCallback(
    async (updates: {
      displayName: string;
      phoneNumber: string;
      deliveryModes: DeliveryMode[];
    }) => {
      if (!user) return;
      const displayName = updates.displayName.trim();
      if (!displayName) throw new Error("Worker name is required.");

      if (!useFirebase) {
        demo.updateSession({
          displayName,
          phone: updates.phoneNumber.trim(),
          metadata: { ...demoMetadata, deliveryModes: updates.deliveryModes },
        });
        return;
      }

      const updated = await userRepository.updateSafeUserProfile(user.workerId, { displayName });
      if (!updated.ok) throw new Error(updated.message);
      const authUser = getCurrentUser();
      if (authUser) await setDisplayName(authUser, displayName);
      writeWorkerPreferences(user.workerId, { deliveryModes: updates.deliveryModes });
    },
    [demo, demoMetadata, useFirebase, user],
  );

  const setAvailable = useCallback(
    (available: boolean) => {
      if (!user) return;
      if (!useFirebase) {
        demo.updateSession({ metadata: { ...demoMetadata, available } });
        return;
      }
      writeWorkerPreferences(user.workerId, { available });
    },
    [demo, demoMetadata, useFirebase, user],
  );

  return {
    user,
    loading: useFirebase ? firebase.isInitialising : demo.loading,
    isAuthenticated: useFirebase ? identity !== null : demo.isAuthenticated,
    error,
    login,
    logout,
    updateProfile,
    setAvailable,
  };
}

export type { WorkerAuthState };
