import { createFileRoute } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useState } from "react";
import { DeliveryTaskCard } from "@/components/DeliveryTaskCard";
import { SHOP_BY_ID } from "@/data/demo";
import { useWorkerAuth } from "@/lib/workerAuth";
import { useWorkerStore } from "@/lib/workerStore";
import { cn } from "@/lib/utils";
import { isFirebaseActive } from "@/lib/firebase";

export const Route = createFileRoute("/worker/tasks/")({
  head: () => ({ meta: [{ title: "Delivery Tasks — SHOPRi8" }] }),
  component: WorkerTasks,
});

type TaskFilter = "available" | "active" | "completed" | "failed";
const FILTERS: { id: TaskFilter; label: string }[] = [
  { id: "available", label: "Available" },
  { id: "active", label: "Active" },
  { id: "completed", label: "Completed" },
  { id: "failed", label: "Failed" },
];

function WorkerTasks() {
  const { user } = useWorkerAuth();
  const { tasks, orders, loading, error } = useWorkerStore();
  const [filter, setFilter] = useState<TaskFilter>("available");
  const [query, setQuery] = useState("");

  if (loading)
    return (
      <div className="py-16 text-center text-sm text-muted-foreground">
        Loading delivery tasks...
      </div>
    );
  if (error)
    return (
      <div
        role="alert"
        className="rounded-2xl border border-destructive/30 bg-destructive/10 p-5 text-sm"
      >
        Something went wrong. Please try again.
      </div>
    );

  const visibleTasks = tasks.filter((task) => {
    const own = task.deliveryWorkerId === user?.workerId;
    const matchesFilter =
      filter === "available"
        ? task.status === "AVAILABLE"
        : filter === "active"
          ? own && ["DELIVERY_ASSIGNED", "PICKED_UP", "OUT_FOR_DELIVERY"].includes(task.status)
          : filter === "completed"
            ? own && task.status === "DELIVERED"
            : own && task.status === "DELIVERY_FAILED";
    if (!matchesFilter) return false;
    if (!query.trim()) return true;
    const order = orders.find((item) => item.id === task.orderId);
    const normalized = query.trim().toLowerCase();
    return Boolean(
      order &&
      [
        order.id,
        order.shopName,
        order.deliveryAddress.recipientName,
        order.deliveryAddress.address,
      ].some((value) => value.toLowerCase().includes(normalized)),
    );
  });

  return (
    <div className="space-y-5">
      <header>
        <p className="text-xs font-semibold uppercase text-soft-violet">Operations</p>
        <h1 className="mt-1 font-display text-2xl font-bold">Delivery Tasks</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Review pickup and drop-off details before accepting a task.
        </p>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div
          className="flex gap-2 overflow-x-auto pb-1"
          role="tablist"
          aria-label="Delivery task status"
        >
          {FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={filter === item.id}
              onClick={() => setFilter(item.id)}
              className={cn(
                "press shrink-0 rounded-full border px-4 py-2 text-xs font-semibold transition-colors",
                filter === item.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card/50 text-muted-foreground hover:text-foreground",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            aria-label="Search delivery tasks"
            placeholder="Search order, recipient, location"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="w-full rounded-xl border border-input bg-card/60 py-2.5 pl-9 pr-3 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {visibleTasks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/25 px-5 py-10 text-center">
          <h2 className="font-display text-base font-semibold">
            {query
              ? "No matching tasks"
              : filter === "available"
                ? "No delivery tasks available"
                : `No ${filter} deliveries`}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {query
              ? "Try another order, recipient, or location."
              : "Tasks will appear here when their order status changes."}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {visibleTasks.map((task) => {
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
    </div>
  );
}
