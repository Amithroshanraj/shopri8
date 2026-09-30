import { useCallback, useEffect, useState } from "react";
import type { Order, Product, Shop } from "./types";
import { DEMO_CENTER, PRODUCTS, SHOPS } from "../data/demo";

export const DEMO_RETAILER_ID = "demo-retailer-1";
export const DEMO_SHOP_ID = "shop-green-basket";

const SHOP_STORAGE_KEY = "shopri8.retailer.shop.v1";
const PRODUCTS_STORAGE_KEY = "shopri8.retailer.products.v1";
const ORDERS_STORAGE_KEY = "shopri8.orders.v1";

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
    paymentMethod: "CASHFREE",
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
    paymentMethod: "CASHFREE",
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
  const fallback: Shop = SHOPS.find((s) => s.ownerId === DEMO_RETAILER_ID) ?? SHOPS[0]!;
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(SHOP_STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Shop;
  } catch {
    // ignore
  }
  return fallback;
}

// Helper to read initial products
function loadInitialProducts(): Product[] {
  if (typeof window === "undefined") return INITIAL_PRODUCTS;
  try {
    const raw = localStorage.getItem(PRODUCTS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Product[];
      if (parsed.length > 0) return parsed;
    }
  } catch {
    // ignore
  }
  return INITIAL_PRODUCTS;
}

// Helper to read initial orders for this shop
function loadInitialOrders(shopId: string): Order[] {
  if (typeof window === "undefined") return INITIAL_ORDERS;
  try {
    const raw = localStorage.getItem(ORDERS_STORAGE_KEY);
    if (raw) {
      const allOrders = JSON.parse(raw) as Order[];
      const shopOrders = allOrders.filter((o) => o.shopId === shopId);
      if (shopOrders.length > 0) {
        return allOrders;
      }
      // If customer has some orders but none for this shop, combine them
      const merged = [...allOrders, ...INITIAL_ORDERS];
      localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(merged));
      return merged;
    } else {
      // First time initialization
      localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(INITIAL_ORDERS));
      return INITIAL_ORDERS;
    }
  } catch {
    // ignore
  }
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
  orders: loadInitialOrders(initialShop.id),
  loading: false,
};

const storeListeners = new Set<(s: StoreState) => void>();

function notifyStoreListeners() {
  storeListeners.forEach((l) => l(storeState));
}

export function useRetailerStore() {
  const [state, setState] = useState<StoreState>(storeState);

  useEffect(() => {
    setState(storeState);

    const listener = (next: StoreState) => {
      setState(next);
    };

    storeListeners.add(listener);

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

    window.addEventListener("storage", onStorage);
    return () => {
      storeListeners.delete(listener);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  // Filter orders strictly for this shop
  const shopOrders = state.orders.filter((o) => o.shopId === state.shop.id);

  // Update order status and sync across application
  const updateOrderStatus = useCallback(
    (orderId: string, newStatus: Order["orderStatus"], rejectionReason?: string) => {
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
      } catch (e) {
        console.error("Failed to save orders:", e);
      }
      notifyStoreListeners();
    },
    [],
  );

  // Add a new product to the shop
  const addProduct = useCallback(
    (productData: Omit<Product, "id" | "shopId" | "createdAt" | "updatedAt">) => {
      const now = new Date().toISOString();
      const newProduct: Product = {
        ...productData,
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
    },
    [],
  );

  // Update product details
  const updateProduct = useCallback((productId: string, updates: Partial<Product>) => {
    const now = new Date().toISOString();
    const nextProducts = storeState.products.map((p) => {
      if (p.id !== productId) return p;
      const updated = { ...p, ...updates, updatedAt: now };
      // If stock is set to 0, mark as unavailable by default unless explicitly provided
      if (updates.stock !== undefined && updates.availability === undefined) {
        if (updates.stock === 0) {
          updated.availability = false;
        } else if (!p.availability && updates.stock > 0) {
          updated.availability = true;
        }
      }
      return updated;
    });

    storeState = { ...storeState, products: nextProducts };
    try {
      localStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(nextProducts));
    } catch (e) {
      console.error("Failed to save products:", e);
    }
    notifyStoreListeners();
  }, []);

  // Delete a product
  const deleteProduct = useCallback((productId: string) => {
    const nextProducts = storeState.products.filter((p) => p.id !== productId);
    storeState = { ...storeState, products: nextProducts };
    try {
      localStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(nextProducts));
    } catch (e) {
      console.error("Failed to save products:", e);
    }
    notifyStoreListeners();
  }, []);

  // Toggle availability shortcut
  const toggleAvailability = useCallback(
    (productId: string, currentAvailability?: boolean) => {
      const product = storeState.products.find((p) => p.id === productId);
      if (!product) return;
      const nextAvail =
        currentAvailability !== undefined ? !currentAvailability : !product.availability;
      updateProduct(productId, { availability: nextAvail });
    },
    [updateProduct],
  );

  // Update stock shortcut
  const updateStock = useCallback(
    (productId: string, newStock: number) => {
      updateProduct(productId, {
        stock: Math.max(0, newStock),
        availability: newStock > 0,
      });
    },
    [updateProduct],
  );

  // Update shop details
  const updateShop = useCallback((updates: Partial<Shop>) => {
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
  }, []);

  const openShop = useCallback(() => {
    updateShop({ status: "ACTIVE" });
  }, [updateShop]);

  const closeShop = useCallback(() => {
    updateShop({ status: "INACTIVE" });
  }, [updateShop]);

  return {
    shop: state.shop,
    products: state.products,
    orders: shopOrders,
    loading: state.loading,
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
