import assert from "node:assert/strict";
import test from "node:test";
import {
  IMAGE_SIZE_ERROR_MESSAGE,
  IMAGE_TYPE_ERROR_MESSAGE,
  MAX_IMAGE_BYTES,
  defaultCatalogImageFor,
  resolveProductImage,
  validateImageFile,
} from "../src/lib/productImage.ts";

test("accepts JPG, PNG, and WebP images up to 5 MB", () => {
  for (const type of ["image/jpeg", "image/png", "image/webp"]) {
    assert.deepEqual(validateImageFile(new File([new Uint8Array(10)], "item", { type })), {
      ok: true,
    });
    assert.deepEqual(
      validateImageFile(new File([new Uint8Array(MAX_IMAGE_BYTES)], "item", { type })),
      { ok: true },
    );
  }
});

test("rejects SVG, GIF, PDF, and other non-approved MIME types", () => {
  for (const type of ["image/svg+xml", "image/gif", "application/pdf", "video/mp4"]) {
    assert.deepEqual(validateImageFile(new File(["data"], "item", { type })), {
      ok: false,
      error: IMAGE_TYPE_ERROR_MESSAGE,
    });
  }
});

test("rejects files larger than 5 MB with a size-specific error", () => {
  const file = new File([new Uint8Array(MAX_IMAGE_BYTES + 1)], "large.webp", {
    type: "image/webp",
  });
  assert.deepEqual(validateImageFile(file), {
    ok: false,
    error: IMAGE_SIZE_ERROR_MESSAGE,
  });
});

test("prefers Firebase Storage URLs and preserves catalogue and legacy images", () => {
  const storageSource = {
    type: "uploaded",
    ref: "https://firebasestorage.googleapis.com/v0/b/example/o/image?alt=media&token=test",
    storagePath: "shops/shop-a/products/product-a/image-a.webp",
  };
  assert.equal(resolveProductImage(storageSource, undefined, "legacy.jpg").src, storageSource.ref);
  assert.equal(
    resolveProductImage({ type: "catalog", ref: "/assets/rice.webp" }, undefined, "legacy.jpg").src,
    "/assets/rice.webp",
  );
  assert.equal(resolveProductImage(undefined, undefined, "legacy.jpg").src, "legacy.jpg");
});

test("uses product-specific static defaults before category and legacy fallbacks", () => {
  const catalog = [
    {
      id: "rice",
      name: "Rice",
      category: "grocery",
      ref: "/assets/grocery.webp",
      keywords: "rice basmati grain",
    },
    {
      id: "oil",
      name: "Cooking oil",
      category: "grocery",
      ref: "/assets/grocery.webp",
      keywords: "oil cooking",
    },
    {
      id: "fruits",
      name: "Fruits",
      category: "fruits-vegetables",
      ref: "/assets/fruits.webp",
      keywords: "fruit apple banana",
    },
  ];

  assert.equal(defaultCatalogImageFor("Sona Masoori Rice", "grocery", catalog)?.id, "rice");
  assert.equal(defaultCatalogImageFor("Unknown staple", "grocery", catalog)?.id, "rice");
  assert.equal(
    defaultCatalogImageFor("Unknown produce", "fruits-vegetables", catalog)?.id,
    "fruits",
  );
  assert.equal(defaultCatalogImageFor("Unknown item", "other", catalog), undefined);
  assert.equal(
    resolveProductImage(undefined, undefined, "legacy.jpg", "/assets/grocery.webp").src,
    "/assets/grocery.webp",
  );
  assert.equal(
    resolveProductImage(
      { type: "catalog", ref: "/assets/chosen.webp" },
      undefined,
      "legacy.jpg",
      "/assets/grocery.webp",
    ).src,
    "/assets/chosen.webp",
  );
});
