import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { useActiveShops, useCategories } from "@/hooks/useCatalog";

export const Route = createFileRoute("/categories")({
  head: () => ({
    meta: [
      { title: "Categories — SHOPRi8" },
      { name: "description", content: "Browse neighbourhood shops by category on SHOPRi8." },
      { property: "og:title", content: "Categories — SHOPRi8" },
      {
        property: "og:description",
        content: "Grocery, pharmacy, flowers, bakery and more near you.",
      },
    ],
  }),
  component: Categories,
});

function Categories() {
  const { data: categories = [], isPending, isError, error } = useCategories();
  const shopsQuery = useActiveShops();
  const shops = shopsQuery.data ?? [];
  return (
    <AppShell>
      <h1 className="mb-5 font-display text-xl font-semibold">Categories</h1>
      {isPending || shopsQuery.isPending ? (
        <p className="mb-4 text-sm text-muted-foreground">Loading catalogue...</p>
      ) : isError || shopsQuery.isError ? (
        <p role="alert" className="mb-4 text-sm text-destructive">
          {error?.message ?? shopsQuery.error?.message}
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {categories.map((c) => {
          const count = shops.filter((s) => s.category === c.id).length;
          return (
            <Link
              key={c.id}
              to="/search"
              search={{ category: c.id }}
              className="press group overflow-hidden rounded-2xl glass-1"
            >
              <div className="relative aspect-square w-full overflow-hidden">
                <img
                  src={c.image}
                  alt={`${c.name} category`}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
              </div>
              <div className="p-3">
                <h2 className="text-sm font-semibold">{c.name}</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {count} shop{count === 1 ? "" : "s"}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </AppShell>
  );
}
