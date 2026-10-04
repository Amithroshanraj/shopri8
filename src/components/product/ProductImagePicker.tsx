import { useEffect, useRef, useState } from "react";
import { ImagePlus, Images, Search, Trash2, Upload } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CategoryIcon } from "@/components/common/CategoryIcon";
import { CATALOG_IMAGE_BY_ID, searchCatalogImages } from "@/data/productImages";
import {
  ACCEPTED_IMAGE_TYPES,
  IMAGE_ERROR_MESSAGE,
  IMAGE_INPUT_ACCEPT,
  type ProductImageSource,
} from "@/lib/productImage";
import { deleteUploadedImage, saveUploadedImage } from "@/lib/productImageBlob";
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
 * Product image selection for Add and Edit Product.
 *
 * Two sources only: a shared SHOPRi8 catalogue image, or an image uploaded from
 * the retailer’s own device. There is no field for typing an asset path.
 */
export function ProductImagePicker({
  imageSource,
  previewSrc,
  category,
  productName,
  onChange,
}: {
  imageSource?: ProductImageSource | undefined;
  /** Already-resolved src (an upload may still be hydrating). */
  previewSrc?: string | undefined;
  category: CategoryId;
  productName: string;
  onChange: (next: ProductImageSource | null) => void;
}) {
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isUpload = imageSource?.type === "uploaded";
  const catalogEntry =
    imageSource?.type === "catalog" ? CATALOG_IMAGE_BY_ID[imageSource.ref] : undefined;
  const displaySrc = previewSrc ?? (imageSource?.type === "catalog" ? imageSource.ref : undefined);
  const displayName = isUpload ? "Your upload" : catalogEntry?.name;
  const results = searchCatalogImages(query);

  useEffect(() => {
    if (!libraryOpen) return;
    setPendingId(imageSource?.type === "catalog" ? imageSource.ref : null);
  }, [imageSource, libraryOpen]);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type as (typeof ACCEPTED_IMAGE_TYPES)[number])) {
      setError(IMAGE_ERROR_MESSAGE);
      return;
    }
    setUploading(true);
    try {
      const ref = await saveUploadedImage(file);
      const previous = imageSource?.type === "uploaded" ? imageSource.ref : undefined;
      onChange({ type: "uploaded", ref, name: file.name });
      if (previous && previous !== ref) void deleteUploadedImage(previous);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : IMAGE_ERROR_MESSAGE);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemove = () => {
    const previous = imageSource?.type === "uploaded" ? imageSource.ref : undefined;
    onChange(null);
    if (previous) void deleteUploadedImage(previous);
  };

  const confirmCatalogChoice = () => {
    if (!pendingId) return;
    const entry = CATALOG_IMAGE_BY_ID[pendingId];
    if (!entry) return;
    const previous = imageSource?.type === "uploaded" ? imageSource.ref : undefined;
    onChange({ type: "catalog", ref: entry.id, name: entry.name });
    if (previous) void deleteUploadedImage(previous);
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
        <div className="mt-2.5 flex gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="press flex-1 rounded-xl border border-border bg-card/60 py-2.5 text-xs font-semibold text-foreground transition-colors hover:bg-accent disabled:opacity-50"
          >
            {uploading ? "Processing..." : "Replace Image"}
          </button>
          <button
            type="button"
            onClick={handleRemove}
            disabled={uploading}
            className="press flex items-center justify-center gap-1.5 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-xs font-semibold text-destructive transition-colors hover:bg-destructive/20 disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" /> Remove
          </button>
        </div>
      ) : null}

      <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setLibraryOpen(true)}
          className="press flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground shadow-md transition-colors hover:bg-primary/90"
        >
          <Images className="h-4 w-4" /> Choose from SHOPRi8 Library
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="press flex items-center justify-center gap-2 rounded-xl border border-border bg-card/60 px-4 py-2.5 text-xs font-semibold text-foreground transition-colors hover:bg-accent disabled:opacity-50"
        >
          <Upload className="h-4 w-4" />
          {uploading ? "Processing..." : "Upload from Device"}
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={IMAGE_INPUT_ACCEPT}
        className="sr-only"
        aria-label="Upload product image from device"
        onChange={(event) => void handleFile(event.target.files?.[0])}
      />

      <p className="mt-2 text-[0.7rem] text-muted-foreground">
        Optional. Pick a shared SHOPRi8 image, or upload your own photo. JPG, PNG or WebP up to 5
        MB.
      </p>
      {error ? (
        <p role="alert" className="mt-1.5 text-[0.7rem] font-medium text-destructive">
          {error}
        </p>
      ) : null}

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
