import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertCircle, Box, Check, Edit2, Package, Plus, Search, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useRetailerStore } from "@/lib/retailerStore";
import { CATEGORIES, CATEGORY_BY_ID } from "@/data/demo";
import { formatPrice } from "@/lib/geo";
import type { CategoryId, Product } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/retailer/products/")({
  head: () => ({
    meta: [
      { title: "Products — SHOPRi8 Retailer" },
      { name: "description", content: "Manage shop inventory and catalogue products" },
    ],
  }),
  component: RetailerProducts,
});

function RetailerProducts() {
  const { products, loading, deleteProduct, toggleAvailability } = useRetailerStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<CategoryId | "all">("all");
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto" />
          <p className="mt-3 text-sm text-muted-foreground">Loading products...</p>
        </div>
      </div>
    );
  }

  // Filter products
  const filteredProducts = products.filter((p) => {
    if (selectedCategory !== "all" && p.category !== selectedCategory) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = p.name.toLowerCase().includes(q);
      const matchDesc = p.description?.toLowerCase().includes(q);
      if (!matchName && !matchDesc) return false;
    }
    return true;
  });

  const handleDeleteConfirm = () => {
    if (!productToDelete) return;
    deleteProduct(productToDelete.id);
    toast.success("Product deleted", {
      description: `"${productToDelete.name}" has been removed from catalogue.`,
    });
    setProductToDelete(null);
  };

  const handleToggle = (product: Product) => {
    toggleAvailability(product.id, product.availability);
    toast.success(!product.availability ? "Product made Available" : "Product marked Unavailable", {
      description: !product.availability
        ? `Customers can now order ${product.name}.`
        : `${product.name} is hidden from customer catalogue.`,
    });
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
            Product Catalogue
          </h1>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            Manage product pricing, stock availability, and shop listings
          </p>
        </div>

        <Link
          to="/retailer/products/new"
          className="press inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground shadow-md transition-all hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> Add Product
        </Link>
      </div>

      {/* Search and Category Filter Controls */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search products by title or description..."
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

        {/* Category Pills */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setSelectedCategory("all")}
            className={cn(
              "press shrink-0 rounded-full px-4 py-1.5 text-xs font-medium transition-all",
              selectedCategory === "all"
                ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                : "bg-card/50 text-muted-foreground border border-border/60 hover:text-foreground",
            )}
          >
            All Categories ({products.length})
          </button>
          {CATEGORIES.map((cat) => {
            const count = products.filter((p) => p.category === cat.id).length;
            if (count === 0 && selectedCategory !== cat.id) return null;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={cn(
                  "press shrink-0 rounded-full px-4 py-1.5 text-xs font-medium transition-all",
                  selectedCategory === cat.id
                    ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                    : "bg-card/50 text-muted-foreground border border-border/60 hover:text-foreground",
                )}
              >
                {cat.name} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Product List Grid */}
      {filteredProducts.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-card/20 p-12 text-center">
          <Box className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-base font-semibold text-foreground">No products found</h3>
          <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
            {searchQuery || selectedCategory !== "all"
              ? "No products match your search or filter. Try clearing filters."
              : "You haven't added any products to your shop yet. Click 'Add Product' to get started."}
          </p>
          <div className="mt-5">
            <Link
              to="/retailer/products/new"
              className="press inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
            >
              <Plus className="h-4 w-4" /> Add Your First Product
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredProducts.map((product) => {
            const categoryMeta = CATEGORY_BY_ID[product.category];
            const isOutOfStock = product.stock <= 0;
            const isLowStock = product.stock > 0 && product.stock <= 5;

            return (
              <div
                key={product.id}
                className={cn(
                  "flex flex-col justify-between rounded-2xl border border-border/70 bg-card/50 p-4 transition-all hover:border-border hover:bg-card/80 backdrop-blur-sm",
                  !product.availability && "opacity-75 bg-card/20",
                )}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-soft-violet font-semibold text-xs">
                        📦
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-sm font-semibold text-foreground">
                          {product.name}
                        </h3>
                        <p className="text-[0.7rem] text-muted-foreground truncate">
                          {categoryMeta?.name || product.category}
                        </p>
                      </div>
                    </div>

                    {/* Availability Switch */}
                    <button
                      type="button"
                      onClick={() => handleToggle(product)}
                      className={cn(
                        "press shrink-0 rounded-full px-2.5 py-1 text-[0.65rem] font-semibold transition-all",
                        product.availability
                          ? "bg-success/20 text-success"
                          : "bg-muted text-muted-foreground",
                      )}
                      title={product.availability ? "Currently Active" : "Currently Inactive"}
                    >
                      {product.availability ? "Available" : "Disabled"}
                    </button>
                  </div>

                  {product.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                      {product.description}
                    </p>
                  )}

                  <div className="mt-3 flex items-baseline justify-between border-t border-border/40 pt-2.5 text-xs">
                    <div>
                      <span className="text-base font-bold text-foreground">
                        {formatPrice(product.price)}
                      </span>
                      {product.unit && (
                        <span className="text-muted-foreground text-[0.7rem] ml-1">
                          / {product.unit}
                        </span>
                      )}
                    </div>

                    <span
                      className={cn(
                        "rounded px-2 py-0.5 text-[0.7rem] font-semibold",
                        isOutOfStock
                          ? "bg-destructive/15 text-destructive"
                          : isLowStock
                            ? "bg-warning/15 text-warning"
                            : "bg-success/10 text-success",
                      )}
                    >
                      {isOutOfStock ? "Out of Stock" : `${product.stock} in stock`}
                    </span>
                  </div>
                </div>

                {/* Card Action Footer */}
                <div className="mt-4 flex items-center gap-2 border-t border-border/50 pt-3">
                  <Link
                    to="/retailer/products/$productId/edit"
                    params={{ productId: product.id }}
                    className="press flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border/70 bg-card py-2 text-xs font-semibold text-foreground hover:bg-accent"
                  >
                    <Edit2 className="h-3.5 w-3.5 text-soft-violet" /> Edit
                  </Link>

                  <button
                    type="button"
                    onClick={() => setProductToDelete(product)}
                    className="press rounded-xl border border-border/70 bg-card p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors"
                    aria-label="Delete product"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {productToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <h3 className="font-semibold text-base">Delete Product?</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              Are you sure you want to delete{" "}
              <span className="font-semibold text-foreground">"{productToDelete.name}"</span>? This
              action will remove the item from your catalogue.
            </p>
            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setProductToDelete(null)}
                className="press flex-1 rounded-xl border border-border bg-card py-2.5 text-xs font-medium text-foreground hover:bg-accent"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                className="press flex-1 rounded-xl bg-destructive py-2.5 text-xs font-semibold text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
