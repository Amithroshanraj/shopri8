import { Link, useRouterState, useNavigate, Outlet } from "@tanstack/react-router";
import { useEffect } from "react";
import { Store } from "lucide-react";
import { useRetailerAuth } from "@/lib/retailerAuth";
import { rememberDemoReturnTo } from "@/lib/demoAuth";
import { useRetailerStore } from "@/lib/retailerStore";
import {
  RETAILER_NAV,
  isRetailerNavActive,
  retailerNavKeyFor,
} from "@/components/retailer/retailerNav";
import { PORTAL_CONTENT_PADDING, PortalBottomNav } from "@/components/layout/PortalBottomNav";
import { cn } from "@/lib/utils";

/**
 * Unified Retailer Shell and Layout.
 * - Leaves /retailer/login publicly accessible without layout or auth blocking.
 * - Protects authenticated retailer pages with capability verification.
 * - Mobile uses the shared fixed four-item bottom bar; desktop reuses the same
 *   four destinations in a sidebar, so the information architecture matches.
 */
export function RetailerShell() {
  const { user, isAuthenticated, isRetailer, loading } = useRetailerAuth();
  const { shop } = useRetailerStore();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const isLoginPage = pathname === "/retailer/login";

  // Redirect to login if user is not authenticated and trying to access protected routes
  useEffect(() => {
    if (!isLoginPage && !loading && (!isAuthenticated || !isRetailer)) {
      rememberDemoReturnTo("retailer", pathname);
      navigate({ to: "/retailer/login", replace: true });
    }
  }, [isLoginPage, loading, isAuthenticated, isRetailer, navigate, pathname]);

  // Public login page renders directly without navigation or auth guard
  if (isLoginPage) {
    return <Outlet />;
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto" />
          <p className="mt-3 text-sm text-muted-foreground">Loading retailer portal...</p>
        </div>
      </div>
    );
  }

  // Not authenticated for protected pages
  if (!isAuthenticated || !isRetailer) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      {/* Mobile Top Header */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border bg-background/80 px-4 py-3 backdrop-blur-md md:hidden">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/20 text-soft-violet">
            <Store className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-display text-sm font-bold tracking-tight text-foreground">
                SHOPRi8
              </span>
              <span className="rounded bg-primary/20 px-1.5 py-0.2 text-[0.65rem] font-semibold text-soft-violet">
                Retailer
              </span>
            </div>
            <p className="truncate text-[0.7rem] text-muted-foreground">
              {shop?.name || "My Shop"}
            </p>
          </div>
        </div>

        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[0.65rem] font-medium",
            shop?.status === "ACTIVE"
              ? "bg-success/15 text-success"
              : "bg-muted text-muted-foreground",
          )}
        >
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              shop?.status === "ACTIVE" ? "bg-success" : "bg-muted-foreground",
            )}
          />
          {shop?.status === "ACTIVE" ? "Open" : "Closed"}
        </span>
      </header>

      {/* Desktop / Tablet Sidebar — same four destinations as the bottom bar */}
      <aside className="hidden md:flex md:w-64 md:shrink-0 md:flex-col border-r border-border bg-card/30 backdrop-blur-md">
        <div className="sticky top-0 flex h-screen flex-col p-5">
          {/* Brand & Shop Header */}
          <div className="mb-6 pb-4 border-b border-border/60">
            <div className="flex items-center gap-2">
              <span className="font-display text-lg font-bold tracking-tight text-foreground">
                SHOPRi8
              </span>
              <span className="rounded-md bg-primary/20 px-2 py-0.5 text-[0.7rem] font-semibold text-soft-violet">
                Retailer
              </span>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <p className="max-w-[140px] truncate text-xs font-medium text-foreground">
                {shop?.name || "Green Basket"}
              </p>
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.65rem] font-medium",
                  shop?.status === "ACTIVE"
                    ? "bg-success/15 text-success"
                    : "bg-muted text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    shop?.status === "ACTIVE" ? "bg-success" : "bg-muted-foreground",
                  )}
                />
                {shop?.status === "ACTIVE" ? "Open" : "Closed"}
              </span>
            </div>
          </div>

          {/* Primary sections */}
          <nav aria-label="Retailer sections" className="flex-1 space-y-1">
            {RETAILER_NAV.map(({ key, to, label, icon: Icon }) => {
              const active = isRetailerNavActive(pathname, key);
              return (
                <Link
                  key={key}
                  to={to}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "press flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" strokeWidth={1.8} />
                  {label}
                </Link>
              );
            })}
          </nav>

          {/* Account footer — sign out lives under More, not here */}
          <div className="mt-auto border-t border-border/60 pt-4">
            <Link
              to="/retailer/profile"
              className="press block rounded-xl px-2 py-1 transition-colors hover:bg-accent"
            >
              <p className="truncate text-xs font-medium text-foreground">
                {user?.displayName || "Demo Retailer"}
              </p>
              <p className="truncate text-[0.7rem] text-muted-foreground">{user?.email}</p>
            </Link>
          </div>
        </div>
      </aside>

      {/* Main Content Area — bottom padding clears the fixed mobile nav */}
      <main className="min-w-0 flex-1 overflow-y-auto">
        <div className={cn("mx-auto max-w-6xl p-4 sm:p-6 lg:p-8", PORTAL_CONTENT_PADDING)}>
          <Outlet />
        </div>
      </main>

      <PortalBottomNav
        items={RETAILER_NAV}
        activeKey={retailerNavKeyFor(pathname)}
        ariaLabel="Retailer sections"
      />
    </div>
  );
}
