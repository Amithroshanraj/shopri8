import { createFileRoute } from "@tanstack/react-router";
import { Home, MapPin, Plus, Search, Trash2, X, Edit2, Check } from "lucide-react";
import { useState } from "react";
import { AppShell, PageHeader } from "@/components/layout/AppShell";
import { useAddresses } from "@/lib/store";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Address as AddressType } from "@/lib/types";

export const Route = createFileRoute("/addresses")({
  head: () => ({
    meta: [
      { title: "Saved addresses — SHOPRi8" },
      { name: "description", content: "Manage your delivery addresses." },
      { property: "og:title", content: "Saved addresses — SHOPRi8" },
      { property: "og:description", content: "Manage your delivery addresses." },
    ],
  }),
  component: Addresses,
});

type LabelType = "Home" | "Work" | "Other";

function Addresses() {
  const { addresses, add, remove, setDefault, update } = useAddresses();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Form state
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

  const resetForm = () => {
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

  const handleAdd = () => {
    resetForm();
    setOpen(true);
    setEditingId(null);
  };

  const handleEdit = (addr: AddressType) => {
    setLabel((addr.label as LabelType) || "Other");
    setCustomLabel(addr.label === "Home" || addr.label === "Work" ? "" : addr.label);
    setRecipientName(addr.recipientName || "");
    setPhone(addr.phone || "");
    setAddress(addr.address || "");
    setHouseNumber(addr.houseNumber || "");
    setLandmark(addr.landmark || "");
    setIsDefault(addr.isDefault || false);
    setSelectedLocation({
      address: addr.address,
      latitude: addr.latitude,
      longitude: addr.longitude,
    });
    setEditingId(addr.id);
    setOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
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

    // Phone validation (basic Indian phone format)
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

    try {
      if (editingId) {
        await update(editingId, {
          ...addressData,
          ...(selectedLocation
            ? { latitude: selectedLocation.latitude, longitude: selectedLocation.longitude }
            : {}),
        });
        toast.success("Address updated");
      } else {
        await add(addressData, selectedLocation ?? undefined);
        toast.success("Address saved");
      }
      resetForm();
      setOpen(false);
      setEditingId(null);
    } catch (error) {
      toast.error("Could not save address", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await remove(id);
      setDeleteConfirmId(null);
      toast.success("Address deleted");
    } catch (error) {
      toast.error("Could not delete address", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      await setDefault(id);
      toast.success("Default address updated");
    } catch (error) {
      toast.error("Could not update default address", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    }
  };

  const handleLocationSelect = (location: {
    address: string;
    latitude: number;
    longitude: number;
  }) => {
    setSelectedLocation(location);
    setAddress(location.address);
  };

  const handleUseDeviceLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Location is unavailable", { description: "Enter your address manually." });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) =>
        handleLocationSelect({
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
    <AppShell>
      <PageHeader title="Saved addresses" />

      {addresses.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <MapPin className="mb-3 h-12 w-12 text-muted-foreground" />
          <p className="mb-4 text-sm text-muted-foreground">No saved delivery addresses yet.</p>
          <button
            onClick={handleAdd}
            className="press flex items-center gap-2 rounded-2xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground"
          >
            <Plus className="h-4 w-4" /> Add delivery address
          </button>
        </div>
      ) : (
        <div className="mb-4 space-y-3">
          {addresses.map((a) => (
            <div key={a.id} className="relative rounded-2xl glass-1 p-4">
              {deleteConfirmId === a.id ? (
                <div className="space-y-3">
                  <p className="text-sm">Delete this delivery address?</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setDeleteConfirmId(null)}
                      className="press flex-1 rounded-xl glass-1 py-2.5 text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleDelete(a.id)}
                      className="press flex-1 rounded-xl bg-destructive py-2.5 text-sm font-semibold text-destructive-foreground"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15">
                      {a.label === "Home" ? (
                        <Home className="h-5 w-5 text-soft-violet" />
                      ) : (
                        <MapPin className="h-5 w-5 text-soft-violet" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold">{a.label}</p>
                        {a.isDefault && (
                          <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[0.6rem] font-semibold text-soft-violet">
                            ✓ Default
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-medium">{a.recipientName}</p>
                      <p className="text-xs text-muted-foreground">{a.phone}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{a.address}</p>
                      {a.houseNumber && (
                        <p className="text-xs text-muted-foreground">{a.houseNumber}</p>
                      )}
                      {a.landmark && (
                        <p className="text-xs text-muted-foreground">Near {a.landmark}</p>
                      )}
                      {!a.isDefault && (
                        <button
                          onClick={() => handleSetDefault(a.id)}
                          className="mt-2 text-xs text-soft-violet"
                        >
                          Set as default
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 flex justify-end gap-2">
                    <button
                      onClick={() => handleEdit(a)}
                      className="press rounded-lg p-2 text-muted-foreground hover:text-soft-violet"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(a.id)}
                      className="press rounded-lg p-2 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {addresses.length > 0 && !open && (
        <button
          onClick={handleAdd}
          className="press flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-4 text-sm text-soft-violet"
        >
          <Plus className="h-4 w-4" /> Add new address
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm">
          <div className="fixed inset-x-0 bottom-0 z-50 max-h-[90vh] overflow-y-auto rounded-t-3xl bg-background p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {editingId ? "Edit delivery address" : "Add delivery address"}
              </h2>
              <button
                onClick={() => {
                  setOpen(false);
                  setEditingId(null);
                  resetForm();
                }}
                className="press rounded-full p-2"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Location Section */}
              <div className="space-y-2">
                <p className="text-sm font-semibold">LOCATION</p>
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={handleUseDeviceLocation}
                    className="press flex w-full items-center gap-3 rounded-xl border border-dashed border-border px-4 py-3 text-sm text-soft-violet"
                  >
                    <MapPin className="h-4 w-4" /> Use device location
                  </button>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
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
                    setOpen(false);
                    setEditingId(null);
                    resetForm();
                  }}
                  className="press flex-1 rounded-xl glass-1 py-3 text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="press flex-1 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground"
                >
                  {editingId ? "Update" : "Save"} Address
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
