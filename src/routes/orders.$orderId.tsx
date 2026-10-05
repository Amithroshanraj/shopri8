import { createFileRoute } from "@tanstack/react-router";
import { Check, QrCode } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/layout/AppShell";
import { useCart } from "@/lib/cart";
import { Bill } from "./cart";
import { formatPrice } from "@/lib/geo";
import { useOrders } from "@/lib/store";
import { buildDemoQrPayload, demoPaymentRequest } from "@/lib/demoPaymentClient";
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
  const [showDemoConfirmation, setShowDemoConfirmation] = useState(false);
  const [isConfirmingDemoPayment, setIsConfirmingDemoPayment] = useState(false);
  const order = orders.find((o) => o.id === orderId);

  const confirmDemoPayment = async () => {
    setIsConfirmingDemoPayment(true);
    try {
      await demoPaymentRequest("confirm", { orderId });
      setShowDemoConfirmation(false);
      toast.success("Demo payment confirmed", {
        description: "The simulated payment is recorded. No money was transferred.",
      });
    } catch (error) {
      toast.error("Could not confirm demo payment", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setIsConfirmingDemoPayment(false);
    }
  };

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
  const canCancel =
    order.paymentMethod === "COD" &&
    (order.orderStatus === "PLACED" || order.orderStatus === "RETAILER_REVIEW");
  const isDemoUpi = order.paymentMethod === "DEMO_UPI";
  const demoQrPayload = isDemoUpi ? buildDemoQrPayload(order.id, order.totalAmount) : null;

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
        <div className="mt-3 border-t border-border/60 pt-3">
          <p className="text-xs text-muted-foreground">
            Payment method: {isDemoUpi ? "UPI / QR Demo" : "Cash on delivery"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Payment status: {paymentStatusLabel(order.paymentStatus)}
          </p>
        </div>
      </div>
      {isDemoUpi && order.paymentStatus !== "PAID" && demoQrPayload ? (
        <section className="mb-5 rounded-3xl glass-2 p-5 text-center">
          <div className="mb-4 flex items-center justify-center gap-2 text-sm font-bold tracking-wide text-soft-violet">
            <QrCode className="h-4 w-4" />
            UPI / QR DEMO PAYMENT
          </div>
          <div className="mx-auto mb-4 inline-flex rounded-2xl bg-white p-3">
            <QRCodeSVG
              value={demoQrPayload}
              size={192}
              level="M"
              title="Harmless SHOPRi8 demo payment QR code"
            />
          </div>
          <p className="text-xs font-semibold text-muted-foreground">
            Academic Demo — No real payment
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Demo only — no real payment will be processed.
          </p>
          <div className="mx-auto my-4 max-w-xs space-y-1 rounded-2xl glass-1 p-3 text-left text-xs">
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Amount</span>
              <span className="font-semibold">{formatPrice(order.totalAmount)}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Order ID</span>
              <span className="max-w-[70%] break-all text-right font-semibold">{order.id}</span>
            </div>
          </div>
          <button
            onClick={() => setShowDemoConfirmation(true)}
            className="press w-full rounded-2xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            I've Completed Demo Payment
          </button>
        </section>
      ) : null}
      {showDemoConfirmation ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
          role="presentation"
        >
          <section
            aria-labelledby="demo-payment-confirmation-title"
            aria-modal="true"
            className="w-full max-w-sm rounded-3xl border border-border/70 bg-card p-5 shadow-xl"
            role="dialog"
          >
            <h2 id="demo-payment-confirmation-title" className="text-lg font-semibold">
              Confirm Demo Payment
            </h2>
            <p className="mt-3 text-sm text-muted-foreground">
              This is a simulated payment for the SHOPRi8 academic project. No real money will be
              transferred.
            </p>
            <p className="mt-3 rounded-xl glass-1 p-3 text-sm font-semibold">
              Amount: {formatPrice(order.totalAmount)}
            </p>
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => setShowDemoConfirmation(false)}
                disabled={isConfirmingDemoPayment}
                className="press flex-1 rounded-2xl glass-1 py-3 text-sm font-semibold disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => void confirmDemoPayment()}
                disabled={isConfirmingDemoPayment}
                className="press flex-1 rounded-2xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                {isConfirmingDemoPayment ? "Confirming..." : "Confirm Demo Payment"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
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

function paymentStatusLabel(status: string): string {
  switch (status) {
    case "COD_PENDING":
      return "Cash on delivery";
    case "COD_COLLECTED":
      return "Collected";
    case "PENDING":
    case "CREATED":
      return "Pending";
    case "PAID":
      return "Paid";
    case "FAILED":
      return "Failed";
    case "EXPIRED":
      return "Expired";
    case "CANCELLED":
      return "Cancelled";
    case "REFUNDED":
      return "Refunded";
    case "PARTIALLY_REFUNDED":
      return "Partially refunded";
    default:
      return status;
  }
}
