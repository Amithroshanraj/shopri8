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
 * Resolves a product image in priority order: retailer upload, then catalogue,
 * then the pre-existing `image` field, then no image (renderers show the
 * SHOPRi8 placeholder). Products saved before this model keep working because
 * `image` is still honoured last.
 */
export function resolveProductImage(
  imageSource: ProductImageSource | null | undefined,
  uploadedSrc: string | undefined,
  legacyImage: string | null | undefined,
): ResolvedProductImage {
  if (imageSource?.type === "uploaded") {
    return {
      src: /^https:\/\//i.test(imageSource.ref) ? imageSource.ref : uploadedSrc,
      origin: "retailer-upload",
      label: "Retailer Upload",
    };
  }
  if (imageSource?.type === "catalog" && imageSource.ref) {
    return {
      src: imageSource.ref,
      origin: "catalog",
      label: "SHOPRi8 Catalogue",
    };
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
  catalog: readonly { id: string; ref: string }[],
) {
  return catalog.find((entry) => entry.id === `cat-${category}`);
}
