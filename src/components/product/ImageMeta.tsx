import { useProductImage } from "./useProductImage";
import type { Product } from "@/lib/types";

/**
 * Subtle image-ownership metadata for the retailer catalogue: whether the image
 * is a shared SHOPRi8 catalogue image or this retailer's own upload. Hidden when
 * the product has no image at all.
 */
export function ImageMeta({ product }: { product: Product }) {
  const resolved = useProductImage(product);
  if (!resolved.src) return null;

  return (
    <p className="mt-1.5 text-[0.65rem] text-muted-foreground/80">
      Image: <span className="text-muted-foreground">{resolved.label}</span>
    </p>
  );
}
