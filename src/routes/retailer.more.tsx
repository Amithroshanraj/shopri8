import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, CircleHelp, Store, User } from "lucide-react";
import { RoleSignOut } from "@/components/layout/RoleSignOut";
import { useRetailerStore } from "@/lib/retailerStore";
import { useRetailerAuth } from "@/lib/retailerAuth";

export const Route = createFileRoute("/retailer/more")({
  head: () => ({
    meta: [
      { title: "More — SHOPRi8 Retailer" },
      { name: "description", content: "Profile, shop settings, support and sign out." },
    ],
  }),
  component: RetailerMore,
});

interface MoreRow {
  to: string;
  label: string;
  description: string;
  icon: typeof User;
}

const GROUPS: { title: string; rows: MoreRow[] }[] = [
  {
    title: "Account",
    rows: [
      {
        to: "/retailer/profile",
        label: "Profile",
        description: "Your retailer details and shop association",
        icon: User,
      },
    ],
  },
  {
    title: "Shop",
    rows: [
      {
        to: "/retailer/shop",
        label: "Shop Settings",
        description: "Name, category, address, location and opening hours",
        icon: Store,
      },
    ],
  },
  {
    title: "Support",
    rows: [
      {
        to: "/retailer/help",
        label: "Help & Support",
        description: "Answers to common questions and how to reach us",
        icon: CircleHelp,
      },
    ],
  },
];

function RetailerMore() {
  const { shop } = useRetailerStore();
  const { user, logout } = useRetailerAuth();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">More</h1>
        <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
          Account, shop and support for {shop?.name || "your shop"}.
        </p>
      </header>

      <div className="rounded-3xl glass-2 p-5">
        <p className="text-sm font-semibold text-foreground">{user?.displayName}</p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{user?.email}</p>
      </div>

      {GROUPS.map((group) => (
        <section key={group.title}>
          <h2 className="mb-2 px-1 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {group.title}
          </h2>
          <div className="overflow-hidden rounded-2xl glass-1">
            {group.rows.map(({ to, label, description, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className="press flex items-center gap-3 border-b border-border/60 px-4 py-3.5 last:border-b-0"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-soft-violet">
                  <Icon className="h-4 w-4" strokeWidth={1.8} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-foreground">{label}</span>
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                    {description}
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            ))}
          </div>
        </section>
      ))}

      <div className="rounded-2xl border border-destructive/25 bg-destructive/5">
        <RoleSignOut onSignOut={logout} redirectTo="/retailer/login" />
      </div>
    </div>
  );
}
