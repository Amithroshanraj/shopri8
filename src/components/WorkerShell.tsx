import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { Package } from "lucide-react";
import { useEffect } from "react";
import { useWorkerAuth } from "@/lib/workerAuth";
import { rememberDemoReturnTo } from "@/lib/demoAuth";
import { WORKER_NAV, portalNavKeyFor } from "@/lib/portalNav";
import { PORTAL_CONTENT_PADDING, PortalBottomNav } from "@/components/layout/PortalBottomNav";
import { cn } from "@/lib/utils";

/**
 * Delivery Worker shell.
 * - Leaves /worker/login publicly accessible without layout or auth blocking.
 * - Mobile uses the shared fixed four-item bottom bar; desktop reuses the same
 *   destinations in a sidebar. Sign out lives under More, not in either.
 */
export function WorkerShell() {
  const { user, loading, isAuthenticated } = useWorkerAuth();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const navigate = useNavigate();
  const isLogin = pathname === "/worker/login";
  const activeKey = portalNavKeyFor(pathname);

  useEffect(() => {
    if (loading) return;
    if (isLogin && isAuthenticated) {
      navigate({ to: "/worker/dashboard", replace: true });
    } else if (!isLogin && !isAuthenticated) {
      rememberDemoReturnTo("deliveryWorker", pathname);
      navigate({ to: "/worker/login", replace: true });
    }
  }, [isAuthenticated, isLogin, loading, navigate, pathname]);

  if (isLogin) return <Outlet />;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="mt-3 text-sm text-muted-foreground">Loading Delivery Worker portal...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-background md:flex">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/85 px-4 py-3 backdrop-blur-md md:hidden">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/20 text-soft-violet">
            <Package className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="font-display text-sm font-bold">SHOPRi8</p>
            <p className="truncate text-xs text-muted-foreground">Delivery Worker</p>
          </div>
        </div>
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[0.65rem] font-medium",
            user?.available ? "bg-success/15 text-success" : "bg-muted text-muted-foreground",
          )}
        >
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              user?.available ? "bg-success" : "bg-muted-foreground",
            )}
          />
          {user?.available ? "Available" : "Offline"}
        </span>
      </header>

      <aside className="hidden w-64 shrink-0 border-r border-border bg-card/30 backdrop-blur-md md:flex md:flex-col">
        <div className="sticky top-0 flex h-screen flex-col p-5">
          <div className="mb-6 flex items-center gap-3 border-b border-border/70 pb-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20 text-soft-violet">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <p className="font-display text-base font-bold">SHOPRi8</p>
              <p className="text-xs text-muted-foreground">Delivery Worker</p>
            </div>
          </div>

          <nav aria-label="Delivery sections" className="flex-1 space-y-1.5">
            {WORKER_NAV.items.map(({ key, to, label, icon: Icon }) => {
              const active = activeKey === key;
              return (
                <Link
                  key={key}
                  to={to}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "press flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" strokeWidth={1.8} />
                  {label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto border-t border-border/70 pt-4">
            <Link
              to="/worker/profile"
              className="press block rounded-xl px-2 py-1 transition-colors hover:bg-accent"
            >
              <p className="truncate text-sm font-semibold">{user?.displayName}</p>
              <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
            </Link>
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        <div className={cn("mx-auto max-w-6xl p-4 sm:p-6 lg:p-8", PORTAL_CONTENT_PADDING)}>
          <Outlet />
        </div>
      </main>

      <PortalBottomNav
        items={WORKER_NAV.items}
        activeKey={activeKey}
        ariaLabel="Delivery sections"
      />
    </div>
  );
}
