import { createFileRoute } from "@tanstack/react-router";
import { Clock, Compass, Image as ImageIcon, MapPin, Save, Store } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useRetailerStore } from "@/lib/retailerStore";
import { CATEGORIES, CATEGORY_BY_ID } from "@/data/demo";
import { useCategories } from "@/hooks/useCatalog";
import { firebaseIsActive } from "@/lib/auth";
import type { CategoryId } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/retailer/shop")({
  head: () => ({
    meta: [
      { title: "Shop Settings — SHOPRi8 Retailer" },
      { name: "description", content: "Manage shop profile, operating hours, and location" },
    ],
  }),
  component: RetailerShop,
});

function RetailerShop() {
  const { shop, loading, updateShop, openShop, closeShop } = useRetailerStore();
  const categoriesQuery = useCategories();
  const categories = firebaseIsActive() ? (categoriesQuery.data ?? []) : CATEGORIES;
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    category: "grocery" as CategoryId,
    description: "",
    image: "",
    address: "",
    latitude: 12.9742,
    longitude: 77.5992,
    openingTime: "07:00",
    closingTime: "22:00",
    status: "ACTIVE" as "ACTIVE" | "INACTIVE",
  });

  // Prefill form from store
  useEffect(() => {
    if (shop) {
      setFormData({
        name: shop.name || "",
        category: shop.category || "grocery",
        description: shop.description || "",
        image: shop.image || "",
        address: shop.address || "",
        latitude: shop.latitude || 12.9742,
        longitude: shop.longitude || 77.5992,
        openingTime: shop.openingTime || "07:00",
        closingTime: shop.closingTime || "22:00",
        status: shop.status === "ACTIVE" ? "ACTIVE" : "INACTIVE",
      });
    }
  }, [shop]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto" />
          <p className="mt-3 text-sm text-muted-foreground">Loading shop profile...</p>
        </div>
      </div>
    );
  }

  if (!shop) {
    return (
      <div className="rounded-3xl border border-dashed border-border bg-card/20 p-12 text-center max-w-lg mx-auto">
        <Store className="mx-auto h-12 w-12 text-muted-foreground" />
        <h2 className="mt-4 text-base font-semibold text-foreground">No Shop Profile</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          No shop profile is associated with this retailer account.
        </p>
      </div>
    );
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error("Shop name is required");
      return;
    }

    if (!formData.address.trim()) {
      toast.error("Shop address is required");
      return;
    }

    setSaving(true);
    try {
      await updateShop({
        name: formData.name.trim(),
        category: formData.category,
        description: formData.description.trim(),
        image: formData.image.trim() || undefined,
        address: formData.address.trim(),
        latitude: Number(formData.latitude),
        longitude: Number(formData.longitude),
        openingTime: formData.openingTime,
        closingTime: formData.closingTime,
        status: formData.status,
      });
      toast.success("Shop Profile Saved", {
        description: "Your shop changes are now updated across SHOPRi8.",
      });
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Failed to update shop");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStoreStatus = async () => {
    const nextStatus = shop.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    try {
      if (nextStatus === "ACTIVE") await openShop();
      else await closeShop();
      setFormData((current) => ({ ...current, status: nextStatus }));
      toast.success(nextStatus === "ACTIVE" ? "Shop Opened" : "Shop Closed", {
        description:
          nextStatus === "ACTIVE"
            ? "Customers can now view and place orders."
            : "Shop is now marked closed.",
      });
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Failed to update shop status");
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
            Shop Management
          </h1>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            Configure your shop identity, operational hours, and storefront location
          </p>
        </div>

        {/* Live Status Pill */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleToggleStoreStatus}
            className={cn(
              "press rounded-2xl px-4 py-2 text-xs font-semibold shadow-sm transition-all",
              shop.status === "ACTIVE"
                ? "bg-destructive/15 text-destructive border border-destructive/30 hover:bg-destructive/25"
                : "bg-success/15 text-success border border-success/30 hover:bg-success/25",
            )}
          >
            {shop.status === "ACTIVE" ? "Close Store" : "Open Store"}
          </button>
        </div>
      </div>

      {/* Live Storefront Preview Card */}
      <div className="rounded-3xl border border-border/80 bg-card/50 p-5 backdrop-blur-sm">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-soft-violet">
            <Store className="h-7 w-7" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-bold text-foreground truncate">{shop.name}</h2>
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[0.65rem] font-semibold",
                  shop.status === "ACTIVE"
                    ? "bg-success/20 text-success"
                    : "bg-muted text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    shop.status === "ACTIVE" ? "bg-success" : "bg-muted-foreground",
                  )}
                />
                {shop.status === "ACTIVE" ? "Open Now" : "Currently Closed"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {categories.find((category) => category.id === shop.category)?.name ??
                CATEGORY_BY_ID[shop.category]?.name ??
                shop.category}{" "}
              · {shop.openingTime} – {shop.closingTime}
            </p>
            <p className="text-xs text-muted-foreground mt-1 truncate">📍 {shop.address}</p>
          </div>
        </div>
      </div>

      {/* Settings Form */}
      <div className="rounded-3xl border border-border/80 bg-card/50 p-6 backdrop-blur-sm shadow-sm">
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-foreground">Shop Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full rounded-xl border border-input bg-background/50 px-4 py-2.5 text-sm outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
              required
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-foreground">
              Shop Category *
            </label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value as CategoryId })}
              className="w-full rounded-xl border border-input bg-background/50 px-4 py-2.5 text-sm outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
              required
            >
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id} className="bg-background text-foreground">
                  {cat.name} ({cat.description})
                </option>
              ))}
            </select>
            {firebaseIsActive() && categoriesQuery.isPending ? (
              <p className="mt-1 text-xs text-muted-foreground">Loading categories...</p>
            ) : null}
            {firebaseIsActive() && categoriesQuery.isError ? (
              <p role="alert" className="mt-1 text-xs text-destructive">
                Could not load categories: {categoriesQuery.error.message}
              </p>
            ) : null}
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-foreground">
              Shop Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              placeholder="Tell customers about your shop, specialties, and service..."
              className="w-full rounded-xl border border-input bg-background/50 px-4 py-2.5 text-sm outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary resize-none"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-foreground">
              Shop Physical Address *
            </label>
            <div className="relative">
              <MapPin className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Shop number, street, neighbourhood, city"
                className="w-full rounded-xl border border-input bg-background/50 pl-10 pr-4 py-2.5 text-sm outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
                required
              />
            </div>
          </div>

          {/* Coordinates */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-foreground">
                Latitude Coordinates
              </label>
              <div className="relative">
                <Compass className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="number"
                  step="any"
                  value={formData.latitude}
                  onChange={(e) =>
                    setFormData({ ...formData, latitude: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full rounded-xl border border-input bg-background/50 pl-10 pr-4 py-2.5 text-sm outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-foreground">
                Longitude Coordinates
              </label>
              <div className="relative">
                <Compass className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="number"
                  step="any"
                  value={formData.longitude}
                  onChange={(e) =>
                    setFormData({ ...formData, longitude: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full rounded-xl border border-input bg-background/50 pl-10 pr-4 py-2.5 text-sm outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
          </div>

          {/* Operating Hours */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-foreground">
                Daily Opening Time
              </label>
              <div className="relative">
                <Clock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="time"
                  value={formData.openingTime}
                  onChange={(e) => setFormData({ ...formData, openingTime: e.target.value })}
                  className="w-full rounded-xl border border-input bg-background/50 pl-10 pr-4 py-2.5 text-sm outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-foreground">
                Daily Closing Time
              </label>
              <div className="relative">
                <Clock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="time"
                  value={formData.closingTime}
                  onChange={(e) => setFormData({ ...formData, closingTime: e.target.value })}
                  className="w-full rounded-xl border border-input bg-background/50 pl-10 pr-4 py-2.5 text-sm outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
          </div>

          {/* Shop Image */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-foreground">
              Local Image Asset Path
            </label>
            <div className="relative">
              <ImageIcon className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={formData.image}
                onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                placeholder="e.g. /assets/categories/grocery.webp"
                className="w-full rounded-xl border border-input bg-background/50 pl-10 pr-4 py-2.5 text-sm outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>
            <p className="mt-1 text-[0.7rem] text-muted-foreground">
              Referenced as a local asset or URL without cloud binary storage.
            </p>
          </div>

          <div className="pt-3">
            <button
              type="submit"
              disabled={saving}
              className="press flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-xs font-semibold text-primary-foreground shadow-md transition-all hover:bg-primary/90 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {saving ? "Saving Changes..." : "Save Shop Profile"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
