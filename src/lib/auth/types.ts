/**
 * Authentication abstraction shared by the demo and Firebase implementations.
 *
 * SHOPRi8 runs two authentication backends during the migration:
 *
 *   demo      — the existing localStorage sessions in `src/lib/demoAuth.ts`,
 *               which still drive every portal today.
 *   firebase  — Firebase Auth plus the `capabilities` array on `users/{uid}`.
 *
 * Both satisfy the `AuthSession` shape below, so a screen written against it
 * does not change when the active backend does. `useAuthSession` in
 * `src/lib/auth/index.ts` picks the implementation from configuration.
 *
 * A single account may hold several capabilities. The backend that performs the
 * sign-in never decides the role — `users/{uid}.capabilities` does.
 */

import type { AccountStatus, Capability } from "../types";

/** Which backend produced a session. Useful for diagnostics and setup screens. */
export type AuthProviderId = "demo" | "firebase";

export type AuthStatus = "initialising" | "signed-out" | "signed-in";

/**
 * The signed-in identity, independent of backend.
 *
 * `capabilities` is a set, never a single role: a user may be a customer and a
 * delivery worker at the same time.
 */
export interface AuthIdentity {
  uid: string;
  displayName: string;
  email: string | null;
  phoneNumber: string | null;
  /** Compatibility alias for portal UI models that still use `phone`. */
  phone: string | null;
  photoURL: string | null;
  capabilities: Capability[];
  status: AccountStatus;
  /** Backend that produced this identity. */
  provider: AuthProviderId;
}

export interface AuthSessionState {
  status: AuthStatus;
  identity: AuthIdentity | null;
  error: string | null;
}

export interface AuthSession extends AuthSessionState {
  isAuthenticated: boolean;
  isInitialising: boolean;
  /** True when the identity holds the given capability. */
  hasCapability: (capability: Capability) => boolean;
  /** Capabilities filtered to `available`, e.g. the portals this user may open. */
  capabilitiesIn: <T extends readonly Capability[]>(available: T) => T[number][];
  provider: AuthProviderId;
}

/** Capability assigned to a brand-new phone-authenticated customer. */
export const DEFAULT_CUSTOMER_CAPABILITY: Capability = "customer";

/** Capabilities a user may grant themselves. Everything else is admin-assigned. */
export const SELF_ASSIGNABLE_CAPABILITIES: readonly Capability[] = ["customer"];

export function identityHasCapability(
  identity: AuthIdentity | null,
  capability: Capability,
): boolean {
  return identity?.status === "active" && identity.capabilities.includes(capability);
}

export function canonicalCapability(value: unknown): Capability | null {
  if (value === "deliveryWorker") return "delivery_worker";
  return value === "customer" ||
    value === "retailer" ||
    value === "delivery_worker" ||
    value === "admin"
    ? value
    : null;
}

export function canonicalCapabilities(values: unknown): Capability[] {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map(canonicalCapability).filter((item): item is Capability => !!item))];
}

export function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return fallback;
}
