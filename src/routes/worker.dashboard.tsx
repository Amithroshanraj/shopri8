import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BadgeCheck,
  CircleDollarSign,
  ListChecks,
  Package,
  Route as RouteIcon,
} from "lucide-react";
import { DeliveryTaskCard } from "@/components/DeliveryTaskCard";
import { SHOP_BY_ID } from "@/data/demo";
import { useWorkerAuth } from "@/lib/workerAuth";
import { useWorkerStore } from "@/lib/workerStore";
import { formatPrice } from "@/lib/geo";
import { toast } from "sonner";
import { useState } from "react";
import { isFirebaseActive } from "@/lib/firebase";

export const Route = createFileRoute("/worker/dashboard")({
  head: () => ({ meta: [{ title: "Delivery Worker Dashboard — SHOPRi8" }] }),
  component: WorkerDashboard,
});

function WorkerDashboard() {
  const { user, setAvailable } = useWorkerAuth();
  const { tasks, orders, loading, error } = useWorkerStore();
  const [availabilitySaving, setAvailabilitySaving] = useState(false);

  if (loading) {
    return (
      <div className="py-16 text-center text-sm text-muted-foreground">
        Loading delivery overview...
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

  const ownTasks = tasks.filter((task) => task.deliveryWorkerId === user?.workerId);
  const activeTasks = ownTasks.filter((task) =>
    ["DELIVERY_ASSIGNED", "PICKED_UP", "OUT_FOR_DELIVERY"].includes(task.status),
  );
  const availableTasks = tasks.filter((task) => task.status === "AVAILABLE");
  const today = new Date().toDateString();
  const completedToday = ownTasks.filter(
    (task) =>
      task.status === "DELIVERED" && new Date(task.updatedAt ?? "").toDateString() === today,
  );
  const demoEarnings = completedToday.reduce((sum, task) => sum + task.deliveryFee, 0);
  const greeting =
    new Date().getHours() < 12
      ? "Good morning"
      : new Date().getHours() < 18
        ? "Good afternoon"
        : "Good evening";

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold uppercase text-soft-violet">Delivery Worker</p>
          <h1 className="mt-1 font-display text-2xl font-bold sm:text-3xl">
            {greeting}, {user?.displayName || "Worker"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Ready for your next delivery?</p>
        </div>
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-border/70 bg-card/55 px-4 py-3">
          <div>
            <p className="text-xs font-semibold">Work status</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {user?.available ? "Available for tasks" : "Not receiving new tasks"}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={Boolean(user?.available)}
            aria-label="Available for delivery tasks"
            disabled={availabilitySaving}
            onClick={() => {
              setAvailabilitySaving(true);
              void setAvailable(!user?.available)
                .catch((cause: unknown) =>
                  toast.error("Could not update availability", {
                    description: cause instanceof Error ? cause.message : "Please try again.",
                  }),
                )
                .finally(() => setAvailabilitySaving(false));
            }}
            className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50 ${user?.available ? "bg-primary" : "bg-muted"}`}
          >
            <span
              className={`absolute left-0 top-1 h-5 w-5 rounded-full bg-primary-foreground shadow-sm transition-transform ${user?.available ? "translate-x-6" : "translate-x-1"}`}
            />
          </button>
        </div>
      </header>

      <section
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
        aria-label="Delivery statistics"
      >
        <Metric
          icon={ListChecks}
          label="Available Tasks"
          value={availableTasks.length.toString()}
        />
        <Metric icon={Package} label="Active Delivery" value={activeTasks.length.toString()} />
        <Metric
          icon={BadgeCheck}
          label="Completed Today"
          value={completedToday.length.toString()}
        />
        <Metric
          icon={CircleDollarSign}
          label={isFirebaseActive ? "Earnings" : "Demo Earnings"}
          value={formatPrice(demoEarnings)}
          detail={isFirebaseActive ? "Based on completed deliveries" : "Illustrative local data"}
        />
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-semibold">Active Delivery</h2>
          {activeTasks.length > 0 && (
            <Link
              to="/worker/tasks"
              className="text-xs font-semibold text-soft-violet hover:underline"
            >
              View tasks
            </Link>
          )}
        </div>
        {activeTasks.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/25 p-6 text-sm text-muted-foreground">
            You don't have an active delivery.
          </div>
        ) : (
          activeTasks.slice(0, 1).map((task) => {
            const order = orders.find((item) => item.id === task.orderId);
            if (!order) return null;
            return (
              <div key={task.id} className="space-y-3">
                <DeliveryTaskCard
                  task={task}
                  order={order}
                  shopAddress={
                    isFirebaseActive
                      ? `Pickup coordinates: ${task.pickupLocation.latitude.toFixed(5)}, ${task.pickupLocation.longitude.toFixed(5)}`
                      : (SHOP_BY_ID[task.shopId]?.address ?? "Pickup location unavailable")
                  }
                />
                <Link
                  to="/worker/tasks/$taskId"
                  params={{ taskId: task.id }}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-soft-violet"
                >
                  View Delivery <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            );
          })
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold">Available Delivery Tasks</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {isFirebaseActive
                ? "Available from the live delivery queue"
                : "Local demo tasks based on ready orders"}
            </p>
          </div>
          <Link
            to="/worker/tasks"
            className="inline-flex items-center gap-1 text-xs font-semibold text-soft-violet hover:underline"
          >
            All tasks <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        {availableTasks.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/25 p-6 text-sm text-muted-foreground">
            No delivery tasks available.
          </div>
        ) : (
          <div className="grid gap-3 xl:grid-cols-2">
            {availableTasks.slice(0, 4).map((task) => {
              const order = orders.find((item) => item.id === task.orderId);
              if (!order) return null;
              return (
                <DeliveryTaskCard
                  key={task.id}
                  task={task}
                  order={order}
                  shopAddress={
                    isFirebaseActive
                      ? `Pickup coordinates: ${task.pickupLocation.latitude.toFixed(5)}, ${task.pickupLocation.longitude.toFixed(5)}`
                      : (SHOP_BY_ID[task.shopId]?.address ?? "Pickup location unavailable")
                  }
                />
              );
            })}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-border/70 bg-primary/5 p-4 text-xs text-muted-foreground">
        <RouteIcon className="mr-2 inline h-4 w-4 text-soft-violet" />
        Pickup and drop-off details are provided for each task. Live navigation and GPS tracking are
        not connected.
      </section>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof Package;
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card/55 p-4 shadow-sm backdrop-blur-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <Icon className="h-4 w-4 text-soft-violet" />
      </div>
      <p className="mt-3 font-display text-2xl font-bold">{value}</p>
      {detail && <p className="mt-1 text-[0.65rem] text-muted-foreground">{detail}</p>}
    </div>
  );
}
