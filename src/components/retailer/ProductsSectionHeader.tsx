import { Link } from "@tanstack/react-router";
import { Boxes, PackageSearch } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "/retailer/products", label: "Products", icon: PackageSearch },
  { to: "/retailer/inventory", label: "Inventory", icon: Boxes },
] as const;

/**
 * Secondary navigation shared by the Products and Inventory routes so both read
 * as one section. The routes stay separate, so existing deep links keep working.
 */
export function ProductsSectionHeader({ active }: { active: "products" | "inventory" }) {
  return (
    <div className="mb-5">
      <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">Products</h1>
      <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
        Manage your catalogue and keep stock levels accurate.
      </p>

      <div
        role="tablist"
        aria-label="Products section"
        className="mt-4 inline-flex rounded-xl glass-1 p-1"
      >
        {TABS.map(({ to, label, icon: Icon }) => {
          const selected = active === (to === "/retailer/inventory" ? "inventory" : "products");
          return (
            <Link
              key={to}
              to={to}
              role="tab"
              aria-selected={selected}
              className={cn(
                "press flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                selected
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" strokeWidth={1.8} />
              {label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
