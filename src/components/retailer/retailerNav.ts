import { Box, LayoutDashboard, Package, Settings } from "lucide-react";

export type RetailerNavKey = "dashboard" | "orders" | "products" | "more";

export interface RetailerNavItem {
  key: RetailerNavKey;
  /** Primary destination of the section. */
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  /**
   * Every path that highlights this section. Inventory belongs to Products and
   * Shop Settings / Profile / Help belong to More.
   */
  matches: readonly string[];
}

/** Exactly four primary destinations. Everything else lives inside one of them. */
export const RETAILER_NAV: readonly RetailerNavItem[] = [
  {
    key: "dashboard",
    to: "/retailer/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    matches: ["/retailer/dashboard"],
  },
  {
    key: "orders",
    to: "/retailer/orders",
    label: "Orders",
    icon: Package,
    matches: ["/retailer/orders"],
  },
  {
    key: "products",
    to: "/retailer/products",
    label: "Products",
    icon: Box,
    matches: ["/retailer/products", "/retailer/inventory"],
  },
  {
    key: "more",
    to: "/retailer/more",
    label: "More",
    icon: Settings,
    matches: ["/retailer/more", "/retailer/shop", "/retailer/profile", "/retailer/help"],
  },
];

// Longest match wins so nested paths resolve to the most specific section.
const MATCH_ORDER = RETAILER_NAV.flatMap((item) =>
  item.matches.map((match) => ({ match, key: item.key })),
).sort((a, b) => b.match.length - a.match.length);

export function retailerNavKeyFor(pathname: string): RetailerNavKey | null {
  return MATCH_ORDER.find(({ match }) => pathname.startsWith(match))?.key ?? null;
}

export function isRetailerNavActive(pathname: string, key: RetailerNavKey) {
  return retailerNavKeyFor(pathname) === key;
}
