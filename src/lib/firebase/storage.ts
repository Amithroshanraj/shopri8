/**
 * Cloud Storage for retailer-specific product images.
 *
 * SHOPRi8 has two kinds of product image and they are never mixed:
 *
 *   1. SHOPRi8 catalogue image — a bundled asset shared by any number of
 *      retailers and products. Stays in `src/assets/categories` and continues to
 *      be referenced by import path. It never touches Storage.
 *   2. Retailer upload — owned by one retailer for one product. Stored here.
 *
 * Storage path convention:
 *
 *   shops/{shopId}/products/{productId}/{fileName}
 *
 * The product document keeps only the download URL in `imageSource.ref` (or the
 * legacy `image` field). The existing `src/lib/productImage.ts` model already
 * distinguishes `catalog` from `uploaded`, so switching a product from a local
 * blob to Storage changes only what `ref` holds — the picker UI and every
 * display site stay as they are.
 */

import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
  type UploadResult,
} from "firebase/storage";
import { getFirebaseStorage, isBrowser } from "./config";
import {
  ACCEPTED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  type ImageValidation,
  validateImageFile,
} from "../productImage";

export { MAX_IMAGE_BYTES, ACCEPTED_IMAGE_TYPES, validateImageFile };
export type { ImageValidation };

export class FirebaseStorageUnavailableError extends Error {
  constructor() {
    super(
      "Firebase Storage is unavailable. Set the VITE_FIREBASE_* values in .env.local to enable uploads.",
    );
    this.name = "FirebaseStorageUnavailableError";
  }
}

function requireStorage() {
  const storage = getFirebaseStorage();
  if (!storage) throw new FirebaseStorageUnavailableError();
  if (!isBrowser) {
    throw new Error("Firebase Storage uploads are browser-only and cannot run during SSR.");
  }
  return storage;
}

/**
 * Storage path for a product image.
 *
 * The file name is derived from a caller-supplied id rather than the raw upload
 * name so a product always resolves to a deterministic, overwritable path.
 */
export function productImagePath(shopId: string, productId: string, fileName: string): string {
  return `shops/${shopId}/products/${productId}/${fileName}`;
}

/** Storage reference for one product image. */
export function productImageRef(shopId: string, productId: string, fileName: string) {
  return ref(requireStorage(), productImagePath(shopId, productId, fileName));
}

/**
 * Uploads a retailer product image and returns its public download URL.
 *
 * The file is validated locally first (type and 5 MB limit) so an oversized or
 * unsupported file never reaches the network. Storage rules additionally
 * restrict writes to the owning retailer.
 */
export async function uploadProductImage(
  shopId: string,
  productId: string,
  file: File,
  fileName: string,
): Promise<UploadResult & { downloadUrl: string }> {
  const validation = validateImageFile(file);
  if (!validation.ok) throw new Error(validation.error);

  const storage = requireStorage();
  const objectRef = productImageRef(shopId, productId, fileName);
  const result = await uploadBytes(objectRef, file, {
    contentType: file.type,
    // Browsers must be able to render the image from the download URL.
    cacheControl: "public,max-age=31536000,immutable",
  });
  const downloadUrl = await getDownloadURL(result.ref);
  return { ...result, downloadUrl };
}

/**
 * Replaces an existing retailer image.
 *
 * Passing `null` for `previousUrl` skips the delete, which is what a first
 * upload should do.
 */
export async function replaceProductImage(
  shopId: string,
  productId: string,
  file: File,
  fileName: string,
  previousUrl: string | null,
): Promise<{ downloadUrl: string }> {
  const uploaded = await uploadProductImage(shopId, productId, file, fileName);
  if (previousUrl) await deleteProductImage(previousUrl);
  return { downloadUrl: uploaded.downloadUrl };
}

/** Deletes a previously uploaded product image. Safe to call with `null`. */
export async function deleteProductImage(downloadUrl: string | null | undefined): Promise<void> {
  if (!downloadUrl) return;
  const storage = requireStorage();
  await deleteObject(ref(storage, downloadUrl));
}
