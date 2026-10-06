import { useEffect, useState } from "react";
import { ImagePlus, Images, RotateCcw, Search } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CategoryIcon } from "@/components/common/CategoryIcon";
import {
  CATALOG_IMAGE_BY_ID,
  defaultProductImageFor,
  searchCatalogImages,
} from "@/data/productImages";
import type { ProductImageSource } from "@/lib/productImage";
import type { CategoryId } from "@/lib/types";
import { cn } from "@/lib/utils";

function PreviewFrame({
  src,
  name,
  category,
  alt,
}: {
  src?: string | undefined;
  name?: string | undefined;
  category: CategoryId;
  alt: string;
}) {
  return (
    <div className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-2xl surface-gradient border border-border">
      {src ? (
        <img src={src} alt={alt} className="h-full w-full object-cover" />
      ) : (
        <div className="flex flex-col items-center gap-2 px-4 text-center">
          <CategoryIcon id={category} className="h-10 w-10 text-soft-violet" />
          <span className="text-[0.7rem] text-muted-foreground">No image selected</span>
        </div>
      )}
      {name ? (
        <span className="absolute bottom-2 left-2 rounded-full bg-background/80 px-2.5 py-1 text-[0.65rem] font-semibold text-foreground backdrop-blur-sm">
          {name}
        </span>
      ) : null}
    </div>
  );
}

/**
 * Product image selection for Add and Edit Product. Images come from bundled
 * SHOPRi8 static assets; no retailer upload or Firebase Storage is required.
 */
export function ProductImagePicker({
  imageSource,
  previewSrc,
  category,
  productName,
  onChange,
  onRemoveImage,
  disabled = false,
}: {
  imageSource?: ProductImageSource | null | undefined;
  /** Already-resolved src (an upload may still be hydrating). */
  previewSrc?: string | undefined;
  category: CategoryId;
  productName: string;
  onChange: (next: ProductImageSource | null) => void;
  onRemoveImage?: (() => void) | undefined;
  disabled?: boolean;
}) {
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);

  const isUpload = imageSource?.type === "uploaded";
  const catalogEntry =
    imageSource?.type === "catalog" ? CATALOG_IMAGE_BY_ID[imageSource.ref] : undefined;
  const categoryDefault = defaultProductImageFor(productName, category);
  const displaySrc = previewSrc ?? catalogEntry?.ref ?? categoryDefault?.ref;
  const displayName =
    imageSource?.name ??
    catalogEntry?.name ??
    (isUpload ? "Existing product image" : (categoryDefault?.name ?? "Default image"));
  const results = searchCatalogImages(query);

  useEffect(() => {
    if (!libraryOpen) return;
    setPendingId(imageSource?.type === "catalog" ? imageSource.ref : null);
  }, [imageSource, libraryOpen]);

  const handleRemove = () => {
    onChange(null);
    onRemoveImage?.();
  };

  const confirmCatalogChoice = () => {
    if (!pendingId) return;
    const entry = CATALOG_IMAGE_BY_ID[pendingId];
    if (!entry) return;
    onChange({ type: "catalog", ref: entry.id, name: entry.name });
    setLibraryOpen(false);
  };

  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-foreground">Product Image</p>

      <PreviewFrame
        src={displaySrc}
        name={displayName}
        category={category}
        alt={`${productName} image`}
      />

      {imageSource ? (
        <div className="mt-2.5">
          <button
            type="button"
            onClick={handleRemove}
            disabled={disabled}
            className="press flex w-full items-center justify-center gap-1.5 rounded-xl border border-border bg-card/60 px-4 py-2.5 text-xs font-semibold text-foreground transition-colors hover:bg-accent disabled:opacity-50"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Use automatic default
          </button>
        </div>
      ) : null}

      <div className="mt-2.5">
        <button
          type="button"
          onClick={() => setLibraryOpen(true)}
          disabled={disabled}
          className="press flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground shadow-md transition-colors hover:bg-primary/90"
        >
          <Images className="h-4 w-4" /> Choose from SHOPRi8 Library
        </button>
      </div>

      <p className="mt-2 text-[0.7rem] text-muted-foreground">
        A static SHOPRi8 image is selected automatically from the product name and category. You can
        choose another bundled image if needed.
      </p>

      <Dialog open={libraryOpen} onOpenChange={setLibraryOpen}>
        <DialogContent className="flex max-h-[88vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
          <DialogHeader className="border-b border-border px-5 py-4">
            <DialogTitle className="flex items-center gap-2 text-base">
              <ImagePlus className="h-4 w-4 text-soft-violet" /> Select Product Image
            </DialogTitle>
          </DialogHeader>

          <div className="border-b border-border px-5 py-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search catalogue..."
                aria-label="Search catalogue"
                className="w-full rounded-xl border border-input bg-background/50 py-2.5 pl-9 pr-4 text-sm outline-none transition-colors focus:border-primary"
              />
            </div>
          </div>

          <div className="grid flex-1 grid-cols-3 gap-2.5 overflow-y-auto px-5 py-4 sm:grid-cols-4">
            {results.length === 0 ? (
              <p className="col-span-full py-8 text-center text-xs text-muted-foreground">
                No catalogue images match “{query}”.
              </p>
            ) : (
              results.map((entry) => {
                const selected = pendingId === entry.id;
                return (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => setPendingId(entry.id)}
                    aria-pressed={selected}
                    className={cn(
                      "overflow-hidden rounded-xl border text-left transition-all",
                      selected
                        ? "border-primary ring-2 ring-primary/40"
                        : "border-border hover:border-primary/50",
                    )}
                  >
                    <img
                      src={entry.ref}
                      alt={entry.name}
                      loading="lazy"
                      className="aspect-square w-full object-cover"
                    />
                    <span className="block truncate px-2 py-1.5 text-[0.68rem] font-medium text-foreground">
                      {entry.name}
                    </span>
                  </button>
                );
              })
            )}
          </div>

          <div className="flex gap-2 border-t border-border px-5 py-4">
            <button
              type="button"
              onClick={() => setLibraryOpen(false)}
              className="press flex-1 rounded-xl border border-border bg-card/60 py-2.5 text-xs font-semibold text-foreground transition-colors hover:bg-accent"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmCatalogChoice}
              disabled={!pendingId}
              className="press flex-1 rounded-xl bg-primary py-2.5 text-xs font-semibold text-primary-foreground shadow-md transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              Use Image
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
