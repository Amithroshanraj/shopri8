import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Box } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useRetailerStore } from "@/lib/retailerStore";
import { CATEGORIES } from "@/data/demo";
import type { ProductImageSource } from "@/lib/productImage";
import type { CategoryId } from "@/lib/types";
import { ProductImagePicker } from "@/components/product/ProductImagePicker";
import { usePickerPreviewSrc } from "@/components/product/useProductImage";

export const Route = createFileRoute("/retailer/products/new")({
  head: () => ({
    meta: [
      { title: "Add Product — SHOPRi8 Retailer" },
      { name: "description", content: "Add a new product to your shop catalogue" },
    ],
  }),
  component: AddProduct,
});

function AddProduct() {
  const navigate = useNavigate();
  const { addProduct } = useRetailerStore();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    category: "grocery" as CategoryId,
    price: "",
    stock: "",
    unit: "",
    availability: true,
  });
  const [imageSource, setImageSource] = useState<ProductImageSource | null>(null);
  const pickerPreviewSrc = usePickerPreviewSrc(imageSource);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const price = parseFloat(formData.price);
    const stock = parseInt(formData.stock, 10);

    if (!formData.name.trim()) {
      toast.error("Product name is required");
      return;
    }

    if (isNaN(price) || price < 0) {
      toast.error("Please enter a valid price (₹0 or greater)");
      return;
    }

    if (isNaN(stock) || stock < 0) {
      toast.error("Please enter a valid stock quantity (0 or greater)");
      return;
    }

    setLoading(true);

    try {
      addProduct({
        name: formData.name.trim(),
        description: formData.description.trim(),
        category: formData.category,
        price,
        stock,
        unit: formData.unit.trim() || undefined,
        // A catalogue image is referenced by id; an upload carries its own ref.
        imageSource: imageSource ?? undefined,
        availability: formData.availability && stock > 0,
      });

      toast.success("Product Added", {
        description: `"${formData.name.trim()}" has been listed in your catalogue.`,
      });
      navigate({ to: "/retailer/products" });
    } catch {
      toast.error("Failed to add product");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-12">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          to="/retailer/products"
          className="press rounded-xl border border-border/80 bg-card/60 p-2.5 text-foreground hover:bg-card"
          aria-label="Back to products"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="font-display text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            Add New Product
          </h1>
          <p className="text-xs text-muted-foreground sm:text-sm">
            List a new product in your shop's inventory
          </p>
        </div>
      </div>

      {/* Form Card */}
      <div className="rounded-3xl border border-border/80 bg-card/50 p-6 backdrop-blur-sm shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-foreground">
              Product Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Sona Masoori Rice, Fresh Tomatoes, Whole Milk"
              className="w-full rounded-xl border border-input bg-background/50 px-4 py-2.5 text-sm outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
              required
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-foreground">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Short description, specifications, or packaging details..."
              rows={3}
              className="w-full rounded-xl border border-input bg-background/50 px-4 py-2.5 text-sm outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary resize-none"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-foreground">Category *</label>
              <select
                value={formData.category}
                onChange={(e) =>
                  setFormData({ ...formData, category: e.target.value as CategoryId })
                }
                className="w-full rounded-xl border border-input bg-background/50 px-4 py-2.5 text-sm outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
                required
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat.id} value={cat.id} className="bg-background text-foreground">
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-foreground">
                Unit / Measurement
              </label>
              <input
                type="text"
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                placeholder="e.g. 1 kg, 500 g, 1 L, 1 piece, 1 dozen"
                className="w-full rounded-xl border border-input bg-background/50 px-4 py-2.5 text-sm outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-foreground">
                Price (₹) *
              </label>
              <input
                type="number"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                placeholder="0.00"
                step="0.01"
                min="0"
                className="w-full rounded-xl border border-input bg-background/50 px-4 py-2.5 text-sm outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
                required
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-foreground">
                Stock Quantity *
              </label>
              <input
                type="number"
                value={formData.stock}
                onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                placeholder="0"
                min="0"
                className="w-full rounded-xl border border-input bg-background/50 px-4 py-2.5 text-sm outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
                required
              />
            </div>
          </div>

          <ProductImagePicker
            imageSource={imageSource ?? undefined}
            previewSrc={pickerPreviewSrc}
            category={formData.category}
            productName={formData.name || "Product"}
            onChange={setImageSource}
          />

          <div className="rounded-2xl border border-border/70 bg-card/60 p-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.availability}
                onChange={(e) => setFormData({ ...formData, availability: e.target.checked })}
                className="h-4 w-4 rounded border-input bg-background text-primary focus:ring-1 focus:ring-primary"
              />
              <div>
                <span className="text-xs font-semibold text-foreground">
                  Available for customers
                </span>
                <p className="text-[0.7rem] text-muted-foreground">
                  When enabled, this product will be visible to nearby customers in SHOPRi8.
                </p>
              </div>
            </label>
          </div>

          <div className="flex gap-3 pt-3">
            <Link
              to="/retailer/products"
              className="press flex-1 rounded-2xl border border-border bg-card/60 py-3 text-center text-xs font-medium text-foreground hover:bg-accent"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="press flex-1 rounded-2xl bg-primary py-3 text-xs font-semibold text-primary-foreground shadow-md transition-all hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? "Adding Product..." : "Save & Add Product"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
