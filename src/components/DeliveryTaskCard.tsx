import { Link } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, Clock3, MapPin, Package, Route } from "lucide-react";
import { formatPrice } from "@/lib/geo";
import type { DeliveryTask, Order } from "@/lib/types";

const STATUS_LABELS: Record<DeliveryTask["status"], string> = {
  AVAILABLE: "Available",
  DELIVERY_ASSIGNED: "Assigned",
  PICKED_UP: "Picked up",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  DELIVERY_FAILED: "Delivery failed",
  CANCELLED: "Cancelled",
};

export function DeliveryTaskCard({
  task,
  order,
  shopAddress,
}: {
  task: DeliveryTask;
  order: Order;
  shopAddress: string;
}) {
  const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const status = task.status;

  return (
    <article className="rounded-2xl border border-border/70 bg-card/55 p-4 shadow-sm backdrop-blur-sm transition-colors hover:border-primary/30 hover:bg-card/75 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-xs font-semibold text-muted-foreground">ORDER #{order.id}</p>
          <h3 className="mt-1 truncate font-display text-base font-semibold">{order.shopName}</h3>
        </div>
        <span className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[0.7rem] font-semibold text-soft-violet">
          {STATUS_LABELS[status]}
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="flex min-w-0 gap-2.5">
          <ArrowUp className="mt-0.5 h-4 w-4 shrink-0 text-soft-violet" />
          <div className="min-w-0">
            <p className="text-[0.65rem] font-semibold uppercase text-muted-foreground">Pickup</p>
            <p className="mt-0.5 text-xs text-foreground">{shopAddress}</p>
          </div>
        </div>
        <div className="flex min-w-0 gap-2.5">
          <ArrowDown className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div className="min-w-0">
            <p className="text-[0.65rem] font-semibold uppercase text-muted-foreground">Drop</p>
            <p className="mt-0.5 text-xs text-foreground">
              {order.deliveryAddress.address}, {order.deliveryAddress.houseNumber || ""}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border/60 pt-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Route className="h-3.5 w-3.5" /> {task.distance.toFixed(1)} km
        </span>
        <span>{formatPrice(task.deliveryFee)} fee</span>
        <span className="inline-flex items-center gap-1.5">
          <Package className="h-3.5 w-3.5" /> {itemCount} items
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Clock3 className="h-3.5 w-3.5" />
          {new Date(order.createdAt).toLocaleString("en-IN", {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </span>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="flex min-w-0 items-center gap-1.5 truncate text-xs text-muted-foreground">
          <MapPin className="h-3.5 w-3.5 shrink-0" /> {order.deliveryAddress.recipientName}
        </p>
        <Link
          to="/worker/tasks/$taskId"
          params={{ taskId: task.id }}
          className="press shrink-0 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
        >
          View Task
        </Link>
      </div>
    </article>
  );
}
