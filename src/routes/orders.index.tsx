import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, Package } from "lucide-react";
import { AppShell, EmptyState, PageHeader } from "@/components/layout/AppShell";
import { formatPrice } from "@/lib/geo";
import { useOrders } from "@/lib/store";
import { ORDER_STATUS_LABEL } from "@/lib/types";

export const Route = createFileRoute("/orders/")({
  head: () => ({
    meta: [
      { title: "My orders — SHOPRi8" },
      { name: "description", content: "Track your SHOPRi8 orders." },
      { property: "og:title", content: "My orders — SHOPRi8" },
      { property: "og:description", content: "Track your neighbourhood orders." },
    ],
  }),
  component: Orders,
});

function Orders() {
  const { orders, ready } = useOrders();
  return (
    <AppShell>
      <PageHeader title="My orders" />
      {ready && orders.length === 0 ? (
        <EmptyState
          icon={<Package className="h-6 w-6" />}
          title="No orders yet"
          body="Orders you place will appear here."
          cta={{ label: "Start shopping", to: "/" }}
        />
      ) : (
        <div className="space-y-3">
          {orders.map((o) => (
            <Link
              key={o.id}
              to="/orders/$orderId"
              params={{ orderId: o.id }}
              className="press flex items-center gap-3 rounded-2xl glass-1 p-4"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{o.shopName}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(o.createdAt).toLocaleString("en-IN", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}{" "}
                  · {formatPrice(o.totalAmount)}
                </p>
                <span className="mt-1.5 inline-block rounded-full bg-primary/15 px-2 py-0.5 text-[0.65rem] font-semibold text-soft-violet">
                  {ORDER_STATUS_LABEL[o.orderStatus]}
                </span>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}
