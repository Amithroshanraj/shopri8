import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  CheckCircle2,
  Edit2,
  Minus,
  Package,
  Plus,
  RefreshCw,
  Search,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useRetailerStore } from "@/lib/retailerStore";
import { CATEGORY_BY_ID } from "@/data/demo";
import { formatPrice } from "@/lib/geo";
import type { Product } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/retailer/inventory")({
  head: () => ({
    meta: [
      { title: "Inventory Tracker — SHOPRi8 Retailer" },
      { name: "description", content: "Track stock quantities, availability, and low stock items" },
    ],
  }),
  component: RetailerInventory,
});

type InventoryFilter = "all" | "low" | "out" | "in";

function RetailerInventory() {
  const { products, loading, updateStock, toggleAvailability } = useRetailerStore();
  const [filter, setFilter] = useState<InventoryFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  // Track local edits per product before commit if desired or instant update
  const [stockInputs, setStockInputs] = useState<Record<string, number>>({});

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto" />
          <p className="mt-3 text-sm text-muted-foreground">Loading inventory...</p>
        </div>
      </div>
    );
  }

  const inStockList = products.filter((p) => p.stock > 0 && p.availability);
  const lowStockList = products.filter((p) => p.stock > 0 && p.stock <= 5);
  const outOfStockList = products.filter((p) => p.stock === 0 || !p.availability);

  // Apply filters
  const filteredProducts = products.filter((p) => {
    if (filter === "low") {
      if (p.stock <= 0 || p.stock > 5) return false;
    } else if (filter === "out") {
      if (p.stock > 0 && p.availability) return false;
    } else if (filter === "in") {
      if (p.stock <= 0 || !p.availability) return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = p.name.toLowerCase().includes(q);
      const categoryName = CATEGORY_BY_ID[p.category]?.name?.toLowerCase() || "";
      if (!matchName && !categoryName.includes(q)) return false;
    }

    return true;
  });

  const handleStockChange = (productId: string, delta: number) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    const currentStock = stockInputs[productId] ?? product.stock;
    const newStock = Math.max(0, currentStock + delta);
    setStockInputs((prev) => ({ ...prev, [productId]: newStock }));
    updateStock(productId, newStock);
    toast.success(`Stock updated for ${product.name}`, {
      description: `New stock level: ${newStock} ${product.unit || "units"}`,
    });
  };

  const handleDirectStockSubmit = (product: Product, value: number) => {
    const sanitized = Math.max(0, isNaN(value) ? 0 : value);
    setStockInputs((prev) => ({ ...prev, [product.id]: sanitized }));
    updateStock(product.id, sanitized);
    toast.success(`Stock updated for ${product.name}`, {
      description: `New stock level: ${sanitized} ${product.unit || "units"}`,
    });
  };

  const handleToggleAvailability = (product: Product) => {
    toggleAvailability(product.id, product.availability);
    toast.success(!product.availability ? "Marked Available" : "Marked Unavailable", {
      description: `${product.name} is now ${!product.availability ? "active" : "hidden"}.`,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
            Inventory & Stock
          </h1>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            Monitor real-time stock levels, update units, and prevent customer stockouts
          </p>
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="grid gap-3 sm:grid-cols-3">
        <button
          type="button"
          onClick={() => setFilter("in")}
          className={cn(
            "press flex items-center gap-3.5 rounded-2xl border p-4 text-left backdrop-blur-sm transition-all",
            filter === "in"
              ? "border-success bg-success/15 shadow-sm"
              : "border-border/60 bg-card/40 hover:bg-card/70",
          )}
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-success/20 text-success">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[0.7rem] font-semibold text-muted-foreground uppercase tracking-wider">
              In Stock
            </span>
            <p className="text-xl font-bold text-foreground">{inStockList.length}</p>
            <p className="text-[0.65rem] text-muted-foreground">Available to buy</p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setFilter("low")}
          className={cn(
            "press flex items-center gap-3.5 rounded-2xl border p-4 text-left backdrop-blur-sm transition-all",
            filter === "low"
              ? "border-warning bg-warning/15 shadow-sm"
              : "border-border/60 bg-card/40 hover:bg-card/70",
          )}
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-warning/20 text-warning">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[0.7rem] font-semibold text-muted-foreground uppercase tracking-wider">
              Low Stock (≤ 5)
            </span>
            <p className="text-xl font-bold text-warning">{lowStockList.length}</p>
            <p className="text-[0.65rem] text-muted-foreground">Needs replenishment</p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setFilter("out")}
          className={cn(
            "press flex items-center gap-3.5 rounded-2xl border p-4 text-left backdrop-blur-sm transition-all",
            filter === "out"
              ? "border-destructive bg-destructive/15 shadow-sm"
              : "border-border/60 bg-card/40 hover:bg-card/70",
          )}
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-destructive/20 text-destructive">
            <XCircle className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[0.7rem] font-semibold text-muted-foreground uppercase tracking-wider">
              Out of Stock / Disabled
            </span>
            <p className="text-xl font-bold text-destructive">{outOfStockList.length}</p>
            <p className="text-[0.65rem] text-muted-foreground">0 units or deactivated</p>
          </div>
        </button>
      </div>

      {/* Filter and Search Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setFilter("all")}
            className={cn(
              "press rounded-full px-4 py-1.5 text-xs font-semibold whitespace-nowrap transition-all",
              filter === "all"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "border border-border/70 bg-card/40 text-muted-foreground hover:text-foreground",
            )}
          >
            All Products ({products.length})
          </button>
          <button
            onClick={() => setFilter("low")}
            className={cn(
              "press rounded-full px-4 py-1.5 text-xs font-semibold whitespace-nowrap transition-all",
              filter === "low"
                ? "bg-warning text-warning-foreground shadow-sm"
                : "border border-border/70 bg-card/40 text-muted-foreground hover:text-foreground",
            )}
          >
            Low Stock ({lowStockList.length})
          </button>
          <button
            onClick={() => setFilter("out")}
            className={cn(
              "press rounded-full px-4 py-1.5 text-xs font-semibold whitespace-nowrap transition-all",
              filter === "out"
                ? "bg-destructive text-destructive-foreground shadow-sm"
                : "border border-border/70 bg-card/40 text-muted-foreground hover:text-foreground",
            )}
          >
            Out of Stock ({outOfStockList.length})
          </button>
          <button
            onClick={() => setFilter("in")}
            className={cn(
              "press rounded-full px-4 py-1.5 text-xs font-semibold whitespace-nowrap transition-all",
              filter === "in"
                ? "bg-success text-success-foreground shadow-sm"
                : "border border-border/70 bg-card/40 text-muted-foreground hover:text-foreground",
            )}
          >
            In Stock ({inStockList.length})
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search inventory..."
            className="w-full rounded-xl border border-border/80 bg-card/40 pl-9 pr-3 py-1.5 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary backdrop-blur-sm"
          />
        </div>
      </div>

      {/* Inventory Table / Cards */}
      {filteredProducts.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-card/20 p-12 text-center">
          <Package className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-base font-semibold text-foreground">No inventory items match</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Try adjusting your search query or switching to "All Products".
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredProducts.map((product) => {
            const categoryMeta = CATEGORY_BY_ID[product.category];
            const isOutOfStock = product.stock <= 0;
            const isLowStock = product.stock > 0 && product.stock <= 5;
            const currentStock = stockInputs[product.id] ?? product.stock;

            return (
              <div
                key={product.id}
                className={cn(
                  "flex flex-col gap-3 rounded-2xl border border-border/70 bg-card/40 p-4 transition-all hover:bg-card/70 hover:border-border sm:flex-row sm:items-center sm:justify-between backdrop-blur-sm",
                  isOutOfStock && "border-destructive/30 bg-destructive/5",
                  isLowStock && "border-warning/30 bg-warning/5",
                )}
              >
                {/* Product Info */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-sm">
                    📦
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm text-foreground truncate">
                        {product.name}
                      </p>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[0.65rem] font-semibold",
                          isOutOfStock
                            ? "bg-destructive/20 text-destructive"
                            : isLowStock
                              ? "bg-warning/20 text-warning"
                              : "bg-success/20 text-success",
                        )}
                      >
                        {isOutOfStock ? "Out of Stock" : isLowStock ? "Low Stock" : "In Stock"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {categoryMeta?.name || product.category} · {formatPrice(product.price)}
                      {product.unit ? ` / ${product.unit}` : ""}
                    </p>
                  </div>
                </div>

                {/* Stock Controls & Actions */}
                <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t border-border/40 sm:border-0">
                  {/* Availability Toggle */}
                  <button
                    type="button"
                    onClick={() => handleToggleAvailability(product)}
                    className={cn(
                      "press rounded-lg px-2.5 py-1 text-[0.7rem] font-semibold transition-all",
                      product.availability
                        ? "bg-success/15 text-success hover:bg-success/25"
                        : "bg-muted text-muted-foreground hover:bg-muted/80",
                    )}
                    title="Toggle customer visibility"
                  >
                    {product.availability ? "Active" : "Disabled"}
                  </button>

                  {/* Stock Stepper */}
                  <div className="flex items-center gap-1.5 rounded-xl border border-border/80 bg-background/60 p-1">
                    <button
                      type="button"
                      onClick={() => handleStockChange(product.id, -1)}
                      disabled={currentStock <= 0}
                      className="press rounded-lg p-1 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30"
                      aria-label="Decrease stock"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>

                    <input
                      type="number"
                      min="0"
                      value={currentStock}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        const cleanVal = isNaN(val) ? 0 : Math.max(0, val);
                        setStockInputs((prev) => ({ ...prev, [product.id]: cleanVal }));
                      }}
                      onBlur={(e) => {
                        const val = parseInt(e.target.value, 10);
                        handleDirectStockSubmit(product, val);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          const val = parseInt((e.target as HTMLInputElement).value, 10);
                          handleDirectStockSubmit(product, val);
                        }
                      }}
                      className="w-14 bg-transparent text-center text-xs font-bold text-foreground outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />

                    <button
                      type="button"
                      onClick={() => handleStockChange(product.id, 1)}
                      className="press rounded-lg p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                      aria-label="Increase stock"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Edit Full Product Link */}
                  <Link
                    to="/retailer/products/$productId/edit"
                    params={{ productId: product.id }}
                    className="press rounded-xl border border-border/80 bg-card p-2 text-muted-foreground hover:text-soft-violet hover:border-soft-violet/50 transition-colors"
                    title="Edit product details"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
