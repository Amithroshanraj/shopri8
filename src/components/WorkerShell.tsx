import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, ListChecks, LogOut, Menu, Package, UserRound, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useWorkerAuth } from "@/lib/workerAuth";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { to: "/worker/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/worker/tasks", label: "Tasks", icon: ListChecks },
  { to: "/worker/profile", label: "Profile", icon: UserRound },
] as const;

export function WorkerShell() {
  const { user, loading, isAuthenticated, logout } = useWorkerAuth();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const isLogin = pathname === "/worker/login";

  useEffect(() => {
    if (loading) return;
    if (isLogin && isAuthenticated) {
      navigate({ to: "/worker/dashboard", replace: true });
    } else if (!isLogin && !isAuthenticated) {
      navigate({ to: "/worker/login", replace: true });
    }
  }, [isAuthenticated, isLogin, loading, navigate]);

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

  const signOut = () => {
    logout();
    setMenuOpen(false);
    navigate({ to: "/worker/login", replace: true });
  };

  return (
    <div className="min-h-screen bg-background md:flex">
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border bg-background/85 px-4 py-3 backdrop-blur-md md:hidden">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/20 text-soft-violet">
            <Package className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="font-display text-sm font-bold">SHOPRi8</p>
            <p className="truncate text-xs text-muted-foreground">Delivery Worker</p>
          </div>
        </div>
        <button
          type="button"
          aria-label="Open navigation menu"
          onClick={() => setMenuOpen(true)}
          className="press rounded-xl border border-border bg-card/60 p-2.5"
        >
          <Menu className="h-5 w-5" />
        </button>
      </header>

      {menuOpen && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm md:hidden">
          <div className="ml-auto flex h-full w-full max-w-xs flex-col border-l border-border bg-background p-5 shadow-2xl animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div className="min-w-0">
                <p className="font-display text-sm font-semibold">Delivery Worker</p>
                <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
              </div>
              <button
                type="button"
                aria-label="Close navigation menu"
                onClick={() => setMenuOpen(false)}
                className="rounded-lg p-2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="mt-5 flex-1 space-y-1.5">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.to || pathname.startsWith(`${item.to}/`);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setMenuOpen(false)}
                    className={cn(
                      "press flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium",
                      active
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <button
              type="button"
              onClick={signOut}
              className="press flex items-center gap-3 border-t border-border pt-4 text-sm font-medium text-destructive"
            >
              <LogOut className="h-4 w-4" /> Log out
            </button>
          </div>
        </div>
      )}

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
          <nav className="flex-1 space-y-1.5">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.to || pathname.startsWith(`${item.to}/`);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "press flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-auto border-t border-border/70 pt-4">
            <p className="truncate px-2 text-sm font-semibold">{user?.displayName}</p>
            <p className="truncate px-2 text-xs text-muted-foreground">{user?.email}</p>
            <button
              type="button"
              onClick={signOut}
              className="press mt-3 flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            >
              <LogOut className="h-4 w-4" /> Log out
            </button>
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
