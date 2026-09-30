import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Search as SearchIcon, X } from "lucide-react";
import { z } from "zod";
import { AppShell, EmptyState, PageHeader } from "@/components/layout/AppShell";
import { ProductRow, ShopCard } from "@/components/shop/Cards";
import { CATEGORIES, CATEGORY_BY_ID, PRODUCTS, SHOPS } from "@/data/demo";
import type { CategoryId } from "@/lib/types";
import { cn } from "@/lib/utils";

const schema = z.object({ q: z.string().optional(), category: z.string().optional() });

export const Route = createFileRoute("/search")({
  validateSearch: schema,
  head: () => ({
    meta: [
      { title: "Search — SHOPRi8" },
      { name: "description", content: "Find shops and products in your neighbourhood." },
      { property: "og:title", content: "Search — SHOPRi8" },
      { property: "og:description", content: "Find shops and products near you." },
    ],
  }),
  component: SearchPage,
});

function SearchPage() {
  const { q = "", category } = Route.useSearch();
  const navigate = useNavigate({ from: "/search" });
  const term = q.trim().toLowerCase();
  const cat = category as CategoryId | undefined;
  const shops = SHOPS.filter(
    (s) => (!cat || s.category === cat) && (!term || s.name.toLowerCase().includes(term)),
  );
  const products = term
    ? PRODUCTS.filter((p) => (!cat || p.category === cat) && p.name.toLowerCase().includes(term))
    : [];

  return (
    <AppShell>
      <PageHeader title={cat ? (CATEGORY_BY_ID[cat]?.name ?? "Search") : "Search"} />
      <div className="mb-4 flex items-center gap-3 rounded-2xl glass-2 px-4 py-3">
        <SearchIcon className="h-4 w-4 shrink-0 text-soft-violet" />
        <input
          autoFocus
          value={q}
          onChange={(e) =>
            navigate({ search: (s) => ({ ...s, q: e.target.value || undefined }), replace: true })
          }
          placeholder="Search shops or products"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        {q ? (
          <button
            aria-label="Clear"
            onClick={() => navigate({ search: (s) => ({ ...s, q: undefined }), replace: true })}
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        ) : null}
      </div>
      <div className="no-scrollbar -mx-4 mb-5 flex gap-2 overflow-x-auto px-4">
        {[{ id: undefined, name: "All" }, ...CATEGORIES].map((c) => (
          <button
            key={c.id ?? "all"}
            onClick={() => navigate({ search: (s) => ({ ...s, category: c.id }), replace: true })}
            className={cn(
              "press shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium",
              cat === c.id ? "bg-primary text-primary-foreground" : "glass-1 text-muted-foreground",
            )}
          >
            {c.name}
          </button>
        ))}
      </div>
      {shops.length === 0 && products.length === 0 ? (
        <EmptyState
          icon={<SearchIcon className="h-6 w-6" />}
          title="Nothing found"
          body="Try another word or category."
        />
      ) : (
        <div className="space-y-6">
          {shops.length ? (
            <section>
              <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Shops</h2>
              <div className="grid gap-3">
                {shops.map((s) => (
                  <ShopCard key={s.id} shop={s} />
                ))}
              </div>
            </section>
          ) : null}
          {products.length ? (
            <section>
              <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Products</h2>
              <div className="grid gap-3">
                {products.map((p) => (
                  <ProductRow key={p.id} product={p} />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </AppShell>
  );
}
