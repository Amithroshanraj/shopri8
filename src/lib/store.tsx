import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Address, Order } from "./types";
import { DEMO_CENTER } from "@/data/demo";
import { announceOrdersUpdated, ORDERS_STORAGE_KEY, ORDERS_UPDATED_EVENT } from "./orderSync";
import { isBrowser, isFirebaseActive } from "./firebase";
import { addressRepository, orderRepository } from "./repositories";
import { useFirebaseAuthSession } from "./auth";

/**
 * On-device store for addresses and orders while Firebase is not connected.
 * Orders placed here are Cash on Delivery only — no payment is ever simulated.
 */
function useLocalList<T>(key: string) {
  const [items, setItems] = useState<T[]>([]);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) setItems(JSON.parse(raw) as T[]);
    } catch {
      /* ignore */
    }
    setReady(true);
    const syncItems = () => {
      try {
        const raw = localStorage.getItem(key);
        setItems(raw ? (JSON.parse(raw) as T[]) : []);
      } catch {
        setItems([]);
      }
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === key) syncItems();
    };
    const onOrdersUpdated = () => {
      if (key === ORDERS_STORAGE_KEY) syncItems();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(ORDERS_UPDATED_EVENT, onOrdersUpdated);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(ORDERS_UPDATED_EVENT, onOrdersUpdated);
    };
  }, [key]);
  const save = useCallback(
    (updater: (prev: T[]) => T[]) => {
      setItems((prev) => {
        const next = updater(prev);
        localStorage.setItem(key, JSON.stringify(next));
        if (key === ORDERS_STORAGE_KEY) announceOrdersUpdated();
        return next;
      });
    },
    [key],
  );
  return { items, ready, save };
}

export function useAddresses() {
  const { items, ready, save } = useLocalList<Address>("shopri8.addresses.v1");
  const auth = useFirebaseAuthSession();
  const queryClient = useQueryClient();
  const uid =
    auth.identity?.capabilities.includes("customer") && auth.identity.status === "active"
      ? auth.identity.uid
      : undefined;
  const firebaseAddresses = useQuery({
    queryKey: ["addresses", uid ?? ""],
    queryFn: async () => {
      if (!uid) return [];
      const result = await addressRepository.listForUser(uid);
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
    enabled: isFirebaseActive && isBrowser && !!uid,
  });
  const add = async (
    a: Omit<Address, "id" | "userId" | "latitude" | "longitude" | "createdAt" | "updatedAt">,
    location?: Pick<Address, "latitude" | "longitude">,
  ) => {
    if (isFirebaseActive) {
      if (!uid) throw new Error("Sign in with a customer account to save an address.");
      if (
        !location ||
        !Number.isFinite(location.latitude) ||
        !Number.isFinite(location.longitude)
      ) {
        throw new Error("Select a valid delivery location before saving the address.");
      }
      const existing = firebaseAddresses.data ?? [];
      const makeDefault = a.isDefault || existing.length === 0;
      const address: Omit<Address, "id"> = {
        ...a,
        userId: uid,
        latitude: location.latitude,
        longitude: location.longitude,
        isDefault: makeDefault,
      };
      const result = await addressRepository.save(address);
      if (!result.ok) throw new Error(result.message);
      if (makeDefault) {
        await Promise.all(
          existing.map((entry) =>
            addressRepository.update(entry.id, { isDefault: false }).then((updated) => {
              if (!updated.ok) throw new Error(updated.message);
            }),
          ),
        );
      }
      await queryClient.invalidateQueries({ queryKey: ["addresses", uid] });
      return;
    }
    save((prev) => {
      const id = `addr-${Date.now()}`;
      const makeDefault = a.isDefault || prev.length === 0;
      const base = makeDefault ? prev.map((x) => ({ ...x, isDefault: false })) : prev;
      const now = new Date().toISOString();
      return [
        ...base,
        {
          ...a,
          id,
          userId: "local",
          isDefault: makeDefault,
          latitude: location?.latitude ?? DEMO_CENTER.latitude,
          longitude: location?.longitude ?? DEMO_CENTER.longitude,
          createdAt: now,
          updatedAt: now,
        },
      ];
    });
  };
  const remove = (id: string) =>
    isFirebaseActive
      ? (async () => {
          if (!uid) throw new Error("Sign in with a customer account to remove an address.");
          const result = await addressRepository.remove(id);
          if (!result.ok) throw new Error(result.message);
          await queryClient.invalidateQueries({ queryKey: ["addresses", uid] });
        })()
      : save((prev) => {
          const next = prev.filter((x) => x.id !== id);
          if (next.length && !next.some((x) => x.isDefault))
            next[0] = { ...next[0]!, isDefault: true };
          return next;
        });
  const setDefault = (id: string) =>
    isFirebaseActive
      ? (async () => {
          if (!uid) throw new Error("Sign in with a customer account to update an address.");
          const results = await Promise.all(
            (firebaseAddresses.data ?? []).map((entry) =>
              addressRepository.update(entry.id, { isDefault: entry.id === id }),
            ),
          );
          const failure = results.find((result) => !result.ok);
          if (failure && !failure.ok) throw new Error(failure.message);
          await queryClient.invalidateQueries({ queryKey: ["addresses", uid] });
        })()
      : save((prev) => prev.map((x) => ({ ...x, isDefault: x.id === id })));
  const update = (id: string, updates: Partial<Omit<Address, "id" | "userId" | "createdAt">>) =>
    isFirebaseActive
      ? (async () => {
          if (!uid) throw new Error("Sign in with a customer account to update an address.");
          const result = await addressRepository.update(id, updates);
          if (!result.ok) throw new Error(result.message);
          if (updates.isDefault) {
            await setDefault(id);
            return;
          }
          await queryClient.invalidateQueries({ queryKey: ["addresses", uid] });
        })()
      : save((prev) => {
          const makeDefault = updates.isDefault;
          const base = makeDefault ? prev.map((x) => ({ ...x, isDefault: false })) : prev;
          return base.map((x) =>
            x.id === id ? { ...x, ...updates, updatedAt: new Date().toISOString() } : x,
          );
        });
  return {
    addresses: isFirebaseActive ? (firebaseAddresses.data ?? []) : items,
    ready: isFirebaseActive ? firebaseAddresses.isSuccess : ready,
    error: isFirebaseActive ? (firebaseAddresses.error?.message ?? null) : null,
    add,
    remove,
    setDefault,
    update,
  };
}

export function useOrders() {
  const { items, ready, save } = useLocalList<Order>("shopri8.orders.v1");
  const auth = useFirebaseAuthSession();
  const queryClient = useQueryClient();
  const uid =
    auth.identity?.capabilities.includes("customer") && auth.identity.status === "active"
      ? auth.identity.uid
      : undefined;
  const orderQueryKey = useMemo(() => ["orders", "customer", uid ?? ""] as const, [uid]);
  const [firebaseLiveError, setFirebaseLiveError] = useState<string | null>(null);
  const firebaseOrders = useQuery({
    queryKey: orderQueryKey,
    queryFn: async () => {
      if (!uid) return [];
      const result = await orderRepository.listForCustomer(uid);
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
    enabled: isFirebaseActive && isBrowser && !!uid,
  });
  useEffect(() => {
    setFirebaseLiveError(null);
    if (!isFirebaseActive || !isBrowser || !uid) return;
    return orderRepository.subscribeForCustomer(
      uid,
      (orders) => {
        setFirebaseLiveError(null);
        void queryClient.cancelQueries({ queryKey: orderQueryKey, exact: true });
        queryClient.setQueryData(orderQueryKey, orders);
      },
      (error) => setFirebaseLiveError(error.message),
    );
  }, [uid, orderQueryKey, queryClient]);
  const place = (o: Order) => save((prev) => [o, ...prev]);
  const placeFirebaseOrder = async (input: {
    shopId: string;
    deliveryAddressId: string;
    items: { productId: string; quantity: number }[];
  }) => {
    if (!isFirebaseActive || !uid) throw new Error("Sign in with a customer account to check out.");
    const result = await orderRepository.placeCustomerOrder({
      ...input,
      customerId: uid,
      paymentMethod: "COD",
    });
    if (!result.ok) throw new Error(result.message);
    await queryClient.invalidateQueries({ queryKey: orderQueryKey });
    return result.data;
  };
  const cancel = async (id: string) => {
    if (isFirebaseActive) {
      const order = firebaseOrders.data?.find((entry) => entry.id === id);
      if (!order) throw new Error("This order could not be found.");
      const result = await orderRepository.cancel(order);
      if (!result.ok) throw new Error(result.message);
      await queryClient.invalidateQueries({ queryKey: orderQueryKey });
      return;
    }
    save((prev) =>
      prev.map((o) =>
        o.id === id
          ? {
              ...o,
              orderStatus: "CANCELLED",
              paymentStatus: "CANCELLED",
              statusHistory: [
                ...o.statusHistory,
                { status: "CANCELLED", at: new Date().toISOString() },
              ],
            }
          : o,
      ),
    );
  };
  return {
    orders: isFirebaseActive ? (firebaseOrders.data ?? []) : items,
    ready: isFirebaseActive ? firebaseOrders.isSuccess : ready,
    error: isFirebaseActive ? (firebaseOrders.error?.message ?? firebaseLiveError) : null,
    place,
    placeFirebaseOrder,
    cancel,
  };
}
