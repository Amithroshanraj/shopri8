/**
 * Catalogue repository — shops, categories and products.
 *
 * These are the collections the storefront reads most heavily. Until this
 * repository is wired into the customer screens they keep using the local demo
 * catalogue in `src/data/demo.ts`; the two are deliberately side by side so the
 * catalogue can be migrated without touching the shop or product UI.
 */

import {
  fetchCategories,
  fetchProduct,
  fetchProductsByShop,
  fetchShop,
  fetchShopByOwner,
  fetchShops,
  isFirebaseActive,
  removeProduct,
  saveCategory,
  saveProduct,
  saveShop,
  updateProduct,
  updateShop,
} from "../firebase";
import type { Category, Product, Shop } from "../types";
import { runWhenActive, type RepositoryResult } from "./types";

export const shopRepository = {
  /** Public listing of ACTIVE shops. */
  async listActive(): Promise<RepositoryResult<Shop[]>> {
    return runWhenActive(isFirebaseActive, () => fetchShops(), "Could not load shops.");
  },

  async get(shopId: string): Promise<RepositoryResult<Shop | null>> {
    return runWhenActive(isFirebaseActive, () => fetchShop(shopId), "Could not load that shop.");
  },

  /** The shop a retailer owns. Backs the retailer portal's shop settings. */
  async getByOwner(ownerId: string): Promise<RepositoryResult<Shop | null>> {
    return runWhenActive(
      isFirebaseActive,
      () => fetchShopByOwner(ownerId),
      "Could not load your shop.",
    );
  },

  async save(shop: Omit<Shop, "id"> & { id?: string }): Promise<RepositoryResult<string>> {
    return runWhenActive(isFirebaseActive, () => saveShop(shop), "Could not save your shop.");
  },

  async update(shopId: string, patch: Partial<Shop>): Promise<RepositoryResult<void>> {
    return runWhenActive(
      isFirebaseActive,
      () => updateShop(shopId, patch),
      "Could not update your shop.",
    );
  },
};

export const categoryRepository = {
  async listActive(): Promise<RepositoryResult<Category[]>> {
    return runWhenActive(isFirebaseActive, () => fetchCategories(), "Could not load categories.");
  },

  async save(category: Omit<Category, "id"> & { id?: string }): Promise<RepositoryResult<string>> {
    return runWhenActive(
      isFirebaseActive,
      () => saveCategory(category),
      "Could not save that category.",
    );
  },
};

export const productRepository = {
  async listByShop(shopId: string): Promise<RepositoryResult<Product[]>> {
    return runWhenActive(
      isFirebaseActive,
      () => fetchProductsByShop(shopId),
      "Could not load products.",
    );
  },

  async get(productId: string): Promise<RepositoryResult<Product | null>> {
    return runWhenActive(
      isFirebaseActive,
      () => fetchProduct(productId),
      "Could not load that product.",
    );
  },

  /**
   * Creates or updates a product.
   *
   * `imageSource` is stored as given: a `catalog` reference keeps pointing at a
   * bundled asset, an `uploaded` reference holds the Cloud Storage download URL.
   */
  async save(product: Omit<Product, "id"> & { id?: string }): Promise<RepositoryResult<string>> {
    return runWhenActive(
      isFirebaseActive,
      () => saveProduct(product),
      "Could not save that product.",
    );
  },

  async update(productId: string, patch: Partial<Product>): Promise<RepositoryResult<void>> {
    return runWhenActive(
      isFirebaseActive,
      () => updateProduct(productId, patch),
      "Could not update that product.",
    );
  },

  async remove(productId: string): Promise<RepositoryResult<void>> {
    return runWhenActive(
      isFirebaseActive,
      () => removeProduct(productId),
      "Could not delete that product.",
    );
  },
};

export const catalogRepository = { shopRepository, categoryRepository, productRepository };
