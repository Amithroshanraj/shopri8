import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, LogOut, MapPin, Package, Search } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { CategoryCarousel } from "@/components/common/CategoryCarousel";
import { Wordmark } from "@/components/brand/Wordmark";
import { ShopCard } from "@/components/shop/Cards";
import { CATEGORIES, DEMO_CENTER, DEMO_MODE_NOTE, SHOPS } from "@/data/demo";
import { distanceKm } from "@/lib/geo";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { useAuth } from "@/hooks/useAuth";
import { signOut } from "@/lib/firebase/auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SHOPRi8 — Shops near you" },
      {
        name: "description",
        content: "Browse open shops around you and order groceries, medicines, flowers and more.",
      },
      { property: "og:title", content: "SHOPRi8 — Shops near you" },
      {
        property: "og:description",
        content: "Shop Nearby. Live Local. Order from neighbourhood shops.",
      },
    ],
  }),
  component: Home,
});

function Home() {
  const { user } = useAuth();
  const nearby = [...SHOPS].sort((a, b) => distanceKm(DEMO_CENTER, a) - distanceKm(DEMO_CENTER, b));
  return (
    <AppShell>
      <header className="mb-5 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <Wordmark />
          <p className="mt-1 flex items-center gap-1 truncate text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-soft-violet" /> Shanthi Nagar, Bengaluru
          </p>
        </div>
        <div className="flex items-center gap-2">
          {user && (
            <button
              onClick={() => signOut()}
              aria-label="Sign out"
              className="press flex h-10 w-10 items-center justify-center rounded-xl glass-1"
            >
              <LogOut className="h-5 w-5" strokeWidth={1.8} />
            </button>
          )}
          <Link
            to="/orders"
            aria-label="My orders"
            className="press flex h-10 w-10 items-center justify-center rounded-xl glass-1"
          >
            <Package className="h-5 w-5" strokeWidth={1.8} />
          </Link>
        </div>
      </header>

      <Link
        to="/search"
        className="press mb-6 flex items-center gap-3 rounded-2xl glass-2 px-4 py-3.5 text-sm text-muted-foreground"
      >
        <Search className="h-4 w-4 text-soft-violet" /> Search shops or products
      </Link>

      {!isFirebaseConfigured ? (
        <p className="mb-5 rounded-xl border border-border bg-primary/10 px-3 py-2 text-xs text-soft-violet">
          {DEMO_MODE_NOTE}
        </p>
      ) : null}

      <section className="mb-7">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-base font-semibold">Categories</h2>
          <Link to="/categories" className="flex items-center text-xs text-soft-violet">
            All <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <CategoryCarousel />
      </section>

      <section>
        <h2 className="mb-3 font-display text-base font-semibold">Nearby shops</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {nearby.map((s) => (
            <ShopCard key={s.id} shop={s} />
          ))}
        </div>
      </section>
    </AppShell>
  );
}
