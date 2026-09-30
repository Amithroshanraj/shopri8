import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Clock,
  MapPin,
  Package,
  Phone,
  Truck,
  User,
  X,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useRetailerStore } from "@/lib/retailerStore";
import { formatPrice } from "@/lib/geo";
import { ORDER_STATUS_FLOW, ORDER_STATUS_LABEL, type OrderStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/retailer/orders/$orderId")({
  head: ({ params }) => ({
    meta: [
      { title: `Order ${params.orderId} — SHOPRi8 Retailer` },
      { name: "description", content: "Order details and fulfillment status" },
    ],
  }),
  component: RetailerOrderDetails,
});

const PROGRESS_STEPS: OrderStatus[] = [
  "PLACED",
  "ACCEPTED",
  "PREPARING",
  "READY_FOR_PICKUP",
  "DELIVERED",
];

function RetailerOrderDetails() {
  const { orderId } = Route.useParams();
  const navigate = useNavigate();
  const { orders, updateOrderStatus } = useRetailerStore();
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const order = orders.find((o) => o.id === orderId);

  if (!order) {
    return (
      <div className="rounded-3xl border border-dashed border-border bg-card/20 p-12 text-center">
        <Package className="mx-auto h-12 w-12 text-muted-foreground" />
        <h2 className="mt-4 text-base font-semibold text-foreground">Order Not Found</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          The requested order ID "{orderId}" does not exist or has been removed.
        </p>
        <Link
          to="/retailer/orders"
          className="press mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Orders List
        </Link>
      </div>
    );
  }

  const isPlaced = order.orderStatus === "PLACED" || order.orderStatus === "RETAILER_REVIEW";
  const isAccepted = order.orderStatus === "ACCEPTED";
  const isPreparing = order.orderStatus === "PREPARING";
  const isReady = order.orderStatus === "READY_FOR_PICKUP";
  const isRejected = order.orderStatus === "REJECTED";
  const isCancelled = order.orderStatus === "CANCELLED";
  const isDelivered = order.orderStatus === "DELIVERED";

  // Actions
  const handleAccept = () => {
    setIsProcessing(true);
    try {
      updateOrderStatus(order.id, "ACCEPTED");
      toast.success("Order Accepted", {
        description: `Order ${order.id} is now accepted and queued for preparation.`,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStartPreparing = () => {
    setIsProcessing(true);
    try {
      updateOrderStatus(order.id, "PREPARING");
      toast.success("Preparation Started", {
        description: `Order ${order.id} is now being packed.`,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMarkReady = () => {
    setIsProcessing(true);
    try {
      updateOrderStatus(order.id, "READY_FOR_PICKUP");
      toast.success("Ready for Pickup", {
        description: "Delivery partner will be assigned for pickup.",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRejectConfirm = () => {
    setIsProcessing(true);
    try {
      const reason = rejectReason.trim() || "Item unavailable or shop unable to fulfill";
      updateOrderStatus(order.id, "REJECTED", reason);
      toast.error("Order Rejected", {
        description: "Customer has been notified of the order rejection.",
      });
      setShowRejectModal(false);
    } finally {
      setIsProcessing(false);
    }
  };

  // Find step progress
  const currentStepIndex = PROGRESS_STEPS.indexOf(order.orderStatus);

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex items-center gap-3">
        <Link
          to="/retailer/orders"
          className="press rounded-xl border border-border/80 bg-card/60 p-2.5 text-foreground hover:bg-card"
          aria-label="Back to orders"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-mono text-lg font-bold text-foreground sm:text-xl">{order.id}</h1>
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                isPlaced
                  ? "bg-warning/20 text-warning"
                  : isAccepted || isPreparing
                    ? "bg-soft-violet/20 text-soft-violet"
                    : isReady
                      ? "bg-primary/20 text-primary-foreground"
                      : isDelivered
                        ? "bg-success/20 text-success"
                        : "bg-destructive/20 text-destructive",
              )}
            >
              {ORDER_STATUS_LABEL[order.orderStatus] || order.orderStatus}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Placed on{" "}
            {new Date(order.createdAt).toLocaleString("en-IN", {
              dateStyle: "full",
              timeStyle: "short",
            })}
          </p>
        </div>
      </div>

      {/* Special State Alerts */}
      {isRejected && (
        <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4">
          <div className="flex items-start gap-3">
            <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-destructive">Order Rejected</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Reason:{" "}
                <span className="text-foreground font-medium">
                  {order.rejectionReason || "No specific reason provided."}
                </span>
              </p>
            </div>
          </div>
        </div>
      )}

      {isCancelled && (
        <div className="rounded-2xl border border-muted bg-muted/20 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-foreground">Order Cancelled</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                This order was cancelled by the customer.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Status Timeline */}
      {!isRejected && !isCancelled && (
        <div className="rounded-3xl border border-border/70 bg-card/40 p-5 backdrop-blur-sm">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            Order Progress
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {PROGRESS_STEPS.map((step, idx) => {
              const isPast = currentStepIndex !== -1 && idx <= currentStepIndex;
              const isCurrent = order.orderStatus === step;

              return (
                <div
                  key={step}
                  className={cn(
                    "flex flex-col items-center text-center p-2.5 rounded-2xl border transition-all",
                    isCurrent
                      ? "border-primary bg-primary/10 shadow-sm"
                      : isPast
                        ? "border-success/30 bg-success/5"
                        : "border-border/40 bg-background/30 opacity-60",
                  )}
                >
                  <div
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold mb-1.5",
                      isCurrent
                        ? "bg-primary text-primary-foreground"
                        : isPast
                          ? "bg-success text-success-foreground"
                          : "bg-muted text-muted-foreground",
                    )}
                  >
                    {isPast && !isCurrent ? <Check className="h-4 w-4" /> : idx + 1}
                  </div>
                  <span className="text-[0.7rem] font-semibold text-foreground leading-tight">
                    {ORDER_STATUS_LABEL[step]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Two Column Layout: Items & Info */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Items List (2 cols) */}
        <div className="md:col-span-2 space-y-4">
          <div className="rounded-3xl border border-border/70 bg-card/40 p-5 backdrop-blur-sm">
            <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center justify-between">
              <span>Order Items</span>
              <span className="text-xs text-muted-foreground">
                {order.items.length} item{order.items.length > 1 ? "s" : ""}
              </span>
            </h2>

            <div className="divide-y divide-border/50">
              {order.items.map((item, i) => (
                <div key={i} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatPrice(item.price)} × {item.quantity}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-foreground">
                      {formatPrice(item.price * item.quantity)}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Bill Summary */}
            <div className="mt-4 pt-4 border-t border-border/80 space-y-2 text-xs">
              <div className="flex justify-between text-muted-foreground">
                <span>Items Subtotal</span>
                <span>{formatPrice(order.subtotal)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Delivery Fee</span>
                <span>{formatPrice(order.deliveryFee)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-foreground pt-2 border-t border-border/50">
                <span>Total Amount</span>
                <span className="text-soft-violet">{formatPrice(order.totalAmount)}</span>
              </div>
            </div>
          </div>

          {/* Action Transition Buttons */}
          <div className="rounded-3xl border border-border/70 bg-card/40 p-5 backdrop-blur-sm space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Retailer Actions
            </h3>

            {isPlaced && (
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handleAccept}
                  disabled={isProcessing}
                  className="press flex-1 rounded-2xl bg-primary py-3 px-4 text-sm font-semibold text-primary-foreground shadow-md transition-all hover:bg-primary/90 disabled:opacity-50"
                >
                  Accept Order
                </button>
                <button
                  onClick={() => setShowRejectModal(true)}
                  disabled={isProcessing}
                  className="press rounded-2xl border border-destructive/40 bg-destructive/10 py-3 px-6 text-sm font-semibold text-destructive hover:bg-destructive/20 transition-all disabled:opacity-50"
                >
                  Reject Order
                </button>
              </div>
            )}

            {isAccepted && (
              <button
                onClick={handleStartPreparing}
                disabled={isProcessing}
                className="press w-full rounded-2xl bg-primary py-3 px-4 text-sm font-semibold text-primary-foreground shadow-md transition-all hover:bg-primary/90 disabled:opacity-50"
              >
                Start Preparing
              </button>
            )}

            {isPreparing && (
              <button
                onClick={handleMarkReady}
                disabled={isProcessing}
                className="press w-full rounded-2xl bg-success py-3 px-4 text-sm font-semibold text-success-foreground shadow-md transition-all hover:bg-success/90 disabled:opacity-50"
              >
                Mark Ready for Pickup
              </button>
            )}

            {isReady && (
              <div className="rounded-2xl border border-primary/30 bg-primary/10 p-4 text-center">
                <Truck className="h-6 w-6 text-soft-violet mx-auto mb-1.5" />
                <h4 className="text-sm font-semibold text-foreground">Ready for Pickup</h4>
                <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
                  Order is packed and ready. Waiting for a delivery worker to accept assignment and
                  arrive for pickup.
                </p>
                <p className="mt-2 text-[0.7rem] text-muted-foreground">
                  (Retailer does not control delivery dispatch — delivery worker manages transit)
                </p>
              </div>
            )}

            {(order.orderStatus === "PICKED_UP" || order.orderStatus === "OUT_FOR_DELIVERY") && (
              <div className="rounded-2xl border border-soft-violet/30 bg-soft-violet/10 p-4 text-center">
                <Truck className="h-6 w-6 text-soft-violet mx-auto mb-1.5" />
                <h4 className="text-sm font-semibold text-foreground">In Transit</h4>
                <p className="mt-1 text-xs text-muted-foreground">
                  Order has been picked up by the delivery partner and is en route to customer.
                </p>
              </div>
            )}

            {isDelivered && (
              <div className="rounded-2xl border border-success/30 bg-success/10 p-4 text-center">
                <Check className="h-6 w-6 text-success mx-auto mb-1.5" />
                <h4 className="text-sm font-semibold text-success">Delivered Successfully</h4>
                <p className="mt-1 text-xs text-muted-foreground">
                  This order was successfully fulfilled and delivered.
                </p>
              </div>
            )}

            {isRejected && (
              <p className="text-xs text-muted-foreground text-center py-2">
                This order was rejected. No further actions can be taken.
              </p>
            )}

            {isCancelled && (
              <p className="text-xs text-muted-foreground text-center py-2">
                This order was cancelled by customer.
              </p>
            )}
          </div>
        </div>

        {/* Customer & Address Details (1 col) */}
        <div className="space-y-4">
          {/* Customer / Recipient Card */}
          <div className="rounded-3xl border border-border/70 bg-card/40 p-5 backdrop-blur-sm space-y-3">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" /> Customer Details
            </h2>
            <div className="space-y-1 text-xs">
              <p className="font-semibold text-foreground text-sm">
                {order.deliveryAddress?.recipientName || "Customer"}
              </p>
              {order.deliveryAddress?.phone && (
                <div className="flex items-center gap-2 text-muted-foreground pt-1">
                  <Phone className="h-3.5 w-3.5 text-soft-violet shrink-0" />
                  <a
                    href={`tel:${order.deliveryAddress.phone}`}
                    className="hover:underline text-foreground"
                  >
                    {order.deliveryAddress.phone}
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Delivery Address Card */}
          <div className="rounded-3xl border border-border/70 bg-card/40 p-5 backdrop-blur-sm space-y-3">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" /> Delivery Address
            </h2>
            <div className="space-y-1.5 text-xs text-muted-foreground">
              {order.deliveryAddress?.houseNumber && (
                <p className="font-medium text-foreground">{order.deliveryAddress.houseNumber}</p>
              )}
              <p>{order.deliveryAddress?.address}</p>
              {order.deliveryAddress?.landmark && (
                <p className="text-[0.7rem] text-muted-foreground">
                  Landmark: {order.deliveryAddress.landmark}
                </p>
              )}
            </div>
          </div>

          {/* Payment Card */}
          <div className="rounded-3xl border border-border/70 bg-card/40 p-5 backdrop-blur-sm space-y-3">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Payment Information
            </h2>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Method:</span>
                <span className="font-semibold text-foreground">
                  {order.paymentMethod === "COD" ? "Cash on Delivery" : "Online Payment (Cashfree)"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Payment Status:</span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[0.65rem] font-semibold",
                    order.paymentStatus === "PAID"
                      ? "bg-success/20 text-success"
                      : "bg-warning/20 text-warning",
                  )}
                >
                  {order.paymentStatus}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-5 w-5" />
                <h3 className="font-semibold text-base">Reject Order</h3>
              </div>
              <button
                onClick={() => setShowRejectModal(false)}
                className="press rounded-full p-1.5 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-muted-foreground">
              Are you sure you want to reject Order{" "}
              <span className="font-mono font-semibold text-foreground">{order.id}</span>? The
              customer will be informed immediately.
            </p>

            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">
                Rejection Reason (Optional)
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. Items out of stock, store closed due to rain, etc."
                rows={3}
                className="w-full rounded-xl border border-input bg-background/50 p-3 text-xs outline-none transition-colors focus:border-destructive focus:ring-1 focus:ring-destructive resize-none"
              />
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowRejectModal(false)}
                className="press flex-1 rounded-xl border border-border bg-card py-2.5 text-xs font-medium text-foreground hover:bg-accent"
              >
                Keep Order
              </button>
              <button
                type="button"
                onClick={handleRejectConfirm}
                className="press flex-1 rounded-xl bg-destructive py-2.5 text-xs font-semibold text-destructive-foreground hover:bg-destructive/90"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
