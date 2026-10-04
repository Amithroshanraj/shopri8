import type { DemoRole } from "./demoAuth";

export const CUSTOMER_WELCOME_PATH = "/auth";

export const ROLE_LANDING: Record<DemoRole, string> = {
  customer: "/",
  retailer: "/retailer/dashboard",
  deliveryWorker: "/worker/dashboard",
  admin: "/admin/dashboard",
};

const ROLE_PORTAL_PREFIXES = ["/retailer", "/worker", "/admin"] as const;

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
 * Decides what the app shell does for a given path and demo session.
 *
 * Role portals own their own guards and are never touched. Everything else is
 * the customer storefront: signed-out visitors are sent to the welcome screen
 * with their deep link remembered, and signed-in customers are bounced off the
 * welcome screen back into the storefront.
 */
export function resolveCustomerGate({
  pathname,
  activeRole,
  loading,
}: {
  pathname: string;
  activeRole: DemoRole | null;
  loading: boolean;
}): CustomerGateDecision {
  const isWelcome = pathname === CUSTOMER_WELCOME_PATH;
  const isCustomer = activeRole === "customer";

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
  return isWelcome
    ? { render: "outlet", redirect: null, remember: false }
    : { render: "blank", redirect: { kind: "path", to: CUSTOMER_WELCOME_PATH }, remember: true };
}
