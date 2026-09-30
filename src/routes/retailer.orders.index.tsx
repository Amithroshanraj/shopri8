import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, Clock, Filter, Package, Search, ShoppingBag } from "lucide-react";
import { useState } from "react";
import { useRetailerStore } from "@/lib/retailerStore";
import { formatPrice } from "@/lib/geo";
import { ORDER_STATUS_LABEL, type OrderStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

type FilterTab =
  | "all"
  | "PLACED"
  | "ACCEPTED"
  | "PREPARING"
  | "READY_FOR_PICKUP"
  | "DELIVERED"
  | "REJECTED"
  | "CANCELLED";

const TABS: { id: FilterTab; label: string }[] = [
  { id: "all", label: "All Orders" },
  { id: "PLACED", label: "New" },
  { id: "ACCEPTED", label: "Accepted" },
  { id: "PREPARING", label: "Preparing" },
  { id: "READY_FOR_PICKUP", label: "Ready for Pickup" },
  { id: "DELIVERED", label: "Completed" },
  { id: "REJECTED", label: "Rejected" },
  { id: "CANCELLED", label: "Cancelled" },
];

export const Route = createFileRoute("/retailer/orders/")({
  head: () => ({
    meta: [
      { title: "Orders Management — SHOPRi8 Retailer" },
      { name: "description", content: "Review and manage shop customer orders" },
    ],
  }),
  component: RetailerOrders,
});

function RetailerOrders() {
  const { orders, loading } = useRetailerStore();
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [searchQuery, setSearchQuery] = useState("");

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto" />
          <p className="mt-3 text-sm text-muted-foreground">Loading orders...</p>
        </div>
      </div>
    );
  }

  // Filter orders
  const filteredOrders = orders.filter((order) => {
    // Tab filtering
    if (activeTab === "PLACED") {
      if (order.orderStatus !== "PLACED" && order.orderStatus !== "RETAILER_REVIEW") {
        return false;
      }
    } else if (activeTab !== "all" && order.orderStatus !== activeTab) {
      return false;
    }

    // Search query filtering
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchId = order.id.toLowerCase().includes(q);
      const matchCustomer = order.deliveryAddress?.recipientName?.toLowerCase().includes(q);
      const matchItems = order.items.some((i) => i.name.toLowerCase().includes(q));
      if (!matchId && !matchCustomer && !matchItems) return false;
    }

    return true;
  });

  // Calculate counts per tab
  const getTabCount = (tabId: FilterTab) => {
    if (tabId === "all") return orders.length;
    if (tabId === "PLACED") {
      return orders.filter((o) => o.orderStatus === "PLACED" || o.orderStatus === "RETAILER_REVIEW")
        .length;
    }
    return orders.filter((o) => o.orderStatus === tabId).length;
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
            Order Management
          </h1>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            Review incoming orders, update preparation status, and prepare for delivery
          </p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by Order ID, customer name, or item..."
          className="w-full rounded-2xl border border-border/80 bg-card/40 pl-10 pr-4 py-2.5 text-sm outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary backdrop-blur-sm"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
          >
            Clear
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {TABS.map((tab) => {
          const count = getTabCount(tab.id);
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "press flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold whitespace-nowrap transition-all",
                active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-card/50 text-muted-foreground border border-border/60 hover:text-foreground hover:bg-card",
              )}
            >
              {tab.label}
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.2 text-[0.65rem]",
                  active
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-card/20 p-12 text-center">
          <ShoppingBag className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-base font-semibold text-foreground">No orders found</h3>
          <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
            {searchQuery
              ? "No orders match your search criteria. Try a different query."
              : `There are currently no orders in the "${TABS.find((t) => t.id === activeTab)?.label}" status.`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((order) => {
            const isNew = order.orderStatus === "PLACED";
            const itemCount = order.items.reduce((acc, i) => acc + i.quantity, 0);

            return (
              <Link
                key={order.id}
                to="/retailer/orders/$orderId"
                params={{ orderId: order.id }}
                className={cn(
                  "press block rounded-2xl border border-border/70 bg-card/50 p-4 sm:p-5 transition-all hover:bg-card/80 hover:border-border backdrop-blur-sm",
                  isNew && "border-warning/50 bg-warning/5",
                )}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm font-bold text-foreground">
                        {order.id}
                      </span>
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-0.5 text-[0.7rem] font-semibold",
                          order.orderStatus === "PLACED"
                            ? "bg-warning/20 text-warning"
                            : order.orderStatus === "ACCEPTED" || order.orderStatus === "PREPARING"
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

                      <span className="rounded bg-muted/60 px-2 py-0.5 text-[0.65rem] font-medium text-muted-foreground">
                        {order.paymentMethod === "COD" ? "Cash on Delivery" : "Online Paid"}
                      </span>
                    </div>

                    <p className="text-xs text-foreground font-medium">
                      Recipient:{" "}
                      <span className="font-normal text-muted-foreground">
                        {order.deliveryAddress?.recipientName}
                      </span>
                      {order.deliveryAddress?.phone && (
                        <span className="text-muted-foreground">
                          {" "}
                          ({order.deliveryAddress.phone})
                        </span>
                      )}
                    </p>

                    <p className="text-xs text-muted-foreground truncate">
                      {order.items.map((i) => `${i.quantity}x ${i.name}`).join(", ")}
                    </p>

                    <div className="flex items-center gap-2 text-[0.7rem] text-muted-foreground pt-1">
                      <Clock className="h-3 w-3" />
                      <span>
                        {new Date(order.createdAt).toLocaleString("en-IN", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-border/40 pt-2.5 sm:border-0 sm:pt-0 sm:flex-col sm:items-end sm:justify-center shrink-0">
                    <div className="sm:text-right">
                      <p className="text-base font-bold text-foreground">
                        {formatPrice(order.totalAmount)}
                      </p>
                      <p className="text-[0.7rem] text-muted-foreground">
                        {itemCount} item{itemCount !== 1 ? "s" : ""}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 text-xs font-semibold text-soft-violet sm:mt-2">
                      <span>View Details</span>
                      <ChevronRight className="h-4 w-4" />
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
