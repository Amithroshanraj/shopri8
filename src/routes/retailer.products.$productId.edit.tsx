import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Box, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useRetailerStore } from "@/lib/retailerStore";
import { CATEGORIES } from "@/data/demo";
import { useCategories } from "@/hooks/useCatalog";
import { firebaseIsActive } from "@/lib/auth";
import type { ProductImageSource } from "@/lib/productImage";
import type { CategoryId } from "@/lib/types";
import { ProductImagePicker } from "@/components/product/ProductImagePicker";
import { usePickerPreviewSrc, useProductImage } from "@/components/product/useProductImage";

export const Route = createFileRoute("/retailer/products/$productId/edit")({
  head: () => ({
    meta: [
      { title: "Edit Product — SHOPRi8 Retailer" },
      { name: "description", content: "Edit product details and inventory specifications" },
    ],
  }),
  component: EditProduct,
});

function EditProduct() {
  const navigate = useNavigate();
  const { productId } = Route.useParams();
  const { products, updateProduct, deleteProduct, loading: storeLoading } = useRetailerStore();
  const categoriesQuery = useCategories();
  const categories = firebaseIsActive() ? (categoriesQuery.data ?? []) : CATEGORIES;
  const [loading, setLoading] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [removeLegacyImage, setRemoveLegacyImage] = useState(false);

  const product = products.find((p) => p.id === productId);

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
  const currentImage = useProductImage(product ?? {});
  const pickerPreviewSrc = usePickerPreviewSrc(imageSource, currentImage.src);

  // Sync form when product is found/loaded
  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name,
        description: product.description || "",
        category: product.category,
        price: product.price.toString(),
        stock: product.stock.toString(),
        unit: product.unit || "",
        availability: product.availability,
      });
      // Seed from the stored source. A product with only a legacy `image` keeps
      // rendering it through the legacy channel until a new image is chosen.
      setImageSource(product.imageSource ?? null);
      setImageFile(null);
      setRemoveLegacyImage(false);
    }
  }, [product]);

  if (storeLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto" />
          <p className="mt-3 text-sm text-muted-foreground">Loading product details...</p>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="rounded-3xl border border-dashed border-border bg-card/20 p-12 text-center max-w-lg mx-auto">
        <Box className="mx-auto h-12 w-12 text-muted-foreground" />
        <h2 className="mt-4 text-base font-semibold text-foreground">Product Not Found</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          The requested product ID "{productId}" could not be located in your catalogue.
        </p>
        <Link
          to="/retailer/products"
          className="press mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Return to Products Catalogue
        </Link>
      </div>
    );
  }

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
      const result = await updateProduct(
        product.id,
        {
          name: formData.name.trim(),
          description: formData.description.trim(),
          category: formData.category,
          price,
          stock,
          unit: formData.unit.trim() || undefined,
          // Changing the image never touches id, stock, availability or shop.
          imageSource: imageSource ?? null,
          image: removeLegacyImage ? null : undefined,
          availability: formData.availability && stock > 0,
        },
        imageFile ?? undefined,
        setUploadProgress,
      );

      toast.success("Product Updated", {
        description:
          result?.imageCleanupWarning ?? `Changes to "${formData.name.trim()}" have been saved.`,
      });
      navigate({ to: "/retailer/products" });
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Failed to update product");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (confirm(`Are you sure you want to delete "${product.name}"?`)) {
      try {
        const result = await deleteProduct(product.id);
        toast.success("Product Deleted", {
          description: result?.imageCleanupWarning,
        });
        navigate({ to: "/retailer/products" });
      } catch (cause) {
        toast.error(cause instanceof Error ? cause.message : "Could not delete product.");
      }
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
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
              Edit Product
            </h1>
            <p className="text-xs text-muted-foreground sm:text-sm">
              Update information for "{product.name}"
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleDelete}
          className="press flex items-center gap-1.5 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive hover:bg-destructive/20"
        >
          <Trash2 className="h-4 w-4" /> Delete
        </button>
      </div>

      {/* Edit Form Card */}
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
              className="w-full rounded-xl border border-input bg-background/50 px-4 py-2.5 text-sm outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
              required
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-foreground">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
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
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id} className="bg-background text-foreground">
                    {cat.name}
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
                Unit / Measurement
              </label>
              <input
                type="text"
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                placeholder="e.g. 1 kg, 500 g, 1 L, 1 piece"
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
            productName={formData.name || product.name}
            onChange={(source) => {
              setImageSource(source);
              setRemoveLegacyImage(false);
            }}
            selectedFile={imageFile}
            onSelectedFileChange={(file) => {
              setImageFile(file);
              setUploadProgress(null);
              if (file) setRemoveLegacyImage(false);
            }}
            onRemoveImage={() => setRemoveLegacyImage(true)}
            uploadProgress={imageFile ? uploadProgress : undefined}
            disabled={loading}
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
                  Toggle off to temporarily hide this product from customers without deleting it.
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
              {loading ? "Saving Changes..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
