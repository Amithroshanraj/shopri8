import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ChevronRight, LogIn, LogOut, MapPin, Package, Store, User } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Wordmark } from "@/components/brand/Wordmark";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Profile — SHOPRi8" },
      { name: "description", content: "Your SHOPRi8 account, orders and saved addresses." },
      { property: "og:title", content: "Profile — SHOPRi8" },
      { property: "og:description", content: "Manage your SHOPRi8 account." },
    ],
  }),
  component: Profile,
});

function Profile() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const rows = [
    { to: "/orders", label: "My orders", icon: Package },
    { to: "/addresses", label: "Saved addresses", icon: MapPin },
  ] as const;
  return (
    <AppShell>
      <h1 className="mb-5 font-display text-xl font-semibold">Profile</h1>
      <div className="mb-5 flex items-center gap-4 rounded-3xl glass-2 p-5">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary glow-primary">
          <User className="h-6 w-6 text-primary-foreground" />
        </span>
        <div className="min-w-0">
          <p className="truncate font-semibold">
            {user ? (user.displayName ?? user.phoneNumber ?? user.email) : "Guest"}
          </p>
          <p className="text-xs text-muted-foreground">
            {user ? "Signed in" : "Sign in to sync your orders"}
          </p>
        </div>
      </div>
      <div className="mb-5 overflow-hidden rounded-2xl glass-1">
        {rows.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className="flex items-center gap-3 border-b border-border px-4 py-4 last:border-0"
          >
            <Icon className="h-5 w-5 text-soft-violet" strokeWidth={1.8} />
            <span className="flex-1 text-sm">{label}</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        ))}
      </div>
      {user ? (
        <Link
          to="/retailer-application"
          className="mb-5 flex items-center gap-3 rounded-2xl border border-primary/25 bg-primary/10 p-4"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-soft-violet">
            <Store className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">Become a Retailer</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              Apply to sell your products through SHOPRi8
            </span>
          </span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Link>
      ) : null}
      {user ? (
        <button
          onClick={() => {
            logout();
            navigate({ to: "/auth", replace: true });
          }}
          className="press flex w-full items-center justify-center gap-2 rounded-2xl glass-1 py-3.5 text-sm font-semibold text-destructive"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      ) : (
        <Link
          to="/auth"
          className="press flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground"
        >
          <LogIn className="h-4 w-4" /> Sign in
        </Link>
      )}
      <div className="mt-10 flex justify-center opacity-70">
        <Wordmark showTagline className="items-center" />
      </div>
    </AppShell>
  );
}
