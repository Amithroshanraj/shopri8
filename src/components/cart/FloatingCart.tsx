import { Link, useRouterState } from "@tanstack/react-router";
import { ShoppingBag } from "lucide-react";
import { useEffect, useState } from "react";
import { useCart } from "@/lib/cart";
import { formatPrice } from "@/lib/geo";
import { cn } from "@/lib/utils";

const HIDDEN_ON = ["/cart", "/checkout", "/auth"];

/** Sticky glass cart summary — never part of the bottom navigation. */
export function FloatingCart() {
  const { itemCount, total, shopName } = useCart();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [bump, setBump] = useState(false);

  useEffect(() => {
    if (itemCount === 0) return;
    setBump(true);
    const t = setTimeout(() => setBump(false), 340);
    return () => clearTimeout(t);
  }, [itemCount]);

  if (itemCount === 0 || HIDDEN_ON.some((p) => pathname.startsWith(p))) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[5.75rem] z-30 flex justify-center px-4">
      <Link
        to="/cart"
        className={cn(
          "press pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl glass-3 px-4 py-3",
          bump && "animate-cart-bump",
        )}
      >
        <span className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-primary glow-primary">
          <ShoppingBag className="h-5 w-5 text-primary-foreground" strokeWidth={1.8} />
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[0.65rem] font-bold text-accent-foreground">
            {itemCount}
          </span>
        </span>
        <span className="flex-1 text-left">
          <span className="block text-sm font-semibold">{formatPrice(total)}</span>
          <span className="block text-xs text-muted-foreground">
            {itemCount} item{itemCount > 1 ? "s" : ""}
            {shopName ? ` · ${shopName}` : ""}
          </span>
        </span>
        <span className="rounded-xl bg-primary/20 px-3 py-1.5 text-xs font-semibold text-soft-violet">
          View Cart
        </span>
      </Link>
    </div>
  );
}
