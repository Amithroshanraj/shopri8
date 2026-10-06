import type { CategoryId } from "./types";

/**
 * Product image model.
 *
 * A product image is either a SHARED SHOPRi8 catalogue image (one asset reused
 * by any number of retailers and products) or a RETAILER-SPECIFIC upload owned
 * by a single product. The two are never copied into each other.
 *
 * Uploaded refs are local `shopri8-upload:<id>` references in demo mode and
 * Firebase download URLs plus `storagePath` in Firebase mode.
 */
export type ProductImageType = "catalog" | "uploaded";

export interface ProductImageSource {
  type: ProductImageType;
  /** Catalogue asset reference, local upload reference, or Firebase download URL. */
  ref: string;
  /** Firebase Storage path for retailer uploads; absent for catalogue/demo images. */
  storagePath?: string | undefined;
  /** Catalogue item name, shown to the retailer. */
  name?: string | undefined;
}

export type ProductImageOrigin = "retailer-upload" | "catalog" | "legacy" | "none";

export interface ResolvedProductImage {
  /** Displayable URL, or undefined when the product has no usable image. */
  src: string | undefined;
  origin: ProductImageOrigin;
  /** Subtle metadata label for the retailer UI. */
  label: string | undefined;
}

export const UPLOAD_REF_PREFIX = "shopri8-upload:";

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

/** Passed to the file input so mobile browsers offer gallery and camera. */
export const IMAGE_INPUT_ACCEPT = "image/jpeg,image/png,image/webp";

export const IMAGE_TYPE_ERROR_MESSAGE = "Only JPG, PNG, and WebP images are allowed.";
export const IMAGE_SIZE_ERROR_MESSAGE = "Image size must be 5 MB or less.";
export const IMAGE_ERROR_MESSAGE = IMAGE_TYPE_ERROR_MESSAGE;

export function uploadedImageRef(id: string) {
  return `${UPLOAD_REF_PREFIX}${id}`;
}

export function uploadedImageId(ref: string | undefined) {
  if (!ref?.startsWith(UPLOAD_REF_PREFIX)) return null;
  return ref.slice(UPLOAD_REF_PREFIX.length) || null;
}

/**
 * Resolves a product image in priority order: explicit catalogue/upload source,
 * static product/category default, then the pre-existing `image` field.
 */
export function resolveProductImage(
  imageSource: ProductImageSource | null | undefined,
  uploadedSrc: string | undefined,
  legacyImage: string | null | undefined,
  staticDefault: string | undefined = undefined,
): ResolvedProductImage {
  if (imageSource?.type === "uploaded") {
    const src = /^https:\/\//i.test(imageSource.ref) ? imageSource.ref : uploadedSrc;
    if (src) return { src, origin: "retailer-upload", label: "Retailer Upload" };
  }
  if (imageSource?.type === "catalog" && imageSource.ref) {
    return {
      src: imageSource.ref,
      origin: "catalog",
      label: "SHOPRi8 Catalogue",
    };
  }
  if (staticDefault) {
    return { src: staticDefault, origin: "catalog", label: "SHOPRi8 Default" };
  }
  if (legacyImage) {
    return { src: legacyImage, origin: "legacy", label: "Legacy image" };
  }
  return { src: undefined, origin: "none", label: undefined };
}

export type ImageValidation = { ok: true } | { ok: false; error: string };

export function validateImageFile(file: File): ImageValidation {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type as (typeof ACCEPTED_IMAGE_TYPES)[number])) {
    return { ok: false, error: IMAGE_TYPE_ERROR_MESSAGE };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return { ok: false, error: IMAGE_SIZE_ERROR_MESSAGE };
  }
  return { ok: true };
}

export function catalogImageFor(
  category: CategoryId,
  catalog: readonly { id: string; ref: string; category: CategoryId }[],
) {
  return (
    catalog.find((entry) => entry.id === `cat-${category}`) ??
    catalog.find((entry) => entry.category === category)
  );
}

export function defaultCatalogImageFor<
  T extends { id: string; ref: string; name: string; category: CategoryId; keywords?: string },
>(productName: string, category: CategoryId, catalog: readonly T[]) {
  const categoryEntries = catalog.filter((entry) => entry.category === category);
  if (categoryEntries.length === 0) return undefined;

  const normalize = (value: string) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  const name = normalize(productName);
  const productWords = new Set(name.split(/\s+/).filter((word) => word.length > 2));
  let best: T | undefined;
  let bestScore = 0;

  for (const entry of categoryEntries) {
    const entryName = normalize(entry.name);
    let score = name === entryName ? 100 : name.includes(entryName) ? 50 : 0;
    const keywords = normalize(`${entry.name} ${entry.keywords ?? ""}`)
      .split(/\s+/)
      .filter((word) => word.length > 2);
    score += keywords.reduce((total, word) => total + Number(productWords.has(word)), 0);
    if (score > bestScore) {
      best = entry;
      bestScore = score;
    }
  }

  return bestScore > 0 ? best : categoryEntries[0];
}
