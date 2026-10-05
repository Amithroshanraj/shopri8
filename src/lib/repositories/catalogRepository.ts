/**
 * Catalogue repository — shops, categories and products.
 *
 * Firebase is authoritative in Firebase mode. The existing bundled catalogue
 * remains the read-only source for demo mode; retailer-local mutations continue
 * through the existing demo store.
 */

import {
  fetchAllProducts,
  fetchAllShops,
  fetchAvailableProductsByShop,
  fetchCategories,
  fetchCategory,
  fetchProduct,
  fetchProductsByCategory,
  fetchProductsByShop,
  fetchShop,
  fetchShopByOwner,
  fetchShops,
  fetchShopsByCategory,
  isFirebaseActive,
  removeProduct,
  saveCategory,
  saveProduct,
  saveShop,
  updateProduct,
  updateShop,
} from "../firebase";
import type { Category, Product, Shop } from "../types";
import {
  CATEGORIES,
  CATEGORY_BY_ID,
  PRODUCTS,
  PRODUCT_BY_ID,
  SHOPS,
  SHOP_BY_ID,
  productsForShop,
} from "../../data/demo";
import { runWhenActive, type RepositoryResult } from "./types";

function categoryWithAssets(category: Category): Category {
  const demo = CATEGORY_BY_ID[category.id];
  return {
    ...demo,
    ...category,
    icon: category.icon || demo?.icon || "Store",
    image: category.image || demo?.image || "",
  };
}

function result<T>(
  operation: () => Promise<T>,
  demoData: T,
  fallbackMessage: string,
): Promise<RepositoryResult<T>> {
  if (!isFirebaseActive) return Promise.resolve({ ok: true, data: demoData });
  return runWhenActive(isFirebaseActive, operation, fallbackMessage);
}

export const shopRepository = {
  async listActive(): Promise<RepositoryResult<Shop[]>> {
    return result(
      fetchShops,
      SHOPS.filter((shop) => shop.status === "ACTIVE"),
      "Could not load shops.",
    );
  },

  /** Complete list for admin views. */
  async listAll(): Promise<RepositoryResult<Shop[]>> {
    return result(fetchAllShops, SHOPS, "Could not load shops.");
  },

  async get(shopId: string): Promise<RepositoryResult<Shop | null>> {
    return result(() => fetchShop(shopId), SHOP_BY_ID[shopId] ?? null, "Could not load that shop.");
  },

  async getByOwner(ownerId: string): Promise<RepositoryResult<Shop | null>> {
    return result(
      () => fetchShopByOwner(ownerId),
      SHOPS.find((shop) => shop.ownerId === ownerId) ?? null,
      "Could not load your shop.",
    );
  },

  async listByCategory(category: Shop["category"]): Promise<RepositoryResult<Shop[]>> {
    return result(
      () => fetchShopsByCategory(category),
      SHOPS.filter((shop) => shop.status === "ACTIVE" && shop.category === category),
      "Could not load shops.",
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
    return result(
      async () => (await fetchCategories()).map(categoryWithAssets),
      CATEGORIES,
      "Could not load categories.",
    );
  },

  async get(categoryId: string): Promise<RepositoryResult<Category | null>> {
    const fallback = CATEGORY_BY_ID[categoryId as keyof typeof CATEGORY_BY_ID] ?? null;
    return result(
      async () => {
        const category = await fetchCategory(categoryId);
        return category ? categoryWithAssets(category) : null;
      },
      fallback,
      "Could not load that category.",
    );
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
  /** Retailer inventory, including unavailable products. */
  async listByShop(shopId: string): Promise<RepositoryResult<Product[]>> {
    return result(
      () => fetchProductsByShop(shopId),
      productsForShop(shopId),
      "Could not load products.",
    );
  },

  /** Customer-visible products scoped to one active shop. */
  async listAvailableByShop(shopId: string): Promise<RepositoryResult<Product[]>> {
    return result(
      () => fetchAvailableProductsByShop(shopId),
      productsForShop(shopId).filter((product) => product.availability && product.stock > 0),
      "Could not load products.",
    );
  },

  /** Customer product discovery, constrained to active shops. */
  async listAvailable(): Promise<RepositoryResult<Product[]>> {
    if (!isFirebaseActive) {
      return {
        ok: true,
        data: PRODUCTS.filter((product) => product.availability && product.stock > 0),
      };
    }
    const shops = await shopRepository.listActive();
    if (!shops.ok) return shops;
    const results = await Promise.all(
      shops.data.map((shop) => productRepository.listAvailableByShop(shop.id)),
    );
    const failure = results.find((entry) => !entry.ok);
    if (failure && !failure.ok) return failure;
    return { ok: true, data: results.flatMap((entry) => (entry.ok ? entry.data : [])) };
  },

  /** Complete list for admin views. */
  async listAll(): Promise<RepositoryResult<Product[]>> {
    return result(fetchAllProducts, PRODUCTS, "Could not load products.");
  },

  async listByCategory(category: Product["category"]): Promise<RepositoryResult<Product[]>> {
    return result(
      () => fetchProductsByCategory(category),
      PRODUCTS.filter((product) => product.category === category),
      "Could not load products.",
    );
  },

  async get(productId: string): Promise<RepositoryResult<Product | null>> {
    return result(
      () => fetchProduct(productId),
      PRODUCT_BY_ID[productId] ?? null,
      "Could not load that product.",
    );
  },

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

  async updateStock(productId: string, stock: number): Promise<RepositoryResult<void>> {
    return productRepository.update(productId, {
      stock,
      ...(stock === 0 ? { availability: false } : {}),
    });
  },

  async updateAvailability(
    productId: string,
    availability: boolean,
  ): Promise<RepositoryResult<void>> {
    return productRepository.update(productId, { availability });
  },
};

export const catalogRepository = { shopRepository, categoryRepository, productRepository };
