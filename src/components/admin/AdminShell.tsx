import {
  Activity,
  Boxes,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Settings,
  Store,
  Truck,
  Users,
  X,
} from "lucide-react";
import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAdminAuth } from "@/lib/adminAuth";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { to: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/retailers", label: "Retailers", icon: Store },
  { to: "/admin/shops", label: "Shops", icon: Boxes },
  { to: "/admin/products", label: "Products", icon: Package },
  { to: "/admin/orders", label: "Orders", icon: Activity },
  { to: "/admin/delivery", label: "Delivery", icon: Truck },
  { to: "/admin/settings", label: "Settings", icon: Settings },
  { to: "/admin/profile", label: "Profile", icon: Users },
] as const;

export function AdminShell() {
  const { user, loading, isAuthenticated, logout } = useAdminAuth();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const isLogin = pathname === "/admin/login";

  useEffect(() => {
    if (loading) return;
    if (isLogin && isAuthenticated) {
      navigate({ to: "/admin/dashboard", replace: true });
    } else if (!isLogin && !isAuthenticated) {
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

  const signOut = () => {
    logout();
    setMenuOpen(false);
    navigate({ to: "/admin/login", replace: true });
  };

  const navigation = (mobile = false) => (
    <nav className="space-y-1.5">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.to || pathname.startsWith(`${item.to}/`);
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={() => mobile && setMenuOpen(false)}
            className={cn(
              "press flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-accent/10 hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-background md:flex">
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border bg-background/85 px-4 py-3 backdrop-blur-md md:hidden">
        <div className="min-w-0">
          <p className="font-display text-sm font-bold">SHOPRi8</p>
          <p className="text-xs text-soft-violet">Administration</p>
        </div>
        <button
          type="button"
          aria-label="Open Admin navigation"
          onClick={() => setMenuOpen(true)}
          className="press rounded-xl border border-border bg-card/60 p-2.5"
        >
          <Menu className="h-5 w-5" />
        </button>
      </header>

      {menuOpen && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm md:hidden">
          <div className="ml-auto flex h-full w-full max-w-xs flex-col border-l border-border bg-background p-5 shadow-2xl">
            <div className="mb-5 flex items-center justify-between border-b border-border pb-4">
              <div>
                <p className="font-display text-sm font-semibold">Admin portal</p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
              </div>
              <button
                type="button"
                aria-label="Close Admin navigation"
                onClick={() => setMenuOpen(false)}
                className="rounded-lg p-2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {navigation(true)}
            <button
              type="button"
              onClick={signOut}
              className="mt-auto flex items-center gap-3 border-t border-border pt-4 text-sm font-medium text-destructive"
            >
              <LogOut className="h-4 w-4" /> Log out
            </button>
          </div>
        </div>
      )}

      <aside className="hidden w-64 shrink-0 border-r border-border bg-card/30 md:flex md:flex-col">
        <div className="sticky top-0 flex h-screen flex-col p-5">
          <div className="mb-6 border-b border-border/70 pb-5">
            <p className="font-display text-lg font-bold">SHOPRi8</p>
            <p className="mt-1 text-xs text-soft-violet">Admin portal</p>
          </div>
          <div className="flex-1">{navigation()}</div>
          <div className="border-t border-border/70 pt-4">
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
        <div className="mx-auto max-w-[1500px] p-4 sm:p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
