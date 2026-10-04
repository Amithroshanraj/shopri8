import { CategoryIcon } from "./CategoryIcon";
import { useProductImage } from "@/components/product/useProductImage";
import type { ProductImageSource } from "@/lib/productImage";
import type { CategoryId } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Image surface for shops and products.
 *
 * Resolves retailer uploads first, then the shared SHOPRi8 catalogue, then the
 * pre-existing `src` field, and finally falls back to a branded gradient tile —
 * so no image ever renders as a broken icon. Shops keep using `src` directly;
 * products may pass an `imageSource`.
 */
export function MediaTile({
  src,
  imageSource,
  alt,
  category,
  className,
  iconClassName,
}: {
  src?: string | undefined;
  imageSource?: ProductImageSource | undefined;
  alt: string;
  category: CategoryId;
  className?: string;
  iconClassName?: string;
}) {
  const resolved = useProductImage({ image: src, imageSource });

  return (
    <div
      className={cn(
        "relative flex items-center justify-center overflow-hidden rounded-2xl surface-gradient border border-border",
        className,
      )}
    >
      {resolved.src ? (
        <img src={resolved.src} alt={alt} loading="lazy" className="h-full w-full object-cover" />
      ) : (
        <CategoryIcon id={category} className={cn("h-8 w-8 text-soft-violet", iconClassName)} />
      )}
    </div>
  );
}
