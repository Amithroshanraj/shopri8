import { createFileRoute, Link } from "@tanstack/react-router";
import { Store } from "lucide-react";
import { AppShell, PageHeader } from "@/components/layout/AppShell";
import { MediaTile } from "@/components/common/MediaTile";
import { QtyStepper } from "@/components/shop/Cards";
import { formatPrice } from "@/lib/geo";
import { useProduct, useShop } from "@/hooks/useCatalog";

export const Route = createFileRoute("/products/$productId")({
  head: () => ({ meta: [{ title: "Product — SHOPRi8" }] }),
  notFoundComponent: () => (
    <AppShell>
      <PageHeader title="Product not found" />
    </AppShell>
  ),
  component: ProductPage,
});

function ProductPage() {
  const { productId } = Route.useParams();
  const productQuery = useProduct(productId);
  const product = productQuery.data;
  const shopQuery = useShop(product?.shopId);
  const shop = shopQuery.data;
  if (productQuery.isPending || shopQuery.isPending) {
    return (
      <AppShell>
        <p className="text-sm text-muted-foreground">Loading product...</p>
      </AppShell>
    );
  }
  if (productQuery.isError || shopQuery.isError || !product || !shop || shop.status !== "ACTIVE") {
    return (
      <AppShell>
        <PageHeader title="Product not found" />
        {productQuery.isError || shopQuery.isError ? (
          <p role="alert" className="text-sm text-destructive">
            {productQuery.error?.message ?? shopQuery.error?.message}
          </p>
        ) : null}
      </AppShell>
    );
  }
  return (
    <AppShell>
      <PageHeader title={product.name} />
      <MediaTile
        src={product.image}
        imageSource={product.imageSource}
        alt={product.name}
        category={product.category}
        className="mb-5 aspect-square w-full sm:aspect-video"
        iconClassName="h-16 w-16"
      />
      <div className="mb-4 rounded-3xl glass-2 p-5">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-lg font-semibold">{product.name}</h1>
            <p className="text-xs text-muted-foreground">{product.unit}</p>
          </div>
          <p className="text-lg font-semibold">{formatPrice(product.price)}</p>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">{product.description}</p>
        <div className="mt-4 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {product.stock > 0 ? `${product.stock} in stock` : "Currently unavailable"}
          </span>
          <QtyStepper product={product} shopName={shop.name} />
        </div>
      </div>
      <Link
        to="/shops/$shopId"
        params={{ shopId: shop.id }}
        className="flex items-center gap-3 rounded-2xl glass-1 p-4 text-sm"
      >
        <Store className="h-5 w-5 text-soft-violet" /> Sold by{" "}
        <span className="font-semibold">{shop.name}</span>
      </Link>
    </AppShell>
  );
}
