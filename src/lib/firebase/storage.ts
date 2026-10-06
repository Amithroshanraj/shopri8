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
 *   shops/{shopId}/products/{productId}/image-{generatedId}.{extension}
 *
 * Product documents keep both the download URL and the Storage path in the
 * uploaded image source. Generated filenames keep user input out of paths and
 * allow safe replacement without overwriting the previous image prematurely.
 */

import { deleteObject, getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { getFirebaseStorage, isBrowser, isFirebaseActive } from "./config";
import {
  ACCEPTED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  type ImageValidation,
  validateImageFile,
} from "../productImage";

export { MAX_IMAGE_BYTES, ACCEPTED_IMAGE_TYPES, validateImageFile };
export type { ImageValidation };

export interface UploadedProductImage {
  downloadUrl: string;
  storagePath: string;
}

const IMAGE_EXTENSIONS: Record<(typeof ACCEPTED_IMAGE_TYPES)[number], string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export class FirebaseStorageUnavailableError extends Error {
  constructor() {
    super(
      "Firebase Storage is unavailable. Set VITE_FIREBASE_STORAGE_BUCKET in .env.local to enable uploads.",
    );
    this.name = "FirebaseStorageUnavailableError";
  }
}

function requireStorage() {
  if (!isBrowser) {
    throw new Error("Firebase Storage uploads are browser-only and cannot run during SSR.");
  }
  if (!isFirebaseActive) {
    throw new Error("Firebase Storage uploads are disabled in demo mode.");
  }
  const storage = getFirebaseStorage();
  if (!storage) throw new FirebaseStorageUnavailableError();
  return storage;
}

/**
 * Storage path for a product image. The generated file name is constrained to
 * the expected image naming convention; raw user file names are never used.
 */
function assertDocumentId(value: string, field: string): void {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(value)) {
    throw new Error(`Invalid ${field} for product image storage.`);
  }
}

export function productImagePath(shopId: string, productId: string, fileName: string): string {
  assertDocumentId(shopId, "shop");
  assertDocumentId(productId, "product");
  if (!/^image-[A-Za-z0-9_-]+\.(jpg|png|webp)$/.test(fileName)) {
    throw new Error("Invalid product image file name.");
  }
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
  onProgress?: (percent: number) => void,
): Promise<UploadedProductImage> {
  const validation = validateImageFile(file);
  if (!validation.ok) throw new Error(validation.error);

  assertDocumentId(shopId, "shop");
  assertDocumentId(productId, "product");
  const storage = requireStorage();
  const fileName = `image-${crypto.randomUUID()}.${IMAGE_EXTENSIONS[file.type as keyof typeof IMAGE_EXTENSIONS]}`;
  const objectRef = productImageRef(shopId, productId, fileName);
  const task = uploadBytesResumable(objectRef, file, {
    contentType: file.type,
    cacheControl: "public,max-age=31536000,immutable",
  });
  try {
    await new Promise<void>((resolve, reject) => {
      task.on(
        "state_changed",
        (snapshot) => {
          if (snapshot.totalBytes > 0) {
            onProgress?.(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100));
          }
        },
        reject,
        resolve,
      );
    });
    onProgress?.(100);
    return {
      downloadUrl: await getDownloadURL(task.snapshot.ref),
      storagePath: task.snapshot.ref.fullPath,
    };
  } catch (error) {
    try {
      await deleteObject(objectRef);
    } catch (cleanupError) {
      if (
        !cleanupError ||
        typeof cleanupError !== "object" ||
        !("code" in cleanupError) ||
        cleanupError.code !== "storage/object-not-found"
      ) {
        throw new Error(
          `${error instanceof Error ? error.message : "Product image upload failed."} ` +
            "The incomplete Storage upload could not be cleaned up.",
          { cause: cleanupError },
        );
      }
    }
    throw error;
  }
}

/** Deletes a Storage path only; download URLs and arbitrary paths are rejected. */
export async function deleteProductImage(storagePath: string | null | undefined): Promise<void> {
  if (!storagePath) return;
  if (
    !/^shops\/[A-Za-z0-9_-]{1,128}\/products\/[A-Za-z0-9_-]{1,128}\/image-[A-Za-z0-9_-]+\.(jpg|png|webp)$/.test(
      storagePath,
    )
  ) {
    throw new Error("Invalid product image storage path.");
  }
  const storage = requireStorage();
  try {
    await deleteObject(ref(storage, storagePath));
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "storage/object-not-found"
    ) {
      return;
    }
    throw error;
  }
}
