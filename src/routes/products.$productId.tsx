import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Store } from "lucide-react";
import { AppShell, PageHeader } from "@/components/layout/AppShell";
import { MediaTile } from "@/components/common/MediaTile";
import { QtyStepper } from "@/components/shop/Cards";
import { PRODUCT_BY_ID, SHOP_BY_ID } from "@/data/demo";
import { formatPrice } from "@/lib/geo";

export const Route = createFileRoute("/products/$productId")({
  loader: ({ params }) => {
    const product = PRODUCT_BY_ID[params.productId];
    if (!product) throw notFound();
    return { product, shop: SHOP_BY_ID[product.shopId]! };
  },
  head: ({ loaderData }) => {
    if (!loaderData)
      return {
        meta: [{ title: "Product not found — SHOPRi8" }, { name: "robots", content: "noindex" }],
      };
    const t = `${loaderData.product.name} — ${loaderData.shop.name}`;
    return {
      meta: [
        { title: t },
        { name: "description", content: loaderData.product.description },
        { property: "og:title", content: t },
        { property: "og:description", content: loaderData.product.description },
      ],
    };
  },
  notFoundComponent: () => (
    <AppShell>
      <PageHeader title="Product not found" />
    </AppShell>
  ),
  component: ProductPage,
});

function ProductPage() {
  const { product, shop } = Route.useLoaderData();
  return (
    <AppShell>
      <PageHeader title={product.name} />
      <MediaTile
        src={product.image}
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
          <QtyStepper product={product} />
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
