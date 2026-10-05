import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Banknote, Home, MapPin, Plus, QrCode, ShoppingBag, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell, EmptyState, PageHeader } from "@/components/layout/AppShell";
import { Bill } from "./cart";
import { useCart } from "@/lib/cart";
import { formatPrice } from "@/lib/geo";
import { useAddresses, useOrders } from "@/lib/store";
import { isFirebaseActive } from "@/lib/firebase";
import {
  clearDemoCheckoutIdempotencyKey,
  demoPaymentRequest,
  getDemoCheckoutIdempotencyKey,
} from "@/lib/demoPaymentClient";
import type { Order, PaymentMethod } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [
      { title: "Checkout — SHOPRi8" },
      { name: "description", content: "Choose delivery address and payment to place your order." },
      { property: "og:title", content: "Checkout — SHOPRi8" },
      { property: "og:description", content: "Place your neighbourhood order." },
    ],
  }),
  component: Checkout,
});

type LabelType = "Home" | "Work" | "Other";

function Checkout() {
  const cart = useCart();
  const { addresses, add } = useAddresses();
  const { place, placeFirebaseOrder } = useOrders();
  const navigate = useNavigate();
  const [addressId, setAddressId] = useState<string | null>(null);
  const [showAddAddress, setShowAddAddress] = useState(false);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("COD");
  const selected = addresses.find((a) => a.id === addressId) ?? addresses.find((a) => a.isDefault);

  // Add address form state
  const [label, setLabel] = useState<LabelType>("Home");
  const [customLabel, setCustomLabel] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [houseNumber, setHouseNumber] = useState("");
  const [landmark, setLandmark] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<{
    address: string;
    latitude: number;
    longitude: number;
  } | null>(null);

  const resetAddForm = () => {
    setLabel("Home");
    setCustomLabel("");
    setRecipientName("");
    setPhone("");
    setAddress("");
    setHouseNumber("");
    setLandmark("");
    setIsDefault(false);
    setSelectedLocation(null);
  };

  const handleAddAddress = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!recipientName.trim()) {
      toast.error("Recipient name is required");
      return;
    }
    if (!phone.trim()) {
      toast.error("Contact number is required");
      return;
    }
    if (!address.trim()) {
      toast.error("Address is required");
      return;
    }

    const phoneRegex = /^[6-9]\d{9}$/;
    const cleanPhone = phone.replace(/\D/g, "");
    if (!phoneRegex.test(cleanPhone)) {
      toast.error("Please enter a valid Indian phone number");
      return;
    }

    const finalLabel = label === "Other" ? customLabel.trim() || "Other" : label;
    const finalAddress = selectedLocation?.address || address;

    const addressData = {
      label: finalLabel,
      recipientName: recipientName.trim(),
      phone: cleanPhone,
      address: finalAddress,
      houseNumber: houseNumber.trim(),
      landmark: landmark.trim(),
      isDefault,
    };

    void add(addressData, selectedLocation ?? undefined)
      .then(() => {
        toast.success("Address saved");
        resetAddForm();
        setShowAddAddress(false);
      })
      .catch((error: unknown) => {
        toast.error("Could not save address", {
          description: error instanceof Error ? error.message : "Please try again.",
        });
      });
  };

  const handleLocationSelect = (location: {
    address: string;
    latitude: number;
    longitude: number;
  }) => {
    setSelectedLocation(location);
    setAddress(location.address);
  };

  if (cart.lines.length === 0) {
    return (
      <AppShell nav={false}>
        <PageHeader title="Checkout" />
        <EmptyState
          icon={<ShoppingBag className="h-6 w-6" />}
          title="Nothing to check out"
          body="Your cart is empty."
          cta={{ label: "Browse shops", to: "/" }}
        />
      </AppShell>
    );
  }

  const placeOrder = async () => {
    if (!selected || !cart.shopId || isPlacingOrder) return;
    setIsPlacingOrder(true);
    try {
      if (isFirebaseActive) {
        if (paymentMethod === "DEMO_UPI") {
          const items = cart.lines.map(({ productId, quantity }) => ({ productId, quantity }));
          const fingerprint = JSON.stringify({
            shopId: cart.shopId,
            deliveryAddressId: selected.id,
            items: [...items].sort((left, right) => left.productId.localeCompare(right.productId)),
          });
          const idempotencyKey = getDemoCheckoutIdempotencyKey(fingerprint);
          const payment = await demoPaymentRequest("create", {
            idempotencyKey,
            shopId: cart.shopId,
            deliveryAddressId: selected.id,
            items,
          });
          cart.clear();
          clearDemoCheckoutIdempotencyKey();
          toast.info("Demo payment ready", {
            description: `No real payment will be processed. Order total: ${formatPrice(payment.amount)}.`,
          });
          navigate({ to: "/orders/$orderId", params: { orderId: payment.orderId } });
          return;
        }
        const orderId = await placeFirebaseOrder({
          shopId: cart.shopId,
          deliveryAddressId: selected.id,
          items: cart.lines.map(({ productId, quantity }) => ({ productId, quantity })),
        });
        cart.clear();
        toast.success("Order placed", { description: "The shop will review it shortly." });
        navigate({ to: "/orders/$orderId", params: { orderId } });
        return;
      }
      const now = new Date().toISOString();
      const order: Order = {
        id: `SR8-${Date.now().toString(36).toUpperCase()}`,
        customerId: "local",
        shopId: cart.shopId,
        shopName: cart.shopName ?? "Shop",
        items: cart.lines.map((l) => ({
          productId: l.productId,
          name: l.name,
          price: l.price,
          quantity: l.quantity,
        })),
        subtotal: cart.subtotal,
        deliveryFee: cart.deliveryFee,
        totalAmount: cart.total,
        deliveryAddress: selected,
        paymentMethod: "COD",
        paymentStatus: "COD_PENDING",
        orderStatus: "PLACED",
        statusHistory: [{ status: "PLACED", at: now }],
        createdAt: now,
        updatedAt: now,
      };
      place(order);
      cart.clear();
      toast.success("Order placed", { description: "The shop will review it shortly." });
      navigate({ to: "/orders/$orderId", params: { orderId: order.id } });
    } catch (error) {
      toast.error("Could not place your order", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setIsPlacingOrder(false);
    }
  };

  const handleUseDeviceLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Location is unavailable", { description: "Enter your address manually." });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) =>
        setSelectedLocation({
          address: address.trim(),
          latitude: coords.latitude,
          longitude: coords.longitude,
        }),
      () =>
        toast.error("Could not get your location", {
          description: "Allow location access and retry.",
        }),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };

  return (
    <AppShell nav={false}>
      <PageHeader title="Checkout" subtitle={cart.shopName ?? undefined} />
      <section className="mb-5">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Delivery address</h2>
          <Link to="/addresses" className="text-xs text-soft-violet">
            Manage
          </Link>
        </div>
        {addresses.length === 0 ? (
          <button
            onClick={() => setShowAddAddress(true)}
            className="press flex w-full items-center justify-center gap-3 rounded-2xl border border-dashed border-border p-4 text-sm text-soft-violet"
          >
            <MapPin className="h-5 w-5" /> Add delivery address
          </button>
        ) : (
          <div className="space-y-2">
            {addresses.map((a) => (
              <button
                key={a.id}
                onClick={() => setAddressId(a.id)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-2xl p-4 text-left",
                  selected?.id === a.id ? "glass-2 ring-1 ring-primary" : "glass-1",
                )}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15">
                  {a.label === "Home" ? (
                    <Home className="h-5 w-5 text-soft-violet" />
                  ) : (
                    <MapPin className="h-5 w-5 text-soft-violet" />
                  )}
                </div>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">
                    {a.label}{" "}
                    {a.isDefault && (
                      <span className="ml-1 rounded-full bg-primary/15 px-2 py-0.5 text-[0.6rem] text-soft-violet">
                        Default
                      </span>
                    )}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {a.recipientName} • {a.phone}
                  </span>
                  <span className="block text-xs text-muted-foreground">{a.address}</span>
                </span>
              </button>
            ))}
            <button
              onClick={() => setShowAddAddress(true)}
              className="press flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-3 text-sm text-soft-violet"
            >
              <Plus className="h-4 w-4" /> Add new address
            </button>
          </div>
        )}
      </section>
      <section className="mb-5">
        <h2 className="mb-2 text-sm font-semibold">Payment</h2>
        <div className="space-y-2">
          <button
            type="button"
            aria-pressed={paymentMethod === "COD"}
            onClick={() => setPaymentMethod("COD")}
            className={cn(
              "flex w-full items-center gap-3 rounded-2xl p-4 text-left",
              paymentMethod === "COD" ? "glass-2 ring-1 ring-primary" : "glass-1",
            )}
          >
            <Banknote className="h-5 w-5 text-soft-violet" />
            <span className="flex-1 text-sm font-semibold">Cash on delivery</span>
          </button>
          {isFirebaseActive && (
            <button
              type="button"
              aria-pressed={paymentMethod === "DEMO_UPI"}
              onClick={() => setPaymentMethod("DEMO_UPI")}
              className={cn(
                "flex w-full items-center gap-3 rounded-2xl p-4 text-left",
                paymentMethod === "DEMO_UPI" ? "glass-2 ring-1 ring-primary" : "glass-1",
              )}
            >
              <QrCode className="h-5 w-5 text-soft-violet" />
              <span className="flex-1 text-sm font-semibold">UPI / QR Demo Payment</span>
              <span className="text-xs text-muted-foreground">Academic Demo</span>
            </button>
          )}
        </div>
      </section>
      <Bill subtotal={cart.subtotal} deliveryFee={cart.deliveryFee} total={cart.total} />
      <div className="fixed inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <button
          disabled={!selected || isPlacingOrder}
          onClick={placeOrder}
          className="press w-full max-w-md rounded-2xl bg-primary py-4 text-sm font-semibold text-primary-foreground glow-primary disabled:opacity-50"
        >
          {isPlacingOrder
            ? "Placing order..."
            : selected
              ? `${paymentMethod === "DEMO_UPI" ? "Continue to demo QR" : "Place order"} · ${formatPrice(cart.total)}`
              : "Add an address to continue"}
        </button>
      </div>

      {/* Add Address Modal */}
      {showAddAddress && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm">
          <div className="fixed inset-x-0 bottom-0 z-50 max-h-[90vh] overflow-y-auto rounded-t-3xl bg-background p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Add delivery address</h2>
              <button
                onClick={() => {
                  setShowAddAddress(false);
                  resetAddForm();
                }}
                className="press rounded-full p-2"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddAddress} className="space-y-4">
              {/* Location Section */}
              <div className="space-y-2">
                <p className="text-sm font-semibold">LOCATION</p>
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => {
                      handleUseDeviceLocation();
                    }}
                    className="press flex w-full items-center gap-3 rounded-xl border border-dashed border-border px-4 py-3 text-sm text-soft-violet"
                  >
                    <MapPin className="h-4 w-4" /> Use device location
                  </button>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Search for location"
                      className="w-full rounded-xl border border-input bg-transparent pl-10 pr-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>
                </div>
                {selectedLocation && (
                  <div className="rounded-xl bg-primary/5 p-3">
                    <p className="text-xs text-muted-foreground">Selected address</p>
                    <p className="text-sm">{selectedLocation.address}</p>
                  </div>
                )}
              </div>

              {/* Contact Details */}
              <div className="space-y-2">
                <p className="text-sm font-semibold">CONTACT DETAILS</p>
                <input
                  type="text"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="Recipient name (e.g. Amma, Arun, Office)"
                  className="w-full rounded-xl border border-input bg-transparent px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-ring"
                />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 XXXXX XXXXX"
                  className="w-full rounded-xl border border-input bg-transparent px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              {/* Address Details */}
              <div className="space-y-2">
                <p className="text-sm font-semibold">ADDRESS DETAILS</p>
                <input
                  type="text"
                  value={houseNumber}
                  onChange={(e) => setHouseNumber(e.target.value)}
                  placeholder="House / Flat / Door No. (optional)"
                  className="w-full rounded-xl border border-input bg-transparent px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-ring"
                />
                <input
                  type="text"
                  value={landmark}
                  onChange={(e) => setLandmark(e.target.value)}
                  placeholder="Landmark (optional)"
                  className="w-full rounded-xl border border-input bg-transparent px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              {/* Label Selection */}
              <div className="space-y-2">
                <p className="text-sm font-semibold">SAVE AS</p>
                <div className="flex gap-2">
                  {(["Home", "Work", "Other"] as LabelType[]).map((l) => (
                    <button
                      key={l}
                      type="button"
                      onClick={() => setLabel(l)}
                      className={cn(
                        "press flex-1 rounded-xl py-2.5 text-sm font-medium",
                        label === l ? "bg-primary text-primary-foreground" : "glass-1",
                      )}
                    >
                      {l}
                    </button>
                  ))}
                </div>
                {label === "Other" && (
                  <input
                    type="text"
                    value={customLabel}
                    onChange={(e) => setCustomLabel(e.target.value)}
                    placeholder="Custom label (e.g. Friend, Office)"
                    className="w-full rounded-xl border border-input bg-transparent px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-ring"
                  />
                )}
              </div>

              {/* Default Toggle */}
              <label className="flex items-center gap-3 rounded-xl glass-1 p-3">
                <input
                  type="checkbox"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="h-4 w-4 rounded border-input bg-transparent text-primary focus:ring-1 focus:ring-ring"
                />
                <span className="text-sm">Make this my default address</span>
              </label>

              {/* Submit */}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddAddress(false);
                    resetAddForm();
                  }}
                  className="press flex-1 rounded-xl glass-1 py-3 text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="press flex-1 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground"
                >
                  Save Address
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
