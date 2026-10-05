import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowRight,
  Box,
  CheckCircle2,
  Clock,
  Package,
  Plus,
  ShoppingBag,
  Store,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useRetailerStore } from "@/lib/retailerStore";
import { formatPrice } from "@/lib/geo";
import { ORDER_STATUS_LABEL } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/retailer/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — SHOPRi8 Retailer" },
      { name: "description", content: "Retailer shop overview and operations" },
    ],
  }),
  component: RetailerDashboard,
});

function RetailerDashboard() {
  const { shop, orders, products, loading, updateShop } = useRetailerStore();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto" />
          <p className="mt-3 text-sm text-muted-foreground">Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  // Calculate metrics
  const now = new Date();
  const todayOrders = orders.filter((o) => {
    const d = new Date(o.createdAt);
    return (
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear()
    );
  });

  const pendingOrders = orders.filter(
    (o) => o.orderStatus === "PLACED" || o.orderStatus === "RETAILER_REVIEW",
  );
  const preparingOrders = orders.filter((o) => o.orderStatus === "PREPARING");
  const readyOrders = orders.filter((o) => o.orderStatus === "READY_FOR_PICKUP");
  const todaySales = todayOrders.reduce((sum, o) => sum + o.totalAmount, 0);
  const lowStockProducts = products.filter((p) => p.stock > 0 && p.stock <= 5);

  const toggleShopStatus = async () => {
    if (!shop) return;
    const newStatus = shop.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    try {
      await updateShop({ status: newStatus });
      toast.success(newStatus === "ACTIVE" ? "Shop is now Open" : "Shop is now Closed", {
        description:
          newStatus === "ACTIVE"
            ? "Customers can now view your shop and place orders."
            : "Your shop is marked closed to customers.",
      });
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Could not update shop status.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Welcome */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
            {shop?.name || "Retailer Portal"}
          </h1>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            Operational overview for {new Date().toLocaleDateString("en-IN", { dateStyle: "full" })}
          </p>
        </div>

        {/* Shop Open/Close Banner */}
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card/50 p-2.5 backdrop-blur-sm">
          <div className="flex items-center gap-2 pl-1.5">
            <span
              className={cn(
                "h-2.5 w-2.5 rounded-full",
                shop?.status === "ACTIVE" ? "bg-success animate-pulse" : "bg-muted-foreground",
              )}
            />
            <span className="text-xs font-semibold text-foreground">
              {shop?.status === "ACTIVE" ? "Open for Orders" : "Store Closed"}
            </span>
          </div>
          <button
            onClick={toggleShopStatus}
            className={cn(
              "press rounded-xl px-3 py-1.5 text-xs font-semibold transition-all",
              shop?.status === "ACTIVE"
                ? "bg-destructive/15 text-destructive hover:bg-destructive/25"
                : "bg-success/15 text-success hover:bg-success/25",
            )}
          >
            {shop?.status === "ACTIVE" ? "Close Store" : "Open Store"}
          </button>
        </div>
      </div>

      {/* Primary KPI Metrics Grid */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard
          icon={ShoppingBag}
          label="Today's Orders"
          value={todayOrders.length.toString()}
          subtext="orders placed today"
          color="text-primary"
        />
        <StatCard
          icon={Clock}
          label="Pending Review"
          value={pendingOrders.length.toString()}
          subtext="needs acceptance"
          color="text-warning"
          highlight={pendingOrders.length > 0}
        />
        <StatCard
          icon={Package}
          label="Preparing"
          value={preparingOrders.length.toString()}
          subtext="in preparation"
          color="text-soft-violet"
        />
        <StatCard
          icon={CheckCircle2}
          label="Ready for Pickup"
          value={readyOrders.length.toString()}
          subtext="waiting for courier"
          color="text-success"
        />
        <StatCard
          icon={TrendingUp}
          label="Today's Sales"
          value={formatPrice(todaySales)}
          subtext="gross volume"
          color="text-foreground"
        />
        <StatCard
          icon={AlertTriangle}
          label="Low Stock Items"
          value={lowStockProducts.length.toString()}
          subtext="≤ 5 units left"
          color={lowStockProducts.length > 0 ? "text-warning" : "text-muted-foreground"}
        />
      </div>

      {/* Low Stock Alert if any */}
      {lowStockProducts.length > 0 && (
        <div className="rounded-2xl border border-warning/30 bg-warning/5 p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <h3 className="text-sm font-semibold text-foreground">
                Low Stock Alert ({lowStockProducts.length} items)
              </h3>
            </div>
            <Link
              to="/retailer/inventory"
              className="text-xs font-medium text-soft-violet hover:underline flex items-center gap-1"
            >
              Update inventory <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {lowStockProducts.slice(0, 6).map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-xl border border-border/50 bg-background/60 px-3 py-2 text-xs"
              >
                <div className="min-w-0 flex-1 pr-2">
                  <p className="truncate font-medium text-foreground">{item.name}</p>
                  <p className="text-[0.7rem] text-muted-foreground">{item.unit || "unit"}</p>
                </div>
                <span className="shrink-0 rounded bg-warning/15 px-2 py-0.5 font-semibold text-warning">
                  {item.stock} left
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Sections: Recent Orders & Quick Actions */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Orders (2 Columns on large screens) */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-foreground">Recent Orders</h2>
            <Link
              to="/retailer/orders"
              className="text-xs font-medium text-soft-violet hover:underline"
            >
              View all orders ({orders.length})
            </Link>
          </div>

          {orders.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card/20 p-8 text-center">
              <ShoppingBag className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-2 text-sm font-medium text-foreground">No orders yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Incoming customer orders will appear here in real time.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {orders.slice(0, 5).map((order) => {
                const isNew = order.orderStatus === "PLACED";
                return (
                  <Link
                    key={order.id}
                    to="/retailer/orders/$orderId"
                    params={{ orderId: order.id }}
                    className={cn(
                      "press block rounded-2xl border border-border/60 bg-card/40 p-4 transition-all hover:bg-card/70 hover:border-border",
                      isNew && "border-warning/40 bg-warning/5",
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-semibold text-foreground">
                            {order.id}
                          </span>
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[0.65rem] font-semibold",
                              order.orderStatus === "PLACED"
                                ? "bg-warning/20 text-warning"
                                : order.orderStatus === "ACCEPTED" ||
                                    order.orderStatus === "PREPARING"
                                  ? "bg-soft-violet/20 text-soft-violet"
                                  : order.orderStatus === "READY_FOR_PICKUP"
                                    ? "bg-success/20 text-success"
                                    : order.orderStatus === "DELIVERED"
                                      ? "bg-muted text-muted-foreground"
                                      : "bg-destructive/20 text-destructive",
                            )}
                          >
                            {ORDER_STATUS_LABEL[order.orderStatus] || order.orderStatus}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground truncate">
                          {order.deliveryAddress?.recipientName} · {order.items.length} item
                          {order.items.length > 1 ? "s" : ""}
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold text-foreground">
                          {formatPrice(order.totalAmount)}
                        </p>
                        <p className="text-[0.7rem] text-muted-foreground">
                          {new Date(order.createdAt).toLocaleTimeString("en-IN", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>

                      <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Quick Operations Sidebar (1 Column) */}
        <div className="space-y-3">
          <h2 className="font-display text-base font-semibold text-foreground">Quick Actions</h2>
          <div className="space-y-2.5">
            <QuickActionButton
              to="/retailer/products/new"
              icon={Plus}
              title="Add New Product"
              description="Create a new catalogue listing"
            />
            <QuickActionButton
              to="/retailer/orders"
              icon={Package}
              title="Manage Orders"
              description="Review, accept and process orders"
            />
            <QuickActionButton
              to="/retailer/inventory"
              icon={Box}
              title="Adjust Inventory"
              description="Update stock levels and availability"
            />
            <QuickActionButton
              to="/retailer/shop"
              icon={Store}
              title="Shop Settings"
              description="Opening hours, description & address"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  subtext,
  color,
  highlight,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  subtext: string;
  color: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border/60 bg-card/40 p-3.5 backdrop-blur-sm transition-all",
        highlight && "border-warning/50 bg-warning/5",
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-[0.7rem] font-medium text-muted-foreground uppercase tracking-wider">
          {label}
        </span>
        <Icon className={cn("h-4 w-4", color)} />
      </div>
      <p className="mt-2 text-xl font-bold tracking-tight text-foreground truncate">{value}</p>
      <p className="mt-0.5 text-[0.65rem] text-muted-foreground truncate">{subtext}</p>
    </div>
  );
}

function QuickActionButton({
  to,
  icon: Icon,
  title,
  description,
}: {
  to: string;
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <Link
      to={to}
      className="press flex items-center gap-3.5 rounded-2xl border border-border/60 bg-card/40 p-3.5 transition-all hover:bg-card/70 hover:border-border"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-soft-violet">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-foreground">{title}</p>
        <p className="text-[0.7rem] text-muted-foreground truncate">{description}</p>
      </div>
      <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
    </Link>
  );
}
