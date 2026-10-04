import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, Package } from "lucide-react";
import { RoleSignOut } from "@/components/layout/RoleSignOut";
import { useWorkerAuth } from "@/lib/workerAuth";

export const Route = createFileRoute("/worker/more")({
  head: () => ({
    meta: [
      { title: "More — SHOPRi8 Delivery" },
      { name: "description", content: "Delivery worker support and sign out." },
    ],
  }),
  component: WorkerMore,
});

const GROUPS = [
  {
    title: "Support",
    rows: [
      {
        to: "/worker/help" as const,
        label: "Help & Support",
        description: "Delivery guidelines and how to reach the SHOPRi8 team",
        icon: Package,
      },
    ],
  },
];

function WorkerMore() {
  const { user, logout } = useWorkerAuth();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">More</h1>
        <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
          Account and support for your delivery work.
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
        <RoleSignOut
          onSignOut={logout}
          redirectTo="/worker/login"
          label="Sign Out of Delivery Account"
        />
      </div>
    </div>
  );
}
