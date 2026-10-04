import { useEffect, useState } from "react";

export type DemoRole = "customer" | "retailer" | "deliveryWorker" | "admin";

export interface DemoAuthSession {
  userId: string;
  role: DemoRole;
  displayName: string;
  email?: string;
  phone?: string;
  authenticated: true;
  loginTimestamp: string;
  metadata?: Record<string, unknown>;
}

interface DemoAuthStore {
  activeRole: DemoRole | null;
  sessions: Partial<Record<DemoRole, DemoAuthSession>>;
}

const STORAGE_KEY = "shopri8.demo.auth.v1";
const STORE_UPDATED_EVENT = "shopri8:demo-auth-updated";
const LEGACY_KEYS = [
  "shopri8.retailer.auth.v1",
  "shopri8.worker.auth.v1",
  "shopri8.admin.auth.v1",
] as const;
const EMPTY_STORE: DemoAuthStore = { activeRole: null, sessions: {} };
const ROLES: DemoRole[] = ["customer", "retailer", "deliveryWorker", "admin"];

let sharedStore = EMPTY_STORE;
const listeners = new Set<(store: DemoAuthStore) => void>();

function isRole(value: unknown): value is DemoRole {
  return typeof value === "string" && ROLES.includes(value as DemoRole);
}

function parseStore(raw: string | null): DemoAuthStore | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<DemoAuthStore>;
    const sessions: Partial<Record<DemoRole, DemoAuthSession>> = {};
    for (const role of ROLES) {
      const session = value.sessions?.[role];
      if (
        session?.authenticated === true &&
        session.role === role &&
        typeof session.userId === "string" &&
        typeof session.displayName === "string"
      ) {
        sessions[role] = session;
      }
    }
    return {
      activeRole: isRole(value.activeRole) && sessions[value.activeRole] ? value.activeRole : null,
      sessions,
    };
  } catch {
    return null;
  }
}

function migrateLegacySessions(): DemoAuthStore {
  const sessions: Partial<Record<DemoRole, DemoAuthSession>> = {};
  const now = new Date().toISOString();
  for (const key of LEGACY_KEYS) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const legacy = JSON.parse(raw) as Record<string, unknown>;
      let role: DemoRole | null = null;
      let userId = "";
      let displayName = "";
      let email = "";
      let phone = "";
      let metadata: Record<string, unknown> | undefined;

      if (
        key === "shopri8.retailer.auth.v1" &&
        legacy["email"] === "retailer@greenbasket.com" &&
        (legacy["uid"] === "demo-retailer-1" || legacy["id"] === "demo-retailer-1")
      ) {
        role = "retailer";
        userId = "demo-retailer-1";
        displayName = String(legacy["displayName"] || "Green Basket Grocers");
        email = "retailer@greenbasket.com";
        phone = String(legacy["phoneNumber"] || legacy["phone"] || "+91 98765 43210");
      } else if (
        key === "shopri8.worker.auth.v1" &&
        legacy["email"] === "worker@shopri8.com" &&
        legacy["workerId"] === "worker-demo-1"
      ) {
        role = "deliveryWorker";
        userId = "worker-demo-1";
        displayName = String(legacy["displayName"] || "Arjun Kumar");
        email = "worker@shopri8.com";
        phone = String(legacy["phoneNumber"] || "+91 90000 00010");
        metadata = {
          workerId: userId,
          deliveryModes: Array.isArray(legacy["deliveryModes"]) ? legacy["deliveryModes"] : [],
          available: legacy["available"] !== false,
        };
      } else if (
        key === "shopri8.admin.auth.v1" &&
        legacy["email"] === "admin@shopri8.com" &&
        legacy["role"] === "admin"
      ) {
        role = "admin";
        userId = "demo-admin-1";
        displayName = String(legacy["displayName"] || "SHOPRi8 Admin");
        email = "admin@shopri8.com";
      }

      if (role && userId && displayName) {
        sessions[role] = {
          userId,
          role,
          displayName,
          email,
          ...(phone ? { phone } : {}),
          authenticated: true,
          loginTimestamp: now,
          ...(metadata ? { metadata } : {}),
        };
      }
    } catch {
      // Ignore malformed legacy demo sessions.
    } finally {
      localStorage.removeItem(key);
    }
  }
  const activeRoles = ROLES.filter((role) => sessions[role]);
  if (activeRoles.length > 1) return EMPTY_STORE;
  return { activeRole: activeRoles.length === 1 ? activeRoles[0]! : null, sessions };
}

function readStore(): DemoAuthStore {
  const parsed = parseStore(localStorage.getItem(STORAGE_KEY));
  if (parsed) return parsed;
  const migrated = migrateLegacySessions();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
  } catch {
    // In-memory demo authentication remains available if storage is blocked.
  }
  return migrated;
}

function publishStore(next: DemoAuthStore) {
  sharedStore = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(STORE_UPDATED_EVENT));
  } catch {
    // Keep this tab's demo session usable if storage is unavailable.
  }
  listeners.forEach((listener) => listener(sharedStore));
}

export function useDemoSession(role: DemoRole) {
  const [store, setStore] = useState(sharedStore);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const listener = (next: DemoAuthStore) => {
      setStore(next);
      setLoading(false);
    };
    const refresh = () => {
      sharedStore = readStore();
      listener(sharedStore);
      listeners.forEach((subscriber) => subscriber(sharedStore));
    };
    listeners.add(listener);
    refresh();
    const onStorage = (event: StorageEvent) => {
      if (
        event.key === STORAGE_KEY ||
        LEGACY_KEYS.includes(event.key as (typeof LEGACY_KEYS)[number])
      ) {
        refresh();
      }
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(STORE_UPDATED_EVENT, refresh);
    return () => {
      listeners.delete(listener);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(STORE_UPDATED_EVENT, refresh);
    };
  }, []);

  const session = store.activeRole === role ? (store.sessions[role] ?? null) : null;

  const startSession = (newSession: Omit<DemoAuthSession, "authenticated" | "loginTimestamp">) => {
    const session: DemoAuthSession = {
      ...newSession,
      authenticated: true,
      loginTimestamp: new Date().toISOString(),
    };
    publishStore({
      activeRole: role,
      sessions: { ...sharedStore.sessions, [role]: session },
    });
    return session;
  };

  const updateSession = (
    updates: Partial<Pick<DemoAuthSession, "displayName" | "email" | "phone" | "metadata">>,
  ) => {
    const current = sharedStore.sessions[role];
    if (!current) return;
    publishStore({
      ...sharedStore,
      sessions: { ...sharedStore.sessions, [role]: { ...current, ...updates } },
    });
  };

  const endSession = () => {
    const sessions = { ...sharedStore.sessions };
    delete sessions[role];
    clearDemoReturnTo(role);
    publishStore({
      activeRole: sharedStore.activeRole === role ? null : sharedStore.activeRole,
      sessions,
    });
  };

  return {
    session,
    loading,
    activeRole: store.activeRole,
    isAuthenticated: Boolean(session?.authenticated),
    startSession,
    updateSession,
    endSession,
  };
}

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

/**
 * The customer storefront owns every path outside the role portals, so only the
 * welcome screen and the other portals are rejected explicitly.
 */
export function isRememberablePath(role: DemoRole, pathname: string) {
  if (!pathname.startsWith(RETURN_PREFIXES[role])) return false;
  if (pathname === LOGIN_PATHS[role]) return false;
  if (pathname.includes("//")) return false;
  if (role === "customer" && ROLE_PORTAL_PREFIXES.some((p) => pathname.startsWith(`${p}/`))) {
    return false;
  }
  return true;
}

export function rememberDemoReturnTo(role: DemoRole, pathname: string) {
  if (isRememberablePath(role, pathname)) {
    try {
      sessionStorage.setItem(`${RETURN_TO_KEY_PREFIX}${role}`, pathname);
    } catch {
      // Login still works with its role's default landing page.
    }
  }
}

export function consumeDemoReturnTo(role: DemoRole, fallback: string) {
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

export function clearDemoReturnTo(role: DemoRole) {
  try {
    sessionStorage.removeItem(`${RETURN_TO_KEY_PREFIX}${role}`);
  } catch {
    // The return path is optional state.
  }
}
