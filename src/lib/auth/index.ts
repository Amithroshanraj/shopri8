/**
 * Auth facade — the seam the application migrates through.
 *
 * `useAuthSession` returns the demo adapter or the Firebase adapter depending on
 * configuration, so a screen written against the shared contract keeps working
 * across the switch.
 *
 * `usePortalAccount` in `./portalSession` is what the three portal hooks and the
 * customer gate use: it adds capability enforcement on top of the same two
 * adapters. A portal is a capability, not merely a signed-in account.
 */

import { isFirebaseActive } from "../firebase";
import { useDemoAuthSession } from "./demoAuthProvider";
import { useFirebaseAuthSession } from "./firebaseAuthProvider";
import type { DemoRole } from "../demoAuth";
import type { Capability } from "../types";
import type { AuthSession } from "./types";

export {
  DEFAULT_CUSTOMER_CAPABILITY,
  SELF_ASSIGNABLE_CAPABILITIES,
  errorMessage,
  identityHasCapability,
  type AuthIdentity,
  type AuthProviderId,
  type AuthSession,
  type AuthSessionState,
  type AuthStatus,
} from "./types";

export { useDemoAuthSession } from "./demoAuthProvider";
export {
  useFirebaseAuthSession,
  cancelPhoneSignIn,
  clearError,
  refreshIdentity,
  registerWithPassword,
  signInWithPassword,
  signInWithPhone,
  signOut as signOutOfFirebase,
  verifyPhoneCode,
  type FirebaseAuthSession,
  type PendingPhoneSignIn,
} from "./firebaseAuthProvider";

export {
  MissingCapabilityError,
  PORTAL_ROLE_LABEL,
  firebaseIsActive,
  firstPortalCapability,
  signInForPortal,
  usePortalAccount,
  type PortalAccount,
  type PortalCapability,
} from "./portalSession";

export { AUTH_CODES, isFirebaseAuthError, toAuthErrorMessage } from "./authErrors";

export { useAccountLinking, type AccountLinking, type LinkResult } from "./accountLinking";

/**
 * Session for a portal, from whichever backend is active.
 *
 * In demo mode this is exactly the existing demo session. In Firebase mode the
 * capabilities come from `users/{uid}`.
 *
 * @param role Portal whose session is requested. Ignored by the Firebase
 *   adapter, which is capability-driven rather than role-driven.
 */
export function useAuthSession(role: DemoRole): AuthSession {
  const demo = useDemoAuthSession(role);
  // The Firebase adapter is always mounted so its subscription stays in sync, but
  // only the active backend's value is returned.
  const firebase = useFirebaseAuthSession();
  return isFirebaseActive ? firebase : demo;
}

/** Human-readable reason the Firebase backend is unavailable, or `null`. */
export { firebaseUnavailableReason } from "../firebase";

/** Convenience: which capability-gated portals the signed-in user may open. */
export function capabilityGates(): readonly {
  capability: Capability;
  path: string;
  label: string;
}[] {
  return [
    { capability: "retailer", path: "/retailer/dashboard", label: "Retailer" },
    { capability: "delivery_worker", path: "/worker/dashboard", label: "Delivery" },
    { capability: "admin", path: "/admin/dashboard", label: "Admin" },
  ] as const;
}
