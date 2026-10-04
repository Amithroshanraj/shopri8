import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { RoleSignOut } from "@/components/layout/RoleSignOut";
import { useAdminAuth } from "@/lib/adminAuth";
import { ADMIN_MORE_LINKS } from "@/lib/portalNav";

export const Route = createFileRoute("/admin/more")({
  head: () => ({
    meta: [
      { title: "More — SHOPRi8 Admin" },
      { name: "description", content: "Platform administration, settings and sign out." },
    ],
  }),
  component: AdminMore,
});

const GROUPS = [
  { title: "People", links: ADMIN_MORE_LINKS.slice(0, 2) },
  { title: "Operations", links: ADMIN_MORE_LINKS.slice(2, 4) },
  { title: "Platform", links: ADMIN_MORE_LINKS.slice(4) },
];

function AdminMore() {
  const { user, logout } = useAdminAuth();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">More</h1>
        <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
          Platform administration for SHOPRi8.
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
            {group.links.map(({ to, label, description, icon: Icon }) => (
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
          redirectTo="/admin/login"
          label="Sign Out of Admin Portal"
        />
      </div>
    </div>
  );
}
