import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAdminAuth } from "@/lib/adminAuth";
import { rememberDemoReturnTo } from "@/lib/demoAuth";
import { ADMIN_NAV, portalNavKeyFor } from "@/lib/portalNav";
import { PORTAL_CONTENT_PADDING, PortalBottomNav } from "@/components/layout/PortalBottomNav";
import { cn } from "@/lib/utils";

/**
 * Admin shell.
 * - Leaves /admin/login publicly accessible without layout or auth blocking.
 * - Nine admin sections are grouped into four primary destinations; mobile gets
 *   the shared fixed bottom bar and desktop reuses the same four in a sidebar.
 * - Sign out lives under More, not in either navigation.
 */
export function AdminShell() {
  const { user, loading, isAuthenticated } = useAdminAuth();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const navigate = useNavigate();
  const isLogin = pathname === "/admin/login";
  const activeKey = portalNavKeyFor(pathname);

  useEffect(() => {
    if (loading) return;
    if (isLogin && isAuthenticated) {
      navigate({ to: "/admin/dashboard", replace: true });
    } else if (!isLogin && !isAuthenticated) {
      rememberDemoReturnTo("admin", pathname);
      navigate({ to: "/admin/login", replace: true });
    } else if (pathname === "/admin" && isAuthenticated) {
      navigate({ to: "/admin/dashboard", replace: true });
    }
  }, [isAuthenticated, isLogin, loading, navigate, pathname]);

  if (isLogin) return <Outlet />;
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Loading Admin portal...</p>
      </div>
    );
  }
  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-background md:flex">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/85 px-4 py-3 backdrop-blur-md md:hidden">
        <div className="min-w-0">
          <p className="font-display text-sm font-bold">SHOPRi8</p>
          <p className="text-xs text-soft-violet">Administration</p>
        </div>
        <Link
          to="/admin/profile"
          aria-label="Administrator profile"
          className="press flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-card/60 text-xs font-semibold text-foreground"
        >
          {user?.displayName?.trim().charAt(0).toUpperCase() || "A"}
        </Link>
      </header>

      <aside className="hidden w-64 shrink-0 border-r border-border bg-card/30 backdrop-blur-md md:flex md:flex-col">
        <div className="sticky top-0 flex h-screen flex-col p-5">
          <div className="mb-6 border-b border-border/70 pb-5">
            <p className="font-display text-lg font-bold">SHOPRi8</p>
            <p className="mt-1 text-xs text-soft-violet">Admin portal</p>
          </div>

          <nav aria-label="Admin sections" className="flex-1 space-y-1.5">
            {ADMIN_NAV.items.map(({ key, to, label, icon: Icon }) => {
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
                      : "text-muted-foreground hover:bg-accent/10 hover:text-foreground",
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
              to="/admin/profile"
              className="press block rounded-xl px-2 py-1 transition-colors hover:bg-accent"
            >
              <p className="truncate text-sm font-semibold">{user?.displayName}</p>
              <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
            </Link>
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        <div className={cn("mx-auto max-w-[1500px] p-4 sm:p-6 lg:p-8", PORTAL_CONTENT_PADDING)}>
          <Outlet />
        </div>
      </main>

      <PortalBottomNav items={ADMIN_NAV.items} activeKey={activeKey} ariaLabel="Admin sections" />
    </div>
  );
}
