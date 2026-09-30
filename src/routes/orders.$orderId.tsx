import { createFileRoute } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { AppShell, PageHeader } from "@/components/layout/AppShell";
import { Bill } from "./cart";
import { formatPrice } from "@/lib/geo";
import { useOrders } from "@/lib/store";
import { ORDER_STATUS_FLOW, ORDER_STATUS_LABEL } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/orders/$orderId")({
  head: ({ params }) => ({
    meta: [
      { title: `Order ${params.orderId} — SHOPRi8` },
      { name: "description", content: "Order status and details." },
      { property: "og:title", content: "Order details — SHOPRi8" },
      { property: "og:description", content: "Order status and details." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OrderDetails,
});

function OrderDetails() {
  const { orderId } = Route.useParams();
  const { orders, ready, cancel } = useOrders();
  const order = orders.find((o) => o.id === orderId);

  if (!ready)
    return (
      <AppShell>
        <PageHeader title="Order" />
      </AppShell>
    );
  if (!order)
    return (
      <AppShell>
        <PageHeader title="Order not found" />
      </AppShell>
    );

  const idx = ORDER_STATUS_FLOW.indexOf(order.orderStatus as (typeof ORDER_STATUS_FLOW)[number]);
  const terminal = idx === -1;
  const canCancel = order.orderStatus === "PLACED" || order.orderStatus === "RETAILER_REVIEW";

  return (
    <AppShell>
      <PageHeader title={order.shopName} subtitle={`Order ${order.id}`} />
      <section className="mb-5 rounded-3xl glass-2 p-5">
        <p className="mb-4 text-sm font-semibold">{ORDER_STATUS_LABEL[order.orderStatus]}</p>
        {terminal ? (
          <p className="text-sm text-muted-foreground">
            This order was {ORDER_STATUS_LABEL[order.orderStatus].toLowerCase()}.
          </p>
        ) : (
          <ol className="space-y-3">
            {ORDER_STATUS_FLOW.map((s, i) => (
              <li key={s} className="flex items-center gap-3 text-sm">
                <span
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                    i <= idx
                      ? "bg-primary text-primary-foreground"
                      : "border border-border text-muted-foreground",
                  )}
                >
                  {i <= idx ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <span className="text-[0.6rem]">{i + 1}</span>
                  )}
                </span>
                <span className={i <= idx ? "" : "text-muted-foreground"}>
                  {ORDER_STATUS_LABEL[s]}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
      <section className="mb-4 space-y-2 rounded-2xl glass-1 p-4 text-sm">
        {order.items.map((it) => (
          <div key={it.productId} className="flex justify-between gap-3">
            <span className="min-w-0 truncate">
              {it.quantity} × {it.name}
            </span>
            <span>{formatPrice(it.price * it.quantity)}</span>
          </div>
        ))}
      </section>
      <div className="mb-4">
        <Bill subtotal={order.subtotal} deliveryFee={order.deliveryFee} total={order.totalAmount} />
      </div>
      <div className="mb-5 rounded-2xl glass-1 p-4 text-sm">
        <p className="mb-2 text-xs font-semibold text-muted-foreground">Delivery to</p>
        <p className="font-medium">{order.deliveryAddress.recipientName}</p>
        <p className="text-xs text-muted-foreground">{order.deliveryAddress.phone}</p>
        <p className="mt-1">{order.deliveryAddress.address}</p>
        {order.deliveryAddress.houseNumber && (
          <p className="text-xs text-muted-foreground">{order.deliveryAddress.houseNumber}</p>
        )}
        {order.deliveryAddress.landmark && (
          <p className="text-xs text-muted-foreground">Near {order.deliveryAddress.landmark}</p>
        )}
        <p className="mt-2 text-xs text-muted-foreground">Payment: Cash on delivery</p>
      </div>
      {canCancel ? (
        <button
          onClick={() => cancel(order.id)}
          className="press w-full rounded-2xl glass-1 py-3.5 text-sm font-semibold text-destructive"
        >
          Cancel order
        </button>
      ) : null}
    </AppShell>
  );
}
