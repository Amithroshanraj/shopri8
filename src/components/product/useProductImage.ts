import { useEffect, useState } from "react";
import {
  resolveProductImage,
  type ProductImageSource,
  type ResolvedProductImage,
} from "@/lib/productImage";
import {
  hydrateUploadedImage,
  subscribeToUploadedImages,
  uploadedImageSrc,
} from "@/lib/productImageBlob";
import { catalogImageSrc, defaultProductImageFor } from "@/data/productImages";
import type { CategoryId } from "@/lib/types";

/**
 * Resolves Firebase URLs directly and hydrates demo uploads from IndexedDB.
 * Products without an `imageSource` still resolve from the legacy `image` field.
 */
export function useProductImage(product: {
  name?: string | undefined;
  category?: CategoryId | undefined;
  image?: string | null | undefined;
  imageSource?: ProductImageSource | null | undefined;
}): ResolvedProductImage {
  const imageSource = product.imageSource;
  const uploadRef = imageSource?.type === "uploaded" ? imageSource.ref : undefined;
  const [uploaded, setUploaded] = useState<string | undefined>(() => uploadedImageSrc(uploadRef));

  useEffect(() => {
    if (!uploadRef) {
      setUploaded(undefined);
      return;
    }
    if (/^https:\/\//i.test(uploadRef)) {
      setUploaded(uploadRef);
      return;
    }
    let active = true;
    const cached = uploadedImageSrc(uploadRef);
    setUploaded(cached);
    if (!cached) {
      void hydrateUploadedImage(uploadRef).then((src) => {
        if (active) setUploaded(src);
      });
    }
    const unsubscribe = subscribeToUploadedImages(() => {
      if (active) setUploaded(uploadedImageSrc(uploadRef));
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [uploadRef]);

  const resolvedSource =
    imageSource?.type === "catalog"
      ? { ...imageSource, ref: catalogImageSrc(imageSource.ref) }
      : imageSource;
  const staticDefault =
    product.name && product.category
      ? defaultProductImageFor(product.name, product.category)?.ref
      : undefined;
  return resolveProductImage(resolvedSource, uploaded, product.image, staticDefault);
}

/**
 * Preview src for the image picker. Catalogue refs resolve immediately; uploads
 * resolve from the local cache and hydrate in the background. Falls back to the
 * product's current image so an untouched legacy product still previews.
 */
export function usePickerPreviewSrc(
  imageSource: ProductImageSource | null | undefined,
  fallbackSrc?: string | undefined,
  productName?: string | undefined,
  category?: CategoryId | undefined,
) {
  const uploadRef =
    imageSource?.type === "uploaded" && !/^https:\/\//i.test(imageSource.ref)
      ? imageSource.ref
      : undefined;
  const [uploaded, setUploaded] = useState<string | undefined>(() => uploadedImageSrc(uploadRef));

  useEffect(() => {
    if (!uploadRef) {
      setUploaded(undefined);
      return;
    }
    setUploaded(uploadedImageSrc(uploadRef));
    const unsubscribe = subscribeToUploadedImages(() => {
      setUploaded(uploadedImageSrc(uploadRef));
    });
    return unsubscribe;
  }, [uploadRef]);

  if (imageSource?.type === "catalog") return catalogImageSrc(imageSource.ref);
  if (imageSource?.type === "uploaded" && /^https:\/\//i.test(imageSource.ref)) {
    return imageSource.ref;
  }
  if (imageSource?.type === "uploaded") return uploaded ?? fallbackSrc;
  if (productName && category) {
    const defaultSrc = defaultProductImageFor(productName, category)?.ref;
    if (defaultSrc) return defaultSrc;
  }
  return fallbackSrc;
}
