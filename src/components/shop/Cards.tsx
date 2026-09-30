import { Link } from "@tanstack/react-router";
import { Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { MediaTile } from "@/components/common/MediaTile";
import { CATEGORY_BY_ID, DEMO_CENTER, SHOP_BY_ID } from "@/data/demo";
import { useCart } from "@/lib/cart";
import { distanceKm, formatDistance, formatPrice, isOpenNow } from "@/lib/geo";
import type { Product, Shop } from "@/lib/types";

export function OpenBadge({ shop }: { shop: Shop }) {
  const open = isOpenNow(shop.openingTime, shop.closingTime);
  return (
    <span
      className={
        open
          ? "rounded-full bg-success/15 px-2 py-0.5 text-[0.65rem] font-semibold text-success"
          : "rounded-full bg-muted px-2 py-0.5 text-[0.65rem] font-semibold text-muted-foreground"
      }
    >
      {open ? "Open" : "Closed"}
    </span>
  );
}

export function ShopCard({ shop }: { shop: Shop }) {
  return (
    <Link
      to="/shops/$shopId"
      params={{ shopId: shop.id }}
      className="press flex items-center gap-3 rounded-2xl glass-1 p-3"
    >
      <MediaTile
        src={shop.image}
        alt={shop.name}
        category={shop.category}
        className="h-16 w-16 shrink-0"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="truncate text-sm font-semibold">{shop.name}</h3>
          <OpenBadge shop={shop} />
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {CATEGORY_BY_ID[shop.category]?.name} · {shop.address}
        </p>
        <p className="mt-1 text-xs text-soft-violet">
          {formatDistance(distanceKm(DEMO_CENTER, shop))} away
        </p>
      </div>
    </Link>
  );
}

export function QtyStepper({ product }: { product: Product }) {
  const cart = useCart();
  const line = cart.lines.find((l) => l.productId === product.id);
  const shopName = SHOP_BY_ID[product.shopId]?.name ?? "Shop";

  if (!product.availability || product.stock === 0) {
    return <span className="text-xs font-medium text-muted-foreground">Out of stock</span>;
  }
  if (!line) {
    return (
      <button
        onClick={(e) => {
          e.preventDefault();
          const r = cart.add(product, shopName);
          if (r === "other-shop") {
            toast("Your cart has items from another shop", {
              description: "One order can contain items from one shop only.",
              action: { label: "Replace cart", onClick: () => cart.forceAdd(product, shopName) },
            });
          }
        }}
        className="press rounded-xl bg-primary/20 px-4 py-1.5 text-xs font-semibold text-soft-violet"
      >
        Add
      </button>
    );
  }
  return (
    <div
      className="flex items-center gap-2 rounded-xl bg-primary px-1 py-1 text-primary-foreground"
      onClick={(e) => e.preventDefault()}
    >
      <button
        aria-label="Decrease"
        className="press p-1"
        onClick={() => cart.setQuantity(product.id, line.quantity - 1)}
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <span className="min-w-4 text-center text-xs font-bold">{line.quantity}</span>
      <button
        aria-label="Increase"
        className="press p-1 disabled:opacity-40"
        disabled={line.quantity >= product.stock}
        onClick={() => cart.setQuantity(product.id, line.quantity + 1)}
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function ProductRow({ product }: { product: Product }) {
  return (
    <Link
      to="/products/$productId"
      params={{ productId: product.id }}
      className="flex items-center gap-3 rounded-2xl glass-1 p-3"
    >
      <MediaTile
        src={product.image}
        alt={product.name}
        category={product.category}
        className="h-14 w-14 shrink-0"
        iconClassName="h-6 w-6"
      />
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-sm font-semibold">{product.name}</h3>
        <p className="text-xs text-muted-foreground">{product.unit}</p>
        <p className="mt-0.5 text-sm font-semibold">{formatPrice(product.price)}</p>
      </div>
      <QtyStepper product={product} />
    </Link>
  );
}
