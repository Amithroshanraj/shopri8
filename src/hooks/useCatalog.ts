import { useQuery } from "@tanstack/react-query";
import { categoryRepository, productRepository, shopRepository } from "@/lib/repositories";
import type { Product, Shop } from "@/lib/types";
import { isBrowser, isFirebaseActive } from "@/lib/firebase";

export const catalogQueryKeys = {
  categories: ["categories"] as const,
  shops: ["shops"] as const,
  activeShops: ["shops", "active"] as const,
  allShops: ["shops", "all"] as const,
  shop: (shopId: string) => ["shops", shopId] as const,
  shopsByCategory: (category: Shop["category"]) => ["shops", "category", category] as const,
  products: ["products"] as const,
  allProducts: ["products", "all"] as const,
  product: (productId: string) => ["products", productId] as const,
  productsByShop: (shopId: string) => ["products", "shop", shopId] as const,
  availableProductsByShop: (shopId: string) => ["products", "shop", shopId, "available"] as const,
  productsByCategory: (category: Product["category"]) =>
    ["products", "category", category] as const,
};

function queryEnabled(enabled: boolean): boolean {
  return enabled && (!isFirebaseActive || isBrowser);
}

function unwrap<T>(result: { ok: true; data: T } | { ok: false; message: string }): T {
  if (!result.ok) throw new Error(result.message);
  return result.data;
}

export function useCategories() {
  return useQuery({
    queryKey: catalogQueryKeys.categories,
    queryFn: async () => unwrap(await categoryRepository.listActive()),
    enabled: queryEnabled(true),
    staleTime: 60_000,
  });
}

export function useActiveShops() {
  return useQuery({
    queryKey: catalogQueryKeys.activeShops,
    queryFn: async () => unwrap(await shopRepository.listActive()),
    enabled: queryEnabled(true),
    staleTime: 30_000,
  });
}

export function useAllShops(enabled = true) {
  return useQuery({
    queryKey: catalogQueryKeys.allShops,
    queryFn: async () => unwrap(await shopRepository.listAll()),
    enabled: queryEnabled(enabled),
    staleTime: 30_000,
  });
}

export function useShop(shopId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: catalogQueryKeys.shop(shopId ?? ""),
    queryFn: async () => {
      if (!shopId) return null;
      return unwrap(await shopRepository.get(shopId));
    },
    enabled: queryEnabled(enabled && !!shopId),
    staleTime: 30_000,
  });
}

export function useShopsByCategory(category: Shop["category"] | undefined) {
  return useQuery({
    queryKey: category ? catalogQueryKeys.shopsByCategory(category) : catalogQueryKeys.activeShops,
    queryFn: async () =>
      unwrap(
        category
          ? await shopRepository.listByCategory(category)
          : await shopRepository.listActive(),
      ),
    enabled: queryEnabled(true),
    staleTime: 30_000,
  });
}

export function useAvailableProducts() {
  return useQuery({
    queryKey: catalogQueryKeys.products,
    queryFn: async () => unwrap(await productRepository.listAvailable()),
    enabled: queryEnabled(true),
    staleTime: 30_000,
  });
}

export function useAllProducts(enabled = true) {
  return useQuery({
    queryKey: catalogQueryKeys.allProducts,
    queryFn: async () => unwrap(await productRepository.listAll()),
    enabled: queryEnabled(enabled),
    staleTime: 30_000,
  });
}

export function useProductsByShop(shopId: string | undefined, availableOnly = true) {
  return useQuery({
    queryKey: shopId
      ? availableOnly
        ? catalogQueryKeys.availableProductsByShop(shopId)
        : catalogQueryKeys.productsByShop(shopId)
      : catalogQueryKeys.products,
    queryFn: async () => {
      if (!shopId) return [];
      const result = availableOnly
        ? await productRepository.listAvailableByShop(shopId)
        : await productRepository.listByShop(shopId);
      return unwrap(result);
    },
    enabled: queryEnabled(!!shopId),
    staleTime: 30_000,
  });
}

export function useProduct(productId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: catalogQueryKeys.product(productId ?? ""),
    queryFn: async () => {
      if (!productId) return null;
      return unwrap(await productRepository.get(productId));
    },
    enabled: queryEnabled(enabled && !!productId),
    staleTime: 30_000,
  });
}

export function useProductsByCategory(category: Product["category"] | undefined) {
  return useQuery({
    queryKey: category ? catalogQueryKeys.productsByCategory(category) : catalogQueryKeys.products,
    queryFn: async () => {
      const results = await productRepository.listAvailable();
      const products = unwrap(results);
      return category ? products.filter((product) => product.category === category) : products;
    },
    enabled: queryEnabled(true),
    staleTime: 30_000,
  });
}
