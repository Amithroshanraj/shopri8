import { CategoryIcon } from "./CategoryIcon";
import type { CategoryId } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Image surface for shops and products.
 *
 * Shows the local asset / external URL stored in Firestore when present,
 * otherwise a branded gradient tile. No Firebase Storage is used.
 */
export function MediaTile({
  src,
  alt,
  category,
  className,
  iconClassName,
}: {
  src?: string | undefined;
  alt: string;
  category: CategoryId;
  className?: string;
  iconClassName?: string;
}) {
  return (
    <div
      className={cn(
        "relative flex items-center justify-center overflow-hidden rounded-2xl surface-gradient border border-border",
        className,
      )}
    >
      {src ? (
        <img src={src} alt={alt} loading="lazy" className="h-full w-full object-cover" />
      ) : (
        <CategoryIcon id={category} className={cn("h-8 w-8 text-soft-violet", iconClassName)} />
      )}
    </div>
  );
}
