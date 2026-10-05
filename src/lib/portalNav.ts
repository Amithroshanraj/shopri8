import {
  Activity,
  Boxes,
  ClipboardCheck,
  LayoutDashboard,
  ListChecks,
  Package,
  Settings,
  Store,
  Truck,
  Users,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import type { PortalNavItem } from "@/components/layout/PortalBottomNav";

/**
 * Delivery Worker and Admin primary navigation — four destinations each.
 * Everything else is reached from More, so the information architecture matches
 * across devices. Existing routes are untouched.
 */
export interface PortalSection {
  items: readonly PortalNavItem[];
  /** Path prefix -> primary section key. Longest match wins. */
  matches: readonly (readonly [string, string])[];
}

export const WORKER_NAV: PortalSection = {
  items: [
    { key: "dashboard", to: "/worker/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { key: "tasks", to: "/worker/tasks", label: "Tasks", icon: ListChecks },
    { key: "profile", to: "/worker/profile", label: "Profile", icon: UserRound },
    { key: "more", to: "/worker/more", label: "More", icon: Settings },
  ],
  matches: [
    ["/worker/dashboard", "dashboard"],
    ["/worker/tasks", "tasks"],
    ["/worker/profile", "profile"],
    ["/worker/more", "more"],
    ["/worker/help", "more"],
  ],
};

export const ADMIN_NAV: PortalSection = {
  items: [
    { key: "dashboard", to: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { key: "orders", to: "/admin/orders", label: "Orders", icon: Activity },
    { key: "catalog", to: "/admin/products", label: "Catalog", icon: Boxes },
    { key: "more", to: "/admin/more", label: "More", icon: Settings },
  ],
  matches: [
    ["/admin/dashboard", "dashboard"],
    ["/admin/orders", "orders"],
    ["/admin/products", "catalog"],
    ["/admin/shops", "catalog"],
    ["/admin/retailers", "catalog"],
    ["/admin/retailer-applications", "more"],
    ["/admin/more", "more"],
    ["/admin/users", "more"],
    ["/admin/delivery", "more"],
    ["/admin/settings", "more"],
    ["/admin/profile", "more"],
  ],
};

const RESOLVED = [WORKER_NAV, ADMIN_NAV]
  .flatMap((section) => section.matches.map(([prefix, key]) => ({ prefix, key })))
  .sort((a, b) => b.prefix.length - a.prefix.length);

/** Resolves a path to its primary section key, or null outside these portals. */
export function portalNavKeyFor(pathname: string) {
  return RESOLVED.find(({ prefix }) => pathname.startsWith(prefix))?.key ?? null;
}

export const WORKER_MORE_LINKS = [
  {
    to: "/worker/help",
    label: "Help & Support",
    description: "Delivery guidelines and contact",
    icon: Package,
  },
] as const;

export const ADMIN_MORE_LINKS = [
  {
    to: "/admin/retailer-applications",
    label: "Retailer applications",
    description: "Review applications and approve shops",
    icon: ClipboardCheck,
  },
  { to: "/admin/users", label: "Users", description: "Customer accounts", icon: Users },
  { to: "/admin/retailers", label: "Retailers", description: "Retailer partners", icon: Store },
  { to: "/admin/shops", label: "Shops", description: "Registered shops", icon: Boxes },
  {
    to: "/admin/delivery",
    label: "Delivery",
    description: "Delivery tasks and riders",
    icon: Truck,
  },
  {
    to: "/admin/settings",
    label: "Settings",
    description: "Platform configuration",
    icon: Settings,
  },
  {
    to: "/admin/profile",
    label: "Profile",
    description: "Your administrator account",
    icon: UserRound,
  },
] as const;

export const HELP_ICON: LucideIcon = Package;
