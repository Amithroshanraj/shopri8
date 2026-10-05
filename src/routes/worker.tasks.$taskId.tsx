import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  BadgeCheck,
  MapPin,
  Package,
  Route as RouteIcon,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { SHOP_BY_ID } from "@/data/demo";
import { isFirebaseActive } from "@/lib/firebase";
import { formatPrice } from "@/lib/geo";
import { useWorkerAuth } from "@/lib/workerAuth";
import { useWorkerStore } from "@/lib/workerStore";
import { ORDER_STATUS_LABEL, type DeliveryTaskStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/worker/tasks/$taskId")({
  head: ({ params }) => ({
    meta: [{ title: `Delivery Task ${params.taskId} — SHOPRi8` }],
  }),
  component: WorkerTaskDetails,
});

type PendingAction = DeliveryTaskStatus | null;

const FAILURE_REASONS = [
  "Customer unavailable",
  "Incorrect address",
  "Shop issue",
  "Vehicle/transport issue",
  "Other",
] as const;

function WorkerTaskDetails() {
  const { taskId } = Route.useParams();
  const { user } = useWorkerAuth();
  const { tasks, orders, loading, error, transitionTask } = useWorkerStore();
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [failureReason, setFailureReason] = useState<(typeof FAILURE_REASONS)[number]>(
    FAILURE_REASONS[0],
  );
  const [failureNotes, setFailureNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (loading) {
    return (
      <div className="py-16 text-center text-sm text-muted-foreground">
        Loading delivery task...
      </div>
    );
  }

  if (error) {
    return (
      <div
        role="alert"
        className="rounded-2xl border border-destructive/30 bg-destructive/10 p-5 text-sm"
      >
        Something went wrong. Please try again.
      </div>
    );
  }

  const task = tasks.find((item) => item.id === taskId);
  const order = task && orders.find((item) => item.id === task.orderId);
  const canReadTask = task?.status === "AVAILABLE" || task?.deliveryWorkerId === user?.workerId;
  if (!task || !order || !canReadTask) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-dashed border-border bg-card/25 p-8 text-center">
        <Package className="mx-auto h-9 w-9 text-muted-foreground" />
        <h1 className="mt-3 font-display text-lg font-semibold">Delivery task not found</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          This task is unavailable or is assigned to another Delivery Worker.
        </p>
        <Link
          to="/worker/tasks"
          className="press mt-5 inline-flex rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground"
        >
          Back to Tasks
        </Link>
      </div>
    );
  }

  const shop = isFirebaseActive ? undefined : SHOP_BY_ID[task.shopId];
  const pickupAddress = isFirebaseActive
    ? `Pickup coordinates: ${task.pickupLocation.latitude.toFixed(5)}, ${task.pickupLocation.longitude.toFixed(5)}`
    : (shop?.address ?? "Pickup address unavailable");
  const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const canReportFailure = task.status === "OUT_FOR_DELIVERY";
  const actionForStatus: Partial<
    Record<DeliveryTaskStatus, { status: DeliveryTaskStatus; label: string }>
  > = {
    AVAILABLE: { status: "DELIVERY_ASSIGNED", label: "Accept Delivery" },
    DELIVERY_ASSIGNED: { status: "PICKED_UP", label: "Mark as Picked Up" },
    PICKED_UP: { status: "OUT_FOR_DELIVERY", label: "Start Delivery" },
    OUT_FOR_DELIVERY: { status: "DELIVERED", label: "Mark as Delivered" },
  };
  const primaryAction = actionForStatus[task.status];

  const confirmAction = async () => {
    if (!pendingAction || !user) return;
    setSubmitting(true);
    try {
      const succeeded = await transitionTask(
        task.id,
        pendingAction,
        user.workerId,
        pendingAction === "DELIVERY_FAILED"
          ? { reason: failureReason, notes: failureNotes }
          : undefined,
      );
      if (!succeeded) {
        toast.error("This task can no longer be updated", {
          description: "Check the latest order status and task assignment.",
        });
        setPendingAction(null);
        return;
      }
      toast.success(
        pendingAction === "DELIVERY_ASSIGNED"
          ? "Delivery accepted"
          : pendingAction === "PICKED_UP"
            ? "Pickup confirmed"
            : pendingAction === "OUT_FOR_DELIVERY"
              ? "Delivery started"
              : pendingAction === "DELIVERED"
                ? "Delivery completed successfully"
                : "Delivery issue reported",
      );
      setPendingAction(null);
    } catch (error) {
      toast.error("Could not update delivery task", {
        description: error instanceof Error ? error.message : "Refresh the task and try again.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const dialogTitle =
    pendingAction === "DELIVERY_ASSIGNED"
      ? "Accept this delivery task?"
      : pendingAction === "PICKED_UP"
        ? "Confirm that you have picked up the order?"
        : pendingAction === "OUT_FOR_DELIVERY"
          ? "Start delivery for this order?"
          : pendingAction === "DELIVERED"
            ? "Confirm delivery completed?"
            : "Report delivery issue";

  return (
    <div className="mx-auto max-w-4xl space-y-5 pb-10">
      <header className="flex items-start gap-3">
        <Link
          to="/worker/tasks"
          aria-label="Back to tasks"
          className="press mt-0.5 rounded-xl border border-border bg-card/60 p-2.5 hover:bg-accent"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase text-soft-violet">Delivery Task</p>
          <h1 className="mt-1 truncate font-mono text-xl font-bold">#{order.id}</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Placed{" "}
            {new Date(order.createdAt).toLocaleString("en-IN", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </p>
        </div>
        <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-[0.7rem] font-semibold text-soft-violet">
          {ORDER_STATUS_LABEL[order.orderStatus]}
        </span>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <InfoCard label="Order Items" value={`${itemCount} items`} />
        <InfoCard label="Order Total" value={formatPrice(order.totalAmount)} />
        <InfoCard label="Delivery Fee" value={formatPrice(task.deliveryFee)} />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-border/70 bg-card/55 p-5 shadow-sm backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <ArrowUp className="h-4 w-4 text-soft-violet" />
            <h2 className="font-display text-base font-semibold">Pickup</h2>
          </div>
          <p className="mt-4 text-sm font-semibold">{shop?.name ?? order.shopName}</p>
          <p className="mt-1 text-sm text-muted-foreground">{pickupAddress}</p>
          <p className="mt-3 rounded-xl bg-background/60 p-3 text-xs text-muted-foreground">
            Pickup status:{" "}
            {task.status === "AVAILABLE"
              ? "Waiting for acceptance"
              : task.status === "DELIVERY_ASSIGNED"
                ? "Ready for pickup"
                : "Picked up"}
          </p>
        </section>

        <section className="rounded-2xl border border-border/70 bg-card/55 p-5 shadow-sm backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <ArrowDown className="h-4 w-4 text-primary" />
            <h2 className="font-display text-base font-semibold">Delivery</h2>
          </div>
          <p className="mt-4 text-sm font-semibold">{order.deliveryAddress.recipientName}</p>
          <a
            href={`tel:${order.deliveryAddress.phone}`}
            className="mt-0.5 inline-block text-xs text-soft-violet hover:underline"
          >
            {order.deliveryAddress.phone}
          </a>
          <p className="mt-2 text-sm text-muted-foreground">{order.deliveryAddress.address}</p>
          {order.deliveryAddress.houseNumber && (
            <p className="mt-1 text-xs text-muted-foreground">
              {order.deliveryAddress.houseNumber}
            </p>
          )}
          {order.deliveryAddress.landmark && (
            <p className="mt-1 text-xs text-muted-foreground">
              Landmark: {order.deliveryAddress.landmark}
            </p>
          )}
        </section>
      </div>

      <section className="rounded-2xl border border-border/70 bg-card/55 p-5 shadow-sm backdrop-blur-sm">
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-display text-base font-semibold">Order Items</h2>
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <RouteIcon className="h-3.5 w-3.5" /> {task.distance.toFixed(1)} km direct distance
          </span>
        </div>
        <div className="mt-3 divide-y divide-border/60">
          {order.items.map((item) => (
            <div
              key={`${item.productId}-${item.name}`}
              className="flex items-center justify-between gap-3 py-3 text-sm"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <Package className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate">
                  {item.quantity} × {item.name}
                </span>
              </div>
              <span className="shrink-0 text-muted-foreground">
                {formatPrice(item.price * item.quantity)}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-border/70 bg-card/55 p-5 shadow-sm backdrop-blur-sm">
        <h2 className="font-display text-base font-semibold">Delivery Timeline</h2>
        <ol className="mt-4 space-y-3">
          {order.statusHistory.map((entry, index) => (
            <li
              key={`${entry.status}-${entry.at}-${index}`}
              className="flex items-center gap-3 text-xs"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-soft-violet">
                <BadgeCheck className="h-3.5 w-3.5" />
              </span>
              <span className="font-medium">{ORDER_STATUS_LABEL[entry.status]}</span>
              <time className="ml-auto text-muted-foreground">
                {new Date(entry.at).toLocaleTimeString("en-IN", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </time>
            </li>
          ))}
        </ol>
      </section>

      <section className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
        <h2 className="font-display text-base font-semibold">Delivery Actions</h2>
        {primaryAction ? (
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => setPendingAction(primaryAction.status)}
              className="press flex-1 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
            >
              {primaryAction.label}
            </button>
            {canReportFailure && (
              <button
                type="button"
                onClick={() => setPendingAction("DELIVERY_FAILED")}
                className="press rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm font-semibold text-destructive hover:bg-destructive/10"
              >
                Report Delivery Issue
              </button>
            )}
          </div>
        ) : task.status === "DELIVERED" ? (
          <div className="mt-3 flex items-center gap-2 text-sm font-semibold text-success">
            <BadgeCheck className="h-5 w-5" /> Delivery completed successfully.
          </div>
        ) : task.status === "DELIVERY_FAILED" ? (
          <div className="mt-3 rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm">
            <p className="flex items-center gap-2 font-semibold text-destructive">
              <XCircle className="h-4 w-4" />
              Delivery issue recorded
            </p>
            <p className="mt-2 text-xs">Reason: {task.failureReason || "Not provided"}</p>
            {task.failureNotes && (
              <p className="mt-1 text-xs text-muted-foreground">{task.failureNotes}</p>
            )}
            <p className="mt-2 text-[0.65rem] text-muted-foreground">
              No payment or refund action was taken.
            </p>
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            No operational action is available for this task.
          </p>
        )}
      </section>

      {pendingAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="task-confirm-title"
            className="w-full max-w-md space-y-4 rounded-2xl border border-border bg-card p-5 shadow-2xl"
          >
            <div>
              <h2 id="task-confirm-title" className="font-display text-lg font-semibold">
                {dialogTitle}
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Order {order.id} · {order.shopName}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Pickup: {pickupAddress}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Drop: {order.deliveryAddress.address}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Delivery fee: {formatPrice(task.deliveryFee)}
              </p>
            </div>
            {pendingAction === "DELIVERY_FAILED" && (
              <div className="space-y-3">
                <div>
                  <label htmlFor="failure-reason" className="mb-1 block text-xs font-medium">
                    Reason
                  </label>
                  <select
                    id="failure-reason"
                    value={failureReason}
                    onChange={(event) =>
                      setFailureReason(event.target.value as (typeof FAILURE_REASONS)[number])
                    }
                    className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-xs"
                  >
                    {FAILURE_REASONS.map((reason) => (
                      <option key={reason} value={reason}>
                        {reason}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="failure-notes" className="mb-1 block text-xs font-medium">
                    Notes (optional)
                  </label>
                  <textarea
                    id="failure-notes"
                    rows={3}
                    value={failureNotes}
                    onChange={(event) => setFailureNotes(event.target.value)}
                    className="w-full resize-y rounded-xl border border-input bg-background px-3 py-2.5 text-xs"
                  />
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setPendingAction(null)}
                className="press flex-1 rounded-xl border border-border py-2.5 text-xs font-semibold hover:bg-accent"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={confirmAction}
                className={cn(
                  "press flex-1 rounded-xl py-2.5 text-xs font-semibold text-primary-foreground disabled:opacity-50",
                  pendingAction === "DELIVERY_FAILED"
                    ? "bg-destructive hover:bg-destructive/90"
                    : "bg-primary hover:bg-primary/90",
                )}
              >
                {submitting
                  ? "Saving..."
                  : pendingAction === "DELIVERY_ASSIGNED"
                    ? "Accept Delivery"
                    : pendingAction === "PICKED_UP"
                      ? "Confirm Pickup"
                      : pendingAction === "OUT_FOR_DELIVERY"
                        ? "Start Delivery"
                        : pendingAction === "DELIVERED"
                          ? "Confirm Delivery"
                          : "Confirm Issue"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card/55 p-4 shadow-sm">
      <p className="text-[0.65rem] font-semibold uppercase text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-lg font-semibold">{value}</p>
    </div>
  );
}
