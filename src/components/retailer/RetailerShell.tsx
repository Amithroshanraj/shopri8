import { Link, useRouterState, useNavigate, Outlet } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  BarChart3,
  Box,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Settings,
  Store,
  X,
} from "lucide-react";
import { useRetailerAuth } from "@/lib/retailerAuth";
import { useRetailerStore } from "@/lib/retailerStore";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { to: "/retailer/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/retailer/orders", label: "Orders", icon: Package },
  { to: "/retailer/products", label: "Products", icon: Box },
  { to: "/retailer/inventory", label: "Inventory", icon: BarChart3 },
  { to: "/retailer/shop", label: "Shop Settings", icon: Store },
  { to: "/retailer/profile", label: "Profile", icon: Settings },
] as const;

/**
 * Unified Retailer Shell and Layout.
 * - Leaves /retailer/login publicly accessible without layout or auth blocking.
 * - Protects authenticated retailer pages with capability verification.
 * - Provides desktop sidebar and compact mobile navigation.
 */
export function RetailerShell() {
  const { user, logout, isAuthenticated, isRetailer, loading } = useRetailerAuth();
  const { shop } = useRetailerStore();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const isLoginPage = pathname === "/retailer/login";

  // Redirect to login if user is not authenticated and trying to access protected routes
  useEffect(() => {
    if (!isLoginPage && !loading && (!isAuthenticated || !isRetailer)) {
      navigate({ to: "/retailer/login", replace: true });
    }
  }, [isLoginPage, loading, isAuthenticated, isRetailer, navigate]);

  // Public login page renders directly without sidebar or auth guard
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
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border bg-background/80 backdrop-blur-md px-4 py-3 md:hidden">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20 text-soft-violet">
            <Store className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-display text-sm font-bold tracking-tight text-foreground">
                SHOPRi8
              </span>
              <span className="rounded bg-primary/20 px-1.5 py-0.2 text-[0.65rem] font-semibold text-soft-violet">
                Retailer
              </span>
            </div>
            <p className="text-[0.7rem] text-muted-foreground truncate max-w-[160px]">
              {shop?.name || "My Shop"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
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

          <button
            onClick={() => setMobileMenuOpen(true)}
            className="press rounded-xl p-2 text-foreground glass-1"
            aria-label="Open navigation menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Mobile Slide-in Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm md:hidden">
          <div className="fixed inset-y-0 right-0 w-full max-w-xs bg-background border-l border-border p-5 flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Store className="h-5 w-5 text-soft-violet" />
                <div>
                  <h2 className="font-display text-sm font-semibold">
                    {shop?.name || "Shop Portal"}
                  </h2>
                  <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                </div>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="press rounded-full p-2 text-muted-foreground hover:text-foreground"
                aria-label="Close navigation menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="mt-6 flex-1 space-y-1.5">
              {NAV_ITEMS.map((item) => {
                const active = pathname === item.to || pathname.startsWith(`${item.to}/`);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      "press flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors",
                      active
                        ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground",
                    )}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="pt-4 border-t border-border mt-auto">
              <button
                onClick={() => {
                  logout();
                  setMobileMenuOpen(false);
                  navigate({ to: "/retailer/login" });
                }}
                className="press flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
              >
                <LogOut className="h-5 w-5 shrink-0" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Desktop / Tablet Sidebar */}
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
              <p className="text-xs font-medium text-foreground truncate max-w-[140px]">
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

          {/* Nav Items */}
          <nav className="flex-1 space-y-1">
            {NAV_ITEMS.map((item) => {
              const active = pathname === item.to || pathname.startsWith(`${item.to}/`);
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "press flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* User Profile Footer */}
          <div className="mt-auto pt-4 border-t border-border/60">
            <div className="mb-3 px-2">
              <p className="text-xs font-medium text-foreground truncate">
                {user?.displayName || "Demo Retailer"}
              </p>
              <p className="text-[0.7rem] text-muted-foreground truncate">{user?.email}</p>
            </div>
            <button
              onClick={() => {
                logout();
                navigate({ to: "/retailer/login" });
              }}
              className="press flex w-full items-center gap-2.5 rounded-xl px-3.5 py-2 text-xs font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto min-w-0">
        <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
