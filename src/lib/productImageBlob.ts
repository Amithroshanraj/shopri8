import { uploadedImageRef } from "./productImage";

/**
 * Local storage for retailer-uploaded product images.
 *
 * Files are downscaled and kept as blobs in IndexedDB so the demo never has to
 * pretend an upload went to a server. Products only hold a small
 * `shopri8-upload:<id>` reference, which is exactly the slot a Firebase Storage
 * URL will occupy later. Object URLs are cached per tab and revoked on replace.
 */

const DB_NAME = "shopri8-product-images";
const DB_VERSION = 1;
const STORE = "images";
const MAX_EDGE = 1024;

const urlCache = new Map<string, string>();
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

export function subscribeToUploadedImages(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Synchronous best-effort read: available once the blob has been hydrated. */
export function uploadedImageSrc(ref: string | undefined) {
  return ref ? urlCache.get(ref) : undefined;
}

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === "undefined") {
      resolve(null);
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, mode);
    const request = run(tx.objectStore(STORE));
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => resolve(null);
    tx.oncomplete = () => db.close();
  });
}

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read the selected file."));
    reader.readAsDataURL(file);
  });
}

/**
 * Downscales to a sane edge length and re-encodes as WebP (JPEG fallback) so a
 * 5 MB phone photo does not become a 5 MB database row.
 */
async function toStoredBlob(file: File): Promise<Blob> {
  const dataUrl = await readAsDataUrl(file);
  const bitmap = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("That file could not be read as an image."));
    img.src = dataUrl;
  });

  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser cannot process the selected image.");
  context.drawImage(bitmap, 0, 0, width, height);

  const webp = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", 0.82),
  );
  if (webp) return webp;
  const jpeg = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.82),
  );
  if (!jpeg) throw new Error("This browser cannot process the selected image.");
  return jpeg;
}

/** Validates, stores and returns the `shopri8-upload:<id>` reference. */
export async function saveUploadedImage(file: File): Promise<string> {
  const blob = await toStoredBlob(file);
  const id = `img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const stored = await withStore("readwrite", (store) => store.put(blob, id));
  if (stored === null) {
    // put() resolves with the key; a null here means the write never landed.
    throw new Error("Image storage is unavailable in this browser.");
  }
  const ref = uploadedImageRef(id);
  urlCache.set(ref, URL.createObjectURL(blob));
  notify();
  return ref;
}

/** Loads a stored upload into the tab's object-URL cache. */
export async function hydrateUploadedImage(ref: string | undefined): Promise<string | undefined> {
  if (!ref) return undefined;
  const cached = urlCache.get(ref);
  if (cached) return cached;
  const id = ref.startsWith("shopri8-upload:") ? ref.slice("shopri8-upload:".length) : null;
  if (!id) return undefined;
  const blob = await withStore<Blob>("readonly", (store) => store.get(id));
  if (!blob) return undefined;
  const url = URL.createObjectURL(blob);
  urlCache.set(ref, url);
  notify();
  return url;
}

export async function deleteUploadedImage(ref: string | undefined) {
  if (!ref) return;
  const id = ref.startsWith("shopri8-upload:") ? ref.slice("shopri8-upload:".length) : null;
  const cached = urlCache.get(ref);
  if (cached?.startsWith("blob:")) URL.revokeObjectURL(cached);
  urlCache.delete(ref);
  if (id) await withStore("readwrite", (store) => store.delete(id));
  notify();
}
