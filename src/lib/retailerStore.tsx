import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Order, Product, Shop } from "./types";
import { DEMO_CENTER, PRODUCTS, SHOPS } from "../data/demo";
import { announceOrdersUpdated, ORDERS_STORAGE_KEY, ORDERS_UPDATED_EVENT } from "./orderSync";
import { isBrowser, isFirebaseActive } from "./firebase";
import { orderRepository, productRepository, shopRepository } from "./repositories";
import { useRetailerAuth } from "./retailerAuth";
import { catalogQueryKeys } from "@/hooks/useCatalog";

export const DEMO_RETAILER_ID = "demo-retailer-1";
export const DEMO_SHOP_ID = "shop-green-basket";

const SHOP_STORAGE_KEY = "shopri8.retailer.shop.v1";
const PRODUCTS_STORAGE_KEY = "shopri8.retailer.products.v1";
const RETAILER_ORDER_TRANSITIONS: Partial<Record<Order["orderStatus"], Order["orderStatus"][]>> = {
  PLACED: ["RETAILER_REVIEW"],
  RETAILER_REVIEW: ["ACCEPTED", "REJECTED"],
  ACCEPTED: ["PREPARING"],
  PREPARING: ["READY_FOR_PICKUP"],
};

// Default initial demo products
const INITIAL_PRODUCTS: Product[] = [...PRODUCTS.filter((p) => p.shopId === DEMO_SHOP_ID)];

// Default initial demo orders for the shop
const INITIAL_ORDERS: Order[] = [
  {
    id: "SR8-ORD-101",
    customerId: "cust-1",
    shopId: DEMO_SHOP_ID,
    shopName: "Green Basket Grocers",
    items: [
      { productId: "p-rice-5", name: "Sona Masoori Rice", price: 340, quantity: 2 },
      { productId: "p-toor-dal", name: "Toor Dal", price: 155, quantity: 1 },
    ],
    subtotal: 835,
    deliveryFee: 29,
    totalAmount: 864,
    deliveryAddress: {
      id: "addr-1",
      userId: "cust-1",
      label: "Home",
      recipientName: "Rahul Kumar",
      phone: "+91 98765 43210",
      address: "12, 4th Cross, Shanthi Nagar, Bengaluru",
      houseNumber: "Flat 201",
      landmark: "Near Shanthi Park",
      latitude: DEMO_CENTER.latitude,
      longitude: DEMO_CENTER.longitude,
      isDefault: true,
    },
    paymentMethod: "COD",
    paymentStatus: "COD_PENDING",
    orderStatus: "PLACED",
    statusHistory: [{ status: "PLACED", at: new Date(Date.now() - 15 * 60 * 1000).toISOString() }],
    createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
  },
  {
    id: "SR8-ORD-102",
    customerId: "cust-2",
    shopId: DEMO_SHOP_ID,
    shopName: "Green Basket Grocers",
    items: [{ productId: "p-sunflower-oil", name: "Sunflower Oil", price: 172, quantity: 2 }],
    subtotal: 344,
    deliveryFee: 29,
    totalAmount: 373,
    deliveryAddress: {
      id: "addr-2",
      userId: "cust-2",
      label: "Work",
      recipientName: "Priya Sharma",
      phone: "+91 87654 32109",
      address: "45, Cross Road, Shanthi Nagar, Bengaluru",
      houseNumber: "Building 4B",
      landmark: "Opposite Metro Station",
      latitude: DEMO_CENTER.latitude,
      longitude: DEMO_CENTER.longitude,
      isDefault: false,
    },
    paymentMethod: "COD",
    paymentStatus: "COD_PENDING",
    orderStatus: "ACCEPTED",
    statusHistory: [
      { status: "PLACED", at: new Date(Date.now() - 60 * 60 * 1000).toISOString() },
      { status: "ACCEPTED", at: new Date(Date.now() - 45 * 60 * 1000).toISOString() },
    ],
    createdAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
  },
  {
    id: "SR8-ORD-103",
    customerId: "cust-3",
    shopId: DEMO_SHOP_ID,
    shopName: "Green Basket Grocers",
    items: [
      { productId: "p-rice-5", name: "Sona Masoori Rice", price: 340, quantity: 1 },
      { productId: "p-sunflower-oil", name: "Sunflower Oil", price: 172, quantity: 1 },
    ],
    subtotal: 512,
    deliveryFee: 29,
    totalAmount: 541,
    deliveryAddress: {
      id: "addr-3",
      userId: "cust-3",
      label: "Home",
      recipientName: "Anand Verma",
      phone: "+91 91234 56780",
      address: "7, Park Lane, Shanthi Nagar, Bengaluru",
      latitude: DEMO_CENTER.latitude,
      longitude: DEMO_CENTER.longitude,
      isDefault: true,
    },
    paymentMethod: "DEMO_UPI",
    paymentStatus: "PAID",
    orderStatus: "PREPARING",
    statusHistory: [
      { status: "PLACED", at: new Date(Date.now() - 120 * 60 * 1000).toISOString() },
      { status: "ACCEPTED", at: new Date(Date.now() - 100 * 60 * 1000).toISOString() },
      { status: "PREPARING", at: new Date(Date.now() - 75 * 60 * 1000).toISOString() },
    ],
    createdAt: new Date(Date.now() - 120 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 75 * 60 * 1000).toISOString(),
  },
  {
    id: "SR8-ORD-104",
    customerId: "cust-4",
    shopId: DEMO_SHOP_ID,
    shopName: "Green Basket Grocers",
    items: [{ productId: "p-toor-dal", name: "Toor Dal", price: 155, quantity: 3 }],
    subtotal: 465,
    deliveryFee: 29,
    totalAmount: 494,
    deliveryAddress: {
      id: "addr-4",
      userId: "cust-4",
      label: "Home",
      recipientName: "Kavita Rao",
      phone: "+91 98451 23456",
      address: "19, Richmond Road, Bengaluru",
      latitude: DEMO_CENTER.latitude,
      longitude: DEMO_CENTER.longitude,
      isDefault: true,
    },
    paymentMethod: "COD",
    paymentStatus: "COD_PENDING",
    orderStatus: "READY_FOR_PICKUP",
    statusHistory: [
      { status: "PLACED", at: new Date(Date.now() - 180 * 60 * 1000).toISOString() },
      { status: "ACCEPTED", at: new Date(Date.now() - 150 * 60 * 1000).toISOString() },
      { status: "PREPARING", at: new Date(Date.now() - 120 * 60 * 1000).toISOString() },
      { status: "READY_FOR_PICKUP", at: new Date(Date.now() - 60 * 60 * 1000).toISOString() },
    ],
    createdAt: new Date(Date.now() - 180 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
  },
  {
    id: "SR8-ORD-105",
    customerId: "cust-5",
    shopId: DEMO_SHOP_ID,
    shopName: "Green Basket Grocers",
    items: [{ productId: "p-rice-5", name: "Sona Masoori Rice", price: 340, quantity: 1 }],
    subtotal: 340,
    deliveryFee: 29,
    totalAmount: 369,
    deliveryAddress: {
      id: "addr-5",
      userId: "cust-5",
      label: "Home",
      recipientName: "Suresh Reddy",
      phone: "+91 99887 76655",
      address: "33, 2nd Main, Shanthi Nagar, Bengaluru",
      latitude: DEMO_CENTER.latitude,
      longitude: DEMO_CENTER.longitude,
      isDefault: true,
    },
    paymentMethod: "DEMO_UPI",
    paymentStatus: "PAID",
    orderStatus: "DELIVERED",
    statusHistory: [
      { status: "PLACED", at: new Date(Date.now() - 300 * 60 * 1000).toISOString() },
      { status: "ACCEPTED", at: new Date(Date.now() - 270 * 60 * 1000).toISOString() },
      { status: "PREPARING", at: new Date(Date.now() - 240 * 60 * 1000).toISOString() },
      { status: "READY_FOR_PICKUP", at: new Date(Date.now() - 210 * 60 * 1000).toISOString() },
      { status: "PICKED_UP", at: new Date(Date.now() - 180 * 60 * 1000).toISOString() },
      { status: "OUT_FOR_DELIVERY", at: new Date(Date.now() - 150 * 60 * 1000).toISOString() },
      { status: "DELIVERED", at: new Date(Date.now() - 120 * 60 * 1000).toISOString() },
    ],
    createdAt: new Date(Date.now() - 300 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 120 * 60 * 1000).toISOString(),
  },
];

// Helper to read initial shop
function loadInitialShop(): Shop {
  return SHOPS.find((s) => s.ownerId === DEMO_RETAILER_ID) ?? SHOPS[0]!;
}

// Helper to read initial products
function loadInitialProducts(): Product[] {
  return INITIAL_PRODUCTS;
}

// Helper to read initial orders for this shop
function loadInitialOrders(): Order[] {
  return INITIAL_ORDERS;
}

// In-memory shared state for multi-component reactivity
interface StoreState {
  shop: Shop;
  products: Product[];
  orders: Order[];
  loading: boolean;
}

const initialShop = loadInitialShop();
let storeState: StoreState = {
  shop: initialShop,
  products: loadInitialProducts(),
  orders: loadInitialOrders(),
  loading: false,
};

const storeListeners = new Set<(s: StoreState) => void>();
let hasHydratedStore = false;

function notifyStoreListeners() {
  storeListeners.forEach((l) => l(storeState));
}

function hydrateStoreFromStorage() {
  if (hasHydratedStore || typeof window === "undefined") return;
  hasHydratedStore = true;

  let shop = storeState.shop;
  let products = storeState.products;
  let orders = storeState.orders;

  try {
    const rawShop = localStorage.getItem(SHOP_STORAGE_KEY);
    if (rawShop) shop = JSON.parse(rawShop) as Shop;
  } catch {
    // Keep demo shop data when stored data is invalid.
  }

  try {
    const rawProducts = localStorage.getItem(PRODUCTS_STORAGE_KEY);
    if (rawProducts) {
      const storedProducts = JSON.parse(rawProducts) as Product[];
      if (Array.isArray(storedProducts)) products = storedProducts;
    }
  } catch {
    // Keep demo products when stored data is invalid.
  }

  try {
    const rawOrders = localStorage.getItem(ORDERS_STORAGE_KEY);
    if (rawOrders) {
      const storedOrders = JSON.parse(rawOrders) as Order[];
      if (Array.isArray(storedOrders)) {
        const storedIds = new Set(storedOrders.map((order) => order.id));
        const missingDemoOrders = INITIAL_ORDERS.filter((order) => !storedIds.has(order.id));
        orders = [...storedOrders, ...missingDemoOrders];
        if (missingDemoOrders.length > 0) {
          localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(orders));
          announceOrdersUpdated();
        }
      }
    } else {
      localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(orders));
    }
  } catch {
    // Keep demo orders when stored data is invalid or unavailable.
  }

  storeState = { ...storeState, shop, products, orders };
  notifyStoreListeners();
}

export function useRetailerStore() {
  const [state, setState] = useState<StoreState>(storeState);
  const auth = useRetailerAuth();
  const queryClient = useQueryClient();
  const firebaseEnabled = isFirebaseActive && isBrowser && auth.user !== null;
  const firebaseShop = useQuery({
    queryKey: ["shops", "owner", auth.user?.uid ?? ""],
    queryFn: async () => {
      const result = await shopRepository.getByOwner(auth.user!.uid);
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
    enabled: firebaseEnabled,
    staleTime: 30_000,
  });
  const shopOrdersQueryKey = useMemo(
    () => ["orders", "shop", firebaseShop.data?.id ?? ""] as const,
    [firebaseShop.data?.id],
  );
  const firebaseOrders = useQuery({
    queryKey: shopOrdersQueryKey,
    queryFn: async () => {
      if (!firebaseShop.data) return [];
      const result = await orderRepository.listForShop(firebaseShop.data.id);
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
    enabled: firebaseEnabled && !!firebaseShop.data,
  });
  const [firebaseOrdersLiveError, setFirebaseOrdersLiveError] = useState<string | null>(null);
  useEffect(() => {
    const shopId = firebaseShop.data?.id;
    setFirebaseOrdersLiveError(null);
    if (!firebaseEnabled || !shopId) return;
    return orderRepository.subscribeForShop(
      shopId,
      (orders) => {
        setFirebaseOrdersLiveError(null);
        void queryClient.cancelQueries({ queryKey: shopOrdersQueryKey, exact: true });
        queryClient.setQueryData(shopOrdersQueryKey, orders);
      },
      (error) => setFirebaseOrdersLiveError(error.message),
    );
  }, [firebaseEnabled, firebaseShop.data?.id, shopOrdersQueryKey, queryClient]);
  const firebaseProducts = useQuery({
    queryKey: firebaseShop.data
      ? catalogQueryKeys.productsByShop(firebaseShop.data.id)
      : ["products", "shop", "unresolved"],
    queryFn: async () => {
      if (!firebaseShop.data) return [];
      const result = await productRepository.listByShop(firebaseShop.data.id);
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
    enabled: firebaseEnabled && !!firebaseShop.data,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (isFirebaseActive) return;
    const listener = (next: StoreState) => {
      setState(next);
    };

    storeListeners.add(listener);
    setState(storeState);
    hydrateStoreFromStorage();

    const onStorage = (e: StorageEvent) => {
      if (e.key === SHOP_STORAGE_KEY && e.newValue) {
        try {
          const shop = JSON.parse(e.newValue) as Shop;
          storeState = { ...storeState, shop };
          notifyStoreListeners();
        } catch {
          /* ignore */
        }
      } else if (e.key === PRODUCTS_STORAGE_KEY && e.newValue) {
        try {
          const products = JSON.parse(e.newValue) as Product[];
          storeState = { ...storeState, products };
          notifyStoreListeners();
        } catch {
          /* ignore */
        }
      } else if (e.key === ORDERS_STORAGE_KEY && e.newValue) {
        try {
          const orders = JSON.parse(e.newValue) as Order[];
          storeState = { ...storeState, orders };
          notifyStoreListeners();
        } catch {
          /* ignore */
        }
      }
    };
    const onOrdersUpdated = () => {
      try {
        const raw = localStorage.getItem(ORDERS_STORAGE_KEY);
        if (raw) {
          storeState = { ...storeState, orders: JSON.parse(raw) as Order[] };
          notifyStoreListeners();
        }
      } catch {
        // Keep the current order snapshot when stored data is invalid.
      }
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener(ORDERS_UPDATED_EVENT, onOrdersUpdated);
    return () => {
      storeListeners.delete(listener);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(ORDERS_UPDATED_EVENT, onOrdersUpdated);
    };
  }, []);

  // Filter orders strictly for this shop
  const shopOrders = isFirebaseActive
    ? (firebaseOrders.data ?? [])
    : state.orders.filter((o) => o.shopId === state.shop.id);

  // Update order status and sync across application
  const updateOrderStatus = useCallback(
    async (orderId: string, newStatus: Order["orderStatus"], rejectionReason?: string) => {
      if (isFirebaseActive) {
        const order = firebaseOrders.data?.find((entry) => entry.id === orderId);
        if (!order) throw new Error("Order not found for this shop.");
        const result = await orderRepository.advance(
          order,
          newStatus,
          rejectionReason ? { rejectionReason } : {},
        );
        if (!result.ok) throw new Error(result.message);
        await queryClient.invalidateQueries({ queryKey: ["orders"] });
        await queryClient.invalidateQueries({ queryKey: ["delivery-tasks"] });
        return;
      }
      const order = storeState.orders.find((currentOrder) => currentOrder.id === orderId);
      if (!order || !RETAILER_ORDER_TRANSITIONS[order.orderStatus]?.includes(newStatus)) {
        throw new Error("That order cannot move to that status.");
      }

      const now = new Date().toISOString();
      const updatedAllOrders = storeState.orders.map((o) => {
        if (o.id !== orderId) return o;
        return {
          ...o,
          orderStatus: newStatus,
          rejectionReason: rejectionReason ?? o.rejectionReason,
          statusHistory: [...o.statusHistory, { status: newStatus, at: now }],
          updatedAt: now,
        };
      });

      storeState = { ...storeState, orders: updatedAllOrders };
      try {
        localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(updatedAllOrders));
        announceOrdersUpdated();
      } catch (e) {
        console.error("Failed to save orders:", e);
      }
      notifyStoreListeners();
    },
    [firebaseOrders.data, queryClient],
  );

  // Add a new product to the shop
  const addProduct = useCallback(
    async (productData: Omit<Product, "id" | "shopId" | "createdAt" | "updatedAt">) => {
      if (isFirebaseActive) {
        const shop = firebaseShop.data;
        if (!shop) throw new Error("No shop profile is associated with this retailer account.");
        const created = await productRepository.save({
          ...productData,
          shopId: shop.id,
          availability: productData.stock > 0 && productData.availability,
        });
        if (!created.ok) throw new Error(created.message);
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: catalogQueryKeys.productsByShop(shop.id) }),
          queryClient.invalidateQueries({
            queryKey: catalogQueryKeys.availableProductsByShop(shop.id),
          }),
          queryClient.invalidateQueries({ queryKey: catalogQueryKeys.products }),
          queryClient.invalidateQueries({ queryKey: catalogQueryKeys.allProducts }),
        ]);
        const loaded = await productRepository.get(created.data);
        if (!loaded.ok) throw new Error(loaded.message);
        if (!loaded.data) throw new Error("The product was saved but could not be reloaded.");
        return loaded.data;
      }
      const now = new Date().toISOString();
      const newProduct: Product = {
        ...productData,
        availability: productData.stock > 0 && productData.availability,
        id: `prod-${Date.now()}`,
        shopId: storeState.shop.id,
        createdAt: now,
        updatedAt: now,
      };

      const nextProducts = [newProduct, ...storeState.products];
      storeState = { ...storeState, products: nextProducts };
      try {
        localStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(nextProducts));
      } catch (e) {
        console.error("Failed to save products:", e);
      }
      notifyStoreListeners();
      return newProduct;
    },
    [firebaseShop.data, queryClient],
  );

  // Update product details
  const updateProduct = useCallback(
    async (productId: string, updates: Partial<Product>) => {
      if (isFirebaseActive) {
        const result = await productRepository.update(productId, updates);
        if (!result.ok) throw new Error(result.message);
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: catalogQueryKeys.products }),
          queryClient.invalidateQueries({ queryKey: catalogQueryKeys.allProducts }),
          queryClient.invalidateQueries({ queryKey: ["products", productId] }),
          queryClient.invalidateQueries({ queryKey: ["products", "shop"] }),
        ]);
        return;
      }
      const now = new Date().toISOString();
      const nextProducts = storeState.products.map((p) => {
        if (p.id !== productId) return p;
        const updated = { ...p, ...updates, updatedAt: now };
        if (updates.stock !== undefined) updated.stock = Math.max(0, updates.stock);
        if (updated.stock === 0) updated.availability = false;
        return updated;
      });

      storeState = { ...storeState, products: nextProducts };
      try {
        localStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(nextProducts));
      } catch (e) {
        console.error("Failed to save products:", e);
      }
      notifyStoreListeners();
    },
    [queryClient],
  );

  // Delete a product
  const deleteProduct = useCallback(
    async (productId: string) => {
      if (isFirebaseActive) {
        const result = await productRepository.remove(productId);
        if (!result.ok) throw new Error(result.message);
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: catalogQueryKeys.products }),
          queryClient.invalidateQueries({ queryKey: catalogQueryKeys.allProducts }),
          queryClient.invalidateQueries({ queryKey: ["products", "shop"] }),
        ]);
        return;
      }
      const nextProducts = storeState.products.filter((p) => p.id !== productId);
      storeState = { ...storeState, products: nextProducts };
      try {
        localStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(nextProducts));
      } catch (e) {
        console.error("Failed to save products:", e);
      }
      notifyStoreListeners();
    },
    [queryClient],
  );

  // Toggle availability shortcut
  const toggleAvailability = useCallback(
    async (productId: string, currentAvailability?: boolean) => {
      const product = isFirebaseActive
        ? firebaseProducts.data?.find((item) => item.id === productId)
        : storeState.products.find((item) => item.id === productId);
      if (!product) return;
      const nextAvail =
        currentAvailability !== undefined ? !currentAvailability : !product.availability;
      await updateProduct(productId, { availability: nextAvail });
    },
    [firebaseProducts.data, updateProduct],
  );

  // Update stock shortcut
  const updateStock = useCallback(
    async (productId: string, newStock: number) => {
      await updateProduct(productId, {
        stock: Math.max(0, newStock),
        ...(newStock <= 0 ? { availability: false } : {}),
      });
    },
    [updateProduct],
  );

  // Update shop details
  const updateShop = useCallback(
    async (updates: Partial<Shop>) => {
      if (isFirebaseActive) {
        const shop = firebaseShop.data;
        if (!shop) throw new Error("No shop profile is associated with this retailer account.");
        const result = await shopRepository.update(shop.id, updates);
        if (!result.ok) throw new Error(result.message);
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: catalogQueryKeys.shop(shop.id) }),
          queryClient.invalidateQueries({ queryKey: ["shops", "owner", shop.ownerId] }),
          queryClient.invalidateQueries({ queryKey: catalogQueryKeys.activeShops }),
          queryClient.invalidateQueries({ queryKey: catalogQueryKeys.allShops }),
          queryClient.invalidateQueries({ queryKey: catalogQueryKeys.products }),
        ]);
        return;
      }
      const now = new Date().toISOString();
      const updatedShop: Shop = {
        ...storeState.shop,
        ...updates,
        updatedAt: now,
      };
      storeState = { ...storeState, shop: updatedShop };
      try {
        localStorage.setItem(SHOP_STORAGE_KEY, JSON.stringify(updatedShop));
      } catch (e) {
        console.error("Failed to save shop:", e);
      }
      notifyStoreListeners();
    },
    [firebaseShop.data, queryClient],
  );

  const openShop = useCallback(() => {
    return updateShop({ status: "ACTIVE" });
  }, [updateShop]);

  const closeShop = useCallback(() => {
    return updateShop({ status: "INACTIVE" });
  }, [updateShop]);

  return {
    shop: isFirebaseActive ? (firebaseShop.data ?? null) : state.shop,
    products: isFirebaseActive ? (firebaseProducts.data ?? []) : state.products,
    orders: shopOrders,
    loading: isFirebaseActive
      ? !auth.user ||
        firebaseShop.isPending ||
        (firebaseShop.data !== null && (firebaseProducts.isPending || firebaseOrders.isPending))
      : state.loading,
    error: isFirebaseActive
      ? (firebaseShop.error?.message ??
        firebaseProducts.error?.message ??
        firebaseOrders.error?.message ??
        null)
      : null,
    updateOrderStatus,
    addProduct,
    updateProduct,
    deleteProduct,
    toggleAvailability,
    updateStock,
    updateShop,
    openShop,
    closeShop,
  };
}
