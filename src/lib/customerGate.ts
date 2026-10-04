import type { DemoRole } from "./demoAuth";
import type { Capability } from "./types";

export const CUSTOMER_WELCOME_PATH = "/auth";

export const ROLE_LANDING: Record<DemoRole, string> = {
  customer: "/",
  retailer: "/retailer/dashboard",
  deliveryWorker: "/worker/dashboard",
  admin: "/admin/dashboard",
};

const ROLE_PORTAL_PREFIXES = ["/retailer", "/worker", "/admin"] as const;

/** Order a multi-capability account is considered in when it is not a customer. */
const PORTAL_FALLBACK_ORDER: readonly Capability[] = ["retailer", "delivery_worker", "admin"];

/** The portal a signed-in, non-customer account belongs to, or `null`. */
export function portalLandingRole(capabilities: readonly Capability[]): DemoRole | null {
  const capability = PORTAL_FALLBACK_ORDER.find((item) => capabilities.includes(item));
  if (capability === "delivery_worker") return "deliveryWorker";
  return capability ?? null;
}

export function isRolePortalPath(pathname: string) {
  return ROLE_PORTAL_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export type CustomerGateRedirect = { kind: "path"; to: string } | { kind: "customer-return-to" };

export interface CustomerGateDecision {
  /** What the root outlet should render while this decision is active. */
  render: "outlet" | "loading" | "blank";
  /** Navigation to perform, or null to stay put. */
  redirect: CustomerGateRedirect | null;
  /** Whether the current path should be stored as the post-login destination. */
  remember: boolean;
}

/**
 * Decides what the app shell does for a given path and session.
 *
 * Role portals own their own guards and are never touched. Everything else is
 * the customer storefront: signed-out visitors are sent to the welcome screen
 * with their deep link remembered, and signed-in customers are bounced off the
 * welcome screen back into the storefront.
 *
 * The storefront test is a capability, not a session:
 *
 *   - `canBrowseStorefront` is the Firebase answer — does `users/{uid}` hold
 *     `customer`? A retailer or worker account without it stays out.
 *   - Passing `null` keeps the original demo behaviour, where the single active
 *     demo session decides the role.
 *
 * A multi-capability account such as `["customer", "deliveryWorker"]` may open
 * both the storefront and the worker portal: the storefront check passes here and
 * the worker shell enforces its own capability.
 */
export function resolveCustomerGate({
  pathname,
  activeRole,
  canBrowseStorefront,
  capabilities = [],
  loading,
}: {
  pathname: string;
  /** Demo backend only: the single role that owns the demo session. */
  activeRole: DemoRole | null;
  /** Firebase backend only: null falls back to `activeRole`. */
  canBrowseStorefront: boolean | null;
  capabilities?: readonly Capability[];
  loading: boolean;
}): CustomerGateDecision {
  const isWelcome = pathname === CUSTOMER_WELCOME_PATH;
  const isCustomer = canBrowseStorefront ?? activeRole === "customer";

  if (isRolePortalPath(pathname)) {
    return { render: "outlet", redirect: null, remember: false };
  }
  if (loading) {
    return { render: "loading", redirect: null, remember: false };
  }
  // Another role owns the session; send them to their own portal untouched.
  if (activeRole && !isCustomer) {
    return {
      render: "blank",
      redirect: { kind: "path", to: ROLE_LANDING[activeRole] },
      remember: false,
    };
  }
  if (isCustomer) {
    return isWelcome
      ? { render: "blank", redirect: { kind: "customer-return-to" }, remember: false }
      : { render: "outlet", redirect: null, remember: false };
  }
  // Signed in on Firebase, but without the customer capability: hand them to the
  // portal they do hold, and to /auth when they hold none.
  const landing = portalLandingRole(capabilities);
  if (landing) {
    return {
      render: "blank",
      redirect: { kind: "path", to: ROLE_LANDING[landing] },
      remember: false,
    };
  }
  return isWelcome
    ? { render: "outlet", redirect: null, remember: false }
    : { render: "blank", redirect: { kind: "path", to: CUSTOMER_WELCOME_PATH }, remember: true };
}
