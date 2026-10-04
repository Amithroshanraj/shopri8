import type { DemoRole } from "../demoAuth";

const RETURN_TO_KEY_PREFIX = "shopri8.demo-auth.return-to.";
const ROLE_PORTAL_PREFIXES = ["/retailer", "/worker", "/admin"] as const;

const RETURN_PREFIXES: Record<DemoRole, string> = {
  customer: "/",
  retailer: "/retailer/",
  deliveryWorker: "/worker/",
  admin: "/admin/",
};

const LOGIN_PATHS: Record<DemoRole, string> = {
  customer: "/auth",
  retailer: "/retailer/login",
  deliveryWorker: "/worker/login",
  admin: "/admin/login",
};

export function isRememberablePath(role: DemoRole, pathname: string): boolean {
  if (!pathname.startsWith(RETURN_PREFIXES[role])) return false;
  if (pathname === LOGIN_PATHS[role]) return false;
  if (pathname.includes("//")) return false;
  if (
    role === "customer" &&
    ROLE_PORTAL_PREFIXES.some((prefix) => pathname.startsWith(`${prefix}/`))
  ) {
    return false;
  }
  return true;
}

export function rememberAuthReturnTo(role: DemoRole, pathname: string): void {
  if (!isRememberablePath(role, pathname)) return;
  try {
    sessionStorage.setItem(`${RETURN_TO_KEY_PREFIX}${role}`, pathname);
  } catch {
    // Login still works with its role's default landing page.
  }
}

export function consumeAuthReturnTo(role: DemoRole, fallback: string): string {
  try {
    const key = `${RETURN_TO_KEY_PREFIX}${role}`;
    const pathname = sessionStorage.getItem(key);
    sessionStorage.removeItem(key);
    if (pathname && isRememberablePath(role, pathname)) return pathname;
  } catch {
    // Fall through to the role's default landing page.
  }
  return fallback;
}

export function clearAuthReturnTo(role: DemoRole): void {
  try {
    sessionStorage.removeItem(`${RETURN_TO_KEY_PREFIX}${role}`);
  } catch {
    // The return path is optional state.
  }
}
