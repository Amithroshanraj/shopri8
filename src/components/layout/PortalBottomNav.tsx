import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PortalNavItem {
  key: string;
  to: string;
  label: string;
  icon: LucideIcon;
}

/**
 * Shared fixed bottom navigation for the Retailer, Delivery Worker and Admin
 * portals. Exactly four primary destinations per portal, mirroring the customer
 * shell's glass treatment with a wider bar so labelled items keep comfortable
 * touch targets on a phone.
 */
export function PortalBottomNav({
  items,
  activeKey,
  ariaLabel,
}: {
  items: readonly PortalNavItem[];
  activeKey: string | null;
  ariaLabel: string;
}) {
  return (
    <nav
      aria-label={ariaLabel}
      className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[max(0.625rem,env(safe-area-inset-bottom))] md:hidden"
    >
      <div className="flex w-full max-w-md items-stretch gap-1 rounded-2xl glass-3 p-1.5 shadow-lg shadow-black/20">
        {items.map(({ key, to, label, icon: Icon }) => {
          const active = activeKey === key;
          return (
            <Link
              key={key}
              to={to}
              aria-label={label}
              aria-current={active ? "page" : undefined}
              className={cn(
                "press relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-[0.68rem] font-medium transition-colors",
                active ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {active ? (
                <span
                  className="absolute inset-0 rounded-xl bg-primary shadow-md shadow-primary/25"
                  aria-hidden
                />
              ) : null}
              <Icon
                className={cn(
                  "relative h-5 w-5 shrink-0 transition-transform duration-200",
                  active && "scale-105",
                )}
                strokeWidth={1.8}
              />
              <span className="relative w-full truncate text-center leading-tight">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/** Bottom padding that clears the fixed bar plus the device safe-area inset. */
export const PORTAL_CONTENT_PADDING =
  "pb-[calc(5rem+max(0.75rem,env(safe-area-inset-bottom))+1.5rem)] sm:pb-[calc(5rem+max(0.75rem,env(safe-area-inset-bottom))+1.5rem)] lg:pb-10";
