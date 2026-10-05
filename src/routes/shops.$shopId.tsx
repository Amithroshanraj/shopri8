import { createFileRoute } from "@tanstack/react-router";
import { Clock, MapPin } from "lucide-react";
import { AppShell, PageHeader } from "@/components/layout/AppShell";
import { MediaTile } from "@/components/common/MediaTile";
import { OpenBadge, ProductRow } from "@/components/shop/Cards";
import { CATEGORY_BY_ID, DEMO_CENTER } from "@/data/demo";
import { distanceKm, formatDistance } from "@/lib/geo";
import { useProductsByShop, useShop } from "@/hooks/useCatalog";

export const Route = createFileRoute("/shops/$shopId")({
  head: () => ({ meta: [{ title: "Shop — SHOPRi8" }] }),
  notFoundComponent: () => (
    <AppShell>
      <PageHeader title="Shop not found" />
    </AppShell>
  ),
  component: ShopPage,
});

function ShopPage() {
  const { shopId } = Route.useParams();
  const shopQuery = useShop(shopId);
  const shop = shopQuery.data;
  const productsQuery = useProductsByShop(shop?.id);
  const products = productsQuery.data ?? [];
  if (shopQuery.isPending) {
    return (
      <AppShell>
        <p className="text-sm text-muted-foreground">Loading shop...</p>
      </AppShell>
    );
  }
  if (shopQuery.isError || !shop || shop.status !== "ACTIVE") {
    return (
      <AppShell>
        <PageHeader title="Shop not found" />
        {shopQuery.isError ? (
          <p role="alert" className="text-sm text-destructive">
            {shopQuery.error.message}
          </p>
        ) : null}
      </AppShell>
    );
  }
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
              {shop.address}
              {shop.latitude !== undefined && shop.longitude !== undefined
                ? ` · ${formatDistance(
                    distanceKm(DEMO_CENTER, {
                      latitude: shop.latitude,
                      longitude: shop.longitude,
                    }),
                  )}`
                : ""}
            </p>
            <p className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 shrink-0" />
              {shop.openingTime && shop.closingTime
                ? `${shop.openingTime} – ${shop.closingTime}`
                : "Hours unavailable"}
            </p>
          </div>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">{shop.description}</p>
      </div>
      <h2 className="mb-3 font-display text-base font-semibold">Products</h2>
      {productsQuery.isError ? (
        <p role="alert" className="mb-3 text-sm text-destructive">
          {productsQuery.error.message}
        </p>
      ) : null}
      <div className="grid gap-3">
        {products.map((p) => (
          <ProductRow key={p.id} product={p} shopName={shop.name} />
        ))}
      </div>
    </AppShell>
  );
}
