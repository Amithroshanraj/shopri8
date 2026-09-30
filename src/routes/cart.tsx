import { createFileRoute, Link } from "@tanstack/react-router";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { AppShell, EmptyState, PageHeader } from "@/components/layout/AppShell";
import { MediaTile } from "@/components/common/MediaTile";
import { PRODUCT_BY_ID } from "@/data/demo";
import { useCart } from "@/lib/cart";
import { formatPrice } from "@/lib/geo";

export const Route = createFileRoute("/cart")({
  head: () => ({
    meta: [
      { title: "Your cart — SHOPRi8" },
      { name: "description", content: "Review items in your SHOPRi8 cart." },
      { property: "og:title", content: "Your cart — SHOPRi8" },
      { property: "og:description", content: "Review items before checkout." },
    ],
  }),
  component: CartPage,
});

export function Bill({
  subtotal,
  deliveryFee,
  total,
}: {
  subtotal: number;
  deliveryFee: number;
  total: number;
}) {
  return (
    <div className="space-y-2 rounded-2xl glass-1 p-4 text-sm">
      <div className="flex justify-between">
        <span className="text-muted-foreground">Item total</span>
        <span>{formatPrice(subtotal)}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-muted-foreground">Delivery fee</span>
        <span>{formatPrice(deliveryFee)}</span>
      </div>
      <div className="flex justify-between border-t border-border pt-2 font-semibold">
        <span>To pay</span>
        <span>{formatPrice(total)}</span>
      </div>
    </div>
  );
}

function CartPage() {
  const cart = useCart();
  return (
    <AppShell nav={false}>
      <PageHeader title="Cart" subtitle={cart.shopName ?? undefined} />
      {cart.lines.length === 0 ? (
        <EmptyState
          icon={<ShoppingBag className="h-6 w-6" />}
          title="Your cart is empty"
          body="Add items from a nearby shop to get started."
          cta={{ label: "Browse shops", to: "/" }}
        />
      ) : (
        <>
          <div className="mb-4 space-y-3">
            {cart.lines.map((l) => {
              const product = PRODUCT_BY_ID[l.productId];
              return (
                <div key={l.productId} className="flex items-center gap-3 rounded-2xl glass-1 p-3">
                  <MediaTile
                    alt={l.name}
                    category={product?.category ?? "other"}
                    className="h-14 w-14 shrink-0"
                    iconClassName="h-6 w-6"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{l.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {l.unit} · {formatPrice(l.price)}
                    </p>
                    <div className="mt-2 flex items-center gap-3">
                      <button
                        aria-label="Decrease"
                        className="press rounded-lg glass-1 p-1.5"
                        onClick={() => cart.setQuantity(l.productId, l.quantity - 1)}
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="text-sm font-semibold">{l.quantity}</span>
                      <button
                        aria-label="Increase"
                        disabled={l.quantity >= l.stock}
                        className="press rounded-lg glass-1 p-1.5 disabled:opacity-40"
                        onClick={() => cart.setQuantity(l.productId, l.quantity + 1)}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-3">
                    <span className="text-sm font-semibold">
                      {formatPrice(l.price * l.quantity)}
                    </span>
                    <button aria-label="Remove" onClick={() => cart.remove(l.productId)}>
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <Bill subtotal={cart.subtotal} deliveryFee={cart.deliveryFee} total={cart.total} />
          <div className="fixed inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <Link
              to="/checkout"
              className="press w-full max-w-md rounded-2xl bg-primary py-4 text-center text-sm font-semibold text-primary-foreground glow-primary"
            >
              Proceed to checkout · {formatPrice(cart.total)}
            </Link>
          </div>
        </>
      )}
    </AppShell>
  );
}
