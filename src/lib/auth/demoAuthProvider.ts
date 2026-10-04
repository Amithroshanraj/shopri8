/**
 * Demo authentication adapter.
 *
 * Wraps the existing `useDemoSession` store so it satisfies the same `AuthSession`
 * contract as the Firebase adapter. No demo behaviour is changed: the same
 * localStorage sessions, the same role switching, the same return-to handling.
 *
 * A demo session carries exactly one role, so its capability list has a single
 * entry. That is a property of the demo store, not of the model — the Firebase
 * adapter returns the full multi-capability set.
 */

import { useCallback, useMemo } from "react";
import { useDemoSession, type DemoAuthSession, type DemoRole } from "../demoAuth";
import type { Capability } from "../types";
import { errorMessage, identityHasCapability, type AuthIdentity, type AuthSession } from "./types";

function identityFromDemoSession(session: DemoAuthSession): AuthIdentity {
  return {
    uid: session.userId,
    displayName: session.displayName,
    email: session.email ?? null,
    phone: session.phone ?? null,
    photoURL: null,
    capabilities: [session.role as Capability],
    provider: "demo",
  };
}

/**
 * Adapts the demo session store to the shared auth contract.
 *
 * @param role Which portal's session to expose. Matches the `Capability` union.
 */
export function useDemoAuthSession(role: DemoRole): AuthSession {
  const { session, loading, isAuthenticated } = useDemoSession(role);

  const identity = useMemo(() => (session ? identityFromDemoSession(session) : null), [session]);

  const hasCapability = useCallback(
    (capability: Capability) => identityHasCapability(identity, capability),
    [identity],
  );

  const capabilitiesIn = useCallback(
    <T extends readonly Capability[]>(available: T) =>
      available.filter((capability) => identityHasCapability(identity, capability)),
    [identity],
  );

  return {
    status: loading ? "initialising" : isAuthenticated ? "signed-in" : "signed-out",
    identity,
    error: null,
    isAuthenticated,
    isInitialising: loading,
    hasCapability,
    capabilitiesIn,
    provider: "demo",
  };
}

/** Normalises a thrown demo sign-in failure for display. */
export function demoSignInErrorMessage(error: unknown): string {
  return errorMessage(error, "Unable to sign in.");
}
