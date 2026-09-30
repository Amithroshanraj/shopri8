import { createFileRoute, notFound } from "@tanstack/react-router";
import { Clock, MapPin } from "lucide-react";
import { AppShell, PageHeader } from "@/components/layout/AppShell";
import { MediaTile } from "@/components/common/MediaTile";
import { OpenBadge, ProductRow } from "@/components/shop/Cards";
import { CATEGORY_BY_ID, DEMO_CENTER, SHOP_BY_ID, productsForShop } from "@/data/demo";
import { distanceKm, formatDistance } from "@/lib/geo";

export const Route = createFileRoute("/shops/$shopId")({
  loader: ({ params }) => {
    const shop = SHOP_BY_ID[params.shopId];
    if (!shop) throw notFound();
    return { shop };
  },
  head: ({ loaderData }) => {
    if (!loaderData)
      return {
        meta: [{ title: "Shop not found — SHOPRi8" }, { name: "robots", content: "noindex" }],
      };
    const t = `${loaderData.shop.name} — SHOPRi8`;
    return {
      meta: [
        { title: t },
        { name: "description", content: loaderData.shop.description },
        { property: "og:title", content: t },
        { property: "og:description", content: loaderData.shop.description },
      ],
    };
  },
  notFoundComponent: () => (
    <AppShell>
      <PageHeader title="Shop not found" />
    </AppShell>
  ),
  component: ShopPage,
});

function ShopPage() {
  const { shop } = Route.useLoaderData();
  const products = productsForShop(shop.id);
  return (
    <AppShell>
      <PageHeader title={shop.name} subtitle={CATEGORY_BY_ID[shop.category]?.name} />
      <div className="mb-5 rounded-3xl glass-2 p-4">
        <div className="flex gap-4">
          <MediaTile
            src={shop.image}
            alt={shop.name}
            category={shop.category}
            className="h-20 w-20 shrink-0"
          />
          <div className="min-w-0 space-y-1.5 text-xs text-muted-foreground">
            <OpenBadge shop={shop} />
            <p className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              {shop.address} · {formatDistance(distanceKm(DEMO_CENTER, shop))}
            </p>
            <p className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 shrink-0" />
              {shop.openingTime} – {shop.closingTime}
            </p>
          </div>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">{shop.description}</p>
      </div>
      <h2 className="mb-3 font-display text-base font-semibold">Products</h2>
      <div className="grid gap-3">
        {products.map((p) => (
          <ProductRow key={p.id} product={p} />
        ))}
      </div>
    </AppShell>
  );
}
