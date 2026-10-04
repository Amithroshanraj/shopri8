/**
 * Portal authentication — the one place a role is decided.
 *
 * A portal is not "whoever signed in"; it is "whoever signed in *and* holds the
 * matching capability on `users/{uid}`". `signInForPortal` encodes that rule:
 *
 *   1. verify the credential with Firebase Auth
 *   2. read `users/{uid}.capabilities`
 *   3. if the capability is missing, sign the account back out and refuse
 *
 * Step 3 matters. Firebase happily authenticates a valid email and password for
 * an account that was never granted a role, so without it any customer could walk
 * into the admin portal by typing an admin email. The client cannot grant
 * capabilities either — `SELF_ASSIGNABLE_CAPABILITIES` is only `customer`, and the
 * Firestore security rules reject privileged self-writes.
 */

import { useCallback, useMemo } from "react";
import { isFirebaseActive, signInWithEmail, signOut as firebaseSignOut } from "../firebase";
import { userRepository } from "../repositories/userRepository";
import type { DemoRole } from "../demoAuth";
import type { Capability } from "../types";
import { identityHasCapability } from "./types";
import { toAuthErrorMessage } from "./authErrors";
import { useDemoAuthSession } from "./demoAuthProvider";
import { refreshIdentity, useFirebaseAuthSession } from "./firebaseAuthProvider";
import type { AuthIdentity } from "./types";

/** Capabilities used to protect application portals. */
export type PortalCapability = Capability;

const PORTAL_DEMO_ROLE: Record<PortalCapability, DemoRole> = {
  customer: "customer",
  retailer: "retailer",
  delivery_worker: "deliveryWorker",
  admin: "admin",
};

export const PORTAL_ROLE_LABEL: Record<PortalCapability, string> = {
  retailer: "retailer",
  delivery_worker: "delivery worker",
  admin: "administrator",
  customer: "customer",
};

/** True when the Firebase backend should be used instead of the demo store. */
export function firebaseIsActive(): boolean {
  return isFirebaseActive;
}

/** Raised when a valid account does not hold the capability for the portal. */
export class MissingCapabilityError extends Error {
  constructor(readonly capability: PortalCapability) {
    const article = capability === "admin" ? "an" : "a";
    super(
      `That account is signed in, but it is not registered as ${article} ${PORTAL_ROLE_LABEL[capability]}. ` +
        `Ask a SHOPRi8 admin to grant the ${capability} capability.`,
    );
    this.name = "MissingCapabilityError";
  }
}

/**
 * Signs in for a portal and enforces the capability before the caller proceeds.
 *
 * Throws `MissingCapabilityError` after signing out when the account lacks the
 * capability, so a wrong-portal sign-in never leaves a live session behind.
 */
export async function signInForPortal(
  capability: PortalCapability,
  email: string,
  password: string,
): Promise<void> {
  const credential = await signInWithEmail(email, password);
  try {
    const loaded = await userRepository.getUserProfile(credential.user.uid);
    if (!loaded.ok) throw new Error(loaded.message);
    const profile = loaded.data;
    if (profile?.status !== "active") {
      throw new SuspendedAccountError();
    }
    if (!profile.capabilities.includes(capability)) {
      throw new MissingCapabilityError(capability);
    }
    await refreshIdentity();
  } catch (cause: unknown) {
    try {
      await firebaseSignOut();
    } catch (signOutCause: unknown) {
      throw new Error(
        `Portal access could not be verified and sign-out failed: ${toAuthErrorMessage(signOutCause)}`,
        { cause: signOutCause },
      );
    }
    if (cause instanceof MissingCapabilityError) throw cause;
    if (cause instanceof SuspendedAccountError) throw cause;
    throw new Error(toAuthErrorMessage(cause));
  }
}

export class SuspendedAccountError extends Error {
  constructor() {
    super("This account is suspended. Contact SHOPRi8 support for assistance.");
    this.name = "SuspendedAccountError";
  }
}

/** Signs out of Firebase. No-op on the server. */
export async function signOutOfFirebase(): Promise<void> {
  await firebaseSignOut();
}

export interface PortalAccount {
  provider: "demo" | "firebase";
  identity: AuthIdentity | null;
  capabilities: Capability[];
  /** A session exists, whatever role it holds. */
  isSignedIn: boolean;
  /** A session exists *and* holds this portal's capability. */
  isAuthenticated: boolean;
  loading: boolean;
}

/**
 * Reads the active session and answers the capability question for one portal.
 *
 * In demo mode this is exactly the demo session for that role. In Firebase mode
 * the whole app shares one subscription, so the customer gate and a portal shell
 * can never disagree about who is signed in.
 */
export function usePortalAccount(capability: PortalCapability): PortalAccount {
  const demo = useDemoAuthSession(PORTAL_DEMO_ROLE[capability]);
  const firebase = useFirebaseAuthSession();
  const active = firebaseIsActive() ? firebase : demo;

  return useMemo<PortalAccount>(() => {
    const identity = active.identity;
    const granted = identityHasCapability(identity, capability);
    return {
      provider: active.provider,
      identity,
      capabilities: identity?.capabilities ?? [],
      isSignedIn: active.status === "signed-in",
      isAuthenticated: active.isAuthenticated && granted,
      loading: active.isInitialising,
    };
  }, [active, capability]);
}

/**
 * Picks the portal a multi-capability account belongs in when it is not a
 * customer, so the customer gate can send it somewhere useful.
 */
export function firstPortalCapability(capabilities: readonly Capability[]): DemoRole | null {
  const order: Capability[] = ["retailer", "delivery_worker", "admin"];
  const capability = order.find((item) => capabilities.includes(item));
  return capability ? PORTAL_DEMO_ROLE[capability] : null;
}

/** Sign-out handler that works on both backends. */
export function useSignOut(): () => Promise<void> {
  return useCallback(async () => {
    if (!firebaseIsActive()) return;
    await firebaseSignOut();
  }, []);
}
