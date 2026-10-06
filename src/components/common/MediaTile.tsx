import { CategoryIcon } from "./CategoryIcon";
import { useProductImage } from "@/components/product/useProductImage";
import type { ProductImageSource } from "@/lib/productImage";
import type { CategoryId } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Image surface for shops and products.
 *
 * Resolves explicit catalogue/upload sources, static product/category defaults,
 * legacy image fields, and finally a branded gradient tile.
 */
export function MediaTile({
  src,
  imageSource,
  alt,
  name,
  category,
  className,
  iconClassName,
}: {
  src?: string | null | undefined;
  imageSource?: ProductImageSource | null | undefined;
  alt: string;
  name?: string | undefined;
  category: CategoryId;
  className?: string;
  iconClassName?: string;
}) {
  const resolved = useProductImage({ image: src, imageSource, name, category });

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
