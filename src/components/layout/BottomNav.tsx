import { Link, useRouterState } from "@tanstack/react-router";
import { Grid2x2, Home, Map, User } from "lucide-react";
import { cn } from "@/lib/utils";

/** Customer navigation — exactly four destinations, nothing else. */
const ITEMS = [
  { to: "/", label: "Home", icon: Home },
  { to: "/categories", label: "Categories", icon: Grid2x2 },
  { to: "/map", label: "Map", icon: Map },
  { to: "/profile", label: "Profile", icon: User },
] as const;

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="pointer-events-auto flex items-center gap-1 rounded-full glass-3 p-1.5">
        {ITEMS.map(({ to, label, icon: Icon }) => {
          const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
          return (
            <Link
              key={to}
              to={to}
              aria-label={label}
              aria-current={active ? "page" : undefined}
              className={cn(
                "press relative flex min-w-[4.25rem] flex-col items-center gap-1 rounded-full px-4 py-2 text-[0.7rem] font-medium",
                active ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {active ? (
                <span
                  className="absolute inset-0 rounded-full bg-primary glow-primary"
                  aria-hidden
                />
              ) : null}
              <Icon
                className={cn("relative h-5 w-5 transition-transform", active && "scale-110")}
                strokeWidth={1.8}
              />
              <span className="relative">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
