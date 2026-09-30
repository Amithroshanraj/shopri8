import { useCallback, useEffect, useState } from "react";
import type { Address, Order } from "./types";
import { DEMO_CENTER } from "@/data/demo";

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
    const onStorage = (e: StorageEvent) => {
      if (e.key === key && e.newValue) setItems(JSON.parse(e.newValue) as T[]);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [key]);
  const save = useCallback(
    (updater: (prev: T[]) => T[]) => {
      setItems((prev) => {
        const next = updater(prev);
        localStorage.setItem(key, JSON.stringify(next));
        return next;
      });
    },
    [key],
  );
  return { items, ready, save };
}

export function useAddresses() {
  const { items, ready, save } = useLocalList<Address>("shopri8.addresses.v1");
  const add = (
    a: Omit<Address, "id" | "userId" | "latitude" | "longitude" | "createdAt" | "updatedAt">,
  ) =>
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
          latitude: DEMO_CENTER.latitude,
          longitude: DEMO_CENTER.longitude,
          createdAt: now,
          updatedAt: now,
        },
      ];
    });
  const remove = (id: string) =>
    save((prev) => {
      const next = prev.filter((x) => x.id !== id);
      if (next.length && !next.some((x) => x.isDefault)) next[0] = { ...next[0]!, isDefault: true };
      return next;
    });
  const setDefault = (id: string) =>
    save((prev) => prev.map((x) => ({ ...x, isDefault: x.id === id })));
  const update = (id: string, updates: Partial<Omit<Address, "id" | "userId" | "createdAt">>) =>
    save((prev) => {
      const makeDefault = updates.isDefault;
      const base = makeDefault ? prev.map((x) => ({ ...x, isDefault: false })) : prev;
      return base.map((x) =>
        x.id === id ? { ...x, ...updates, updatedAt: new Date().toISOString() } : x,
      );
    });
  return { addresses: items, ready, add, remove, setDefault, update };
}

export function useOrders() {
  const { items, ready, save } = useLocalList<Order>("shopri8.orders.v1");
  const place = (o: Order) => save((prev) => [o, ...prev]);
  const cancel = (id: string) =>
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
  return { orders: items, ready, place, cancel };
}
