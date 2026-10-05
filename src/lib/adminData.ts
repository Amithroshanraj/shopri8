import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { DEFAULT_DEMO_WORKER } from "@/lib/workerAuth";
import { DEMO_WORKER_ID } from "@/data/worker";
import { PRODUCTS, SHOPS } from "@/data/demo";
import { useOrders } from "@/lib/store";
import { useRetailerStore } from "@/lib/retailerStore";
import { useWorkerStore } from "@/lib/workerStore";
import type { DeliveryTask, Order, Product, Shop } from "@/lib/types";
import { useAllProducts, useAllShops, catalogQueryKeys } from "@/hooks/useCatalog";
import { isFirebaseActive } from "@/lib/firebase";
import { productRepository, shopRepository } from "@/lib/repositories";

const CONTROLS_STORAGE_KEY = "shopri8.admin.controls.v1";
const CONTROLS_UPDATED_EVENT = "shopri8:admin-controls-updated";

export type ManagedStatus = "ACTIVE" | "INACTIVE";
export type ManagedRole = "Customer" | "Retailer" | "Delivery Worker" | "Admin";

export interface AdminControls {
  userStatus: Record<string, ManagedStatus>;
  retailerStatus: Record<string, ManagedStatus>;
  shopStatus: Record<string, ManagedStatus>;
  productAvailability: Record<string, boolean>;
  productOverrides: Record<string, Partial<Pick<Product, "price" | "stock" | "availability">>>;
}

export interface ManagedUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: ManagedRole;
  status: ManagedStatus;
  createdAt?: string;
}

const EMPTY_CONTROLS: AdminControls = {
  userStatus: {},
  retailerStatus: {},
  shopStatus: {},
  productAvailability: {},
  productOverrides: {},
};

function readControls(): AdminControls {
  try {
    const raw = localStorage.getItem(CONTROLS_STORAGE_KEY);
    if (!raw) return EMPTY_CONTROLS;
    return { ...EMPTY_CONTROLS, ...(JSON.parse(raw) as Partial<AdminControls>) };
  } catch {
    return EMPTY_CONTROLS;
  }
}

export function useAdminControls() {
  const [controls, setControls] = useState(EMPTY_CONTROLS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const refresh = () => setControls(readControls());
    refresh();
    setReady(true);
    const onStorage = (event: StorageEvent) => {
      if (event.key === CONTROLS_STORAGE_KEY) refresh();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(CONTROLS_UPDATED_EVENT, refresh);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(CONTROLS_UPDATED_EVENT, refresh);
    };
  }, []);

  const update = (patch: Partial<AdminControls>) => {
    const next = { ...controls, ...patch };
    setControls(next);
    try {
      localStorage.setItem(CONTROLS_STORAGE_KEY, JSON.stringify(next));
      window.dispatchEvent(new Event(CONTROLS_UPDATED_EVENT));
    } catch {
      // Keep the current admin view usable when browser storage is unavailable.
    }
  };

  return { controls, ready, update };
}

function newestOrderPerId(...groups: Order[][]): Order[] {
  const byId = new Map<string, Order>();
  for (const order of groups.flat()) {
    const current = byId.get(order.id);
    if (!current || order.updatedAt >= current.updatedAt) byId.set(order.id, order);
  }
  return [...byId.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function mergeById<T extends { id: string }>(...groups: T[][]): T[] {
  const byId = new Map<string, T>();
  for (const item of groups.flat()) byId.set(item.id, item);
  return [...byId.values()];
}

function mergeShopCatalog(base: Shop[], retailerShop: Shop | null): Shop[] {
  return retailerShop ? mergeById(base, [retailerShop]) : base;
}

export function useAdminData() {
  const queryClient = useQueryClient();
  const firebaseMode = isFirebaseActive;
  const firebaseShops = useAllShops(firebaseMode);
  const firebaseProducts = useAllProducts(firebaseMode);
  const customerStore = useOrders();
  const retailerStore = useRetailerStore();
  const workerStore = useWorkerStore();
  const controlsState = useAdminControls();

  const orders = newestOrderPerId(customerStore.orders, retailerStore.orders, workerStore.orders);
  const shops = firebaseMode
    ? (firebaseShops.data ?? [])
    : mergeShopCatalog(SHOPS, retailerStore.shop);
  const products = firebaseMode
    ? (firebaseProducts.data ?? [])
    : mergeById(PRODUCTS, retailerStore.products);
  const tasks = workerStore.tasks;

  const customers = new Map<string, ManagedUser>();
  for (const order of orders) {
    if (!customers.has(order.customerId)) {
      customers.set(order.customerId, {
        id: order.customerId,
        name: order.deliveryAddress.recipientName || "Customer",
        email: "",
        phone: order.deliveryAddress.phone || "",
        role: "Customer",
        status: controlsState.controls.userStatus[order.customerId] ?? "ACTIVE",
        createdAt: order.createdAt,
      });
    }
  }

  const retailersById = new Map<string, ManagedUser>();
  for (const shop of shops) {
    if (!retailersById.has(shop.ownerId)) {
      const isDemoRetailer = shop.ownerId === "demo-retailer-1";
      retailersById.set(shop.ownerId, {
        id: shop.ownerId,
        name: shop.name,
        email: isDemoRetailer ? "retailer@greenbasket.com" : "",
        phone: isDemoRetailer ? "+91 98765 43210" : "",
        role: "Retailer",
        status: controlsState.controls.retailerStatus[shop.ownerId] ?? "ACTIVE",
        ...(shop.createdAt ? { createdAt: shop.createdAt } : {}),
      });
    }
  }

  const workerIds = new Set<string>([DEMO_WORKER_ID]);
  for (const task of tasks) {
    if (task.deliveryWorkerId) workerIds.add(task.deliveryWorkerId);
  }
  const workers: ManagedUser[] = [...workerIds].map((id) => ({
    id,
    name: id === DEMO_WORKER_ID ? DEFAULT_DEMO_WORKER.displayName : "Delivery Worker",
    email: id === DEMO_WORKER_ID ? DEFAULT_DEMO_WORKER.email : "",
    phone: id === DEMO_WORKER_ID ? DEFAULT_DEMO_WORKER.phoneNumber : "",
    role: "Delivery Worker",
    status: controlsState.controls.userStatus[id] ?? "ACTIVE",
  }));

  const users = [...customers.values(), ...retailersById.values(), ...workers].map((user) => ({
    ...user,
    status: controlsState.controls.userStatus[user.id] ?? user.status,
  }));

  const normalizedTasks: DeliveryTask[] = tasks;
  const normalizedProducts: Product[] = products.map((product) => {
    if (firebaseMode) return product;
    const override = controlsState.controls.productOverrides[product.id] ?? {};
    const stock = override.stock ?? product.stock;
    return {
      ...product,
      ...override,
      stock,
      availability:
        controlsState.controls.productAvailability[product.id] ??
        override.availability ??
        (stock > 0 && product.availability),
    };
  });

  const updateProduct = async (
    productId: string,
    updates: Partial<Pick<Product, "price" | "stock" | "availability">>,
  ): Promise<void> => {
    const safeUpdates = updates.stock === 0 ? { ...updates, availability: false } : updates;
    if (firebaseMode) {
      const result = await productRepository.update(productId, safeUpdates);
      if (!result.ok) throw new Error(result.message);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: catalogQueryKeys.allProducts }),
        queryClient.invalidateQueries({ queryKey: catalogQueryKeys.products }),
        queryClient.invalidateQueries({ queryKey: ["products", productId] }),
        queryClient.invalidateQueries({ queryKey: ["products", "shop"] }),
      ]);
      return;
    }
    controlsState.update({
      productOverrides: {
        ...controlsState.controls.productOverrides,
        [productId]: {
          ...controlsState.controls.productOverrides[productId],
          ...safeUpdates,
        },
      },
    });
    await retailerStore.updateProduct(productId, safeUpdates);
  };

  const updateShop = async (shopId: string, updates: Partial<Shop>): Promise<void> => {
    if (firebaseMode) {
      const result = await shopRepository.update(shopId, updates);
      if (!result.ok) throw new Error(result.message);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: catalogQueryKeys.allShops }),
        queryClient.invalidateQueries({ queryKey: catalogQueryKeys.activeShops }),
        queryClient.invalidateQueries({ queryKey: catalogQueryKeys.shop(shopId) }),
        queryClient.invalidateQueries({ queryKey: catalogQueryKeys.products }),
      ]);
      return;
    }
    controlsState.update({
      shopStatus: {
        ...controlsState.controls.shopStatus,
        ...(updates.status === "ACTIVE" || updates.status === "INACTIVE"
          ? { [shopId]: updates.status }
          : {}),
      },
    });
    if (shopId === "shop-green-basket") await retailerStore.updateShop(updates);
  };

  const controls = firebaseMode
    ? { ...controlsState.controls, shopStatus: {}, productAvailability: {}, productOverrides: {} }
    : controlsState.controls;

  return {
    controls,
    controlsReady: firebaseMode
      ? firebaseShops.isSuccess && firebaseProducts.isSuccess
      : controlsState.ready,
    error: firebaseShops.error?.message ?? firebaseProducts.error?.message ?? null,
    firebaseMode,
    updateControls: controlsState.update,
    users,
    customers: users.filter((user) => user.role === "Customer"),
    retailers: [...retailersById.values()],
    workers,
    shops: shops.map((shop) => ({
      ...shop,
      status: controls.shopStatus[shop.id] ?? shop.status,
    })),
    products: normalizedProducts,
    orders,
    tasks: normalizedTasks,
    loading:
      !customerStore.ready ||
      workerStore.loading ||
      (firebaseMode
        ? firebaseShops.isPending || firebaseProducts.isPending
        : retailerStore.loading),
    updateRetailerShop: retailerStore.updateShop,
    updateProduct,
    updateShop,
  };
}
