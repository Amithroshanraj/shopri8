import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { getDb } from "./config";
import type { Address, Order, Product, Shop } from "../types";

/**
 * Firestore access layer. Every read/write in the app goes through here so the
 * UI never talks to Firebase directly.
 *
 * Until the Firebase web config is supplied the helpers return null/empty and
 * the UI falls back to the clearly-labelled local demo catalogue.
 */

export const COLLECTIONS = {
  users: "users",
  shops: "shops",
  categories: "categories",
  products: "products",
  addresses: "addresses",
  orders: "orders",
  payments: "payments",
  deliveryTasks: "deliveryTasks",
} as const;

export async function fetchShops(): Promise<Shop[] | null> {
  const db = getDb();
  if (!db) return null;
  const snap = await getDocs(
    query(collection(db, COLLECTIONS.shops), where("status", "==", "ACTIVE")),
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Shop);
}

export async function fetchShop(shopId: string): Promise<Shop | null> {
  const db = getDb();
  if (!db) return null;
  const snap = await getDoc(doc(db, COLLECTIONS.shops, shopId));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Shop) : null;
}

export async function fetchProductsByShop(shopId: string): Promise<Product[] | null> {
  const db = getDb();
  if (!db) return null;
  const snap = await getDocs(
    query(collection(db, COLLECTIONS.products), where("shopId", "==", shopId)),
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Product);
}

export async function fetchAddresses(userId: string): Promise<Address[] | null> {
  const db = getDb();
  if (!db) return null;
  const snap = await getDocs(
    query(collection(db, COLLECTIONS.addresses), where("userId", "==", userId)),
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Address);
}

export async function saveAddress(address: Omit<Address, "id">) {
  const db = getDb();
  if (!db) return null;
  const ref = await addDoc(collection(db, COLLECTIONS.addresses), {
    ...address,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateAddress(id: string, patch: Partial<Address>) {
  const db = getDb();
  if (!db) return;
  await updateDoc(doc(db, COLLECTIONS.addresses, id), { ...patch, updatedAt: serverTimestamp() });
}

export async function removeAddress(id: string) {
  const db = getDb();
  if (!db) return;
  await deleteDoc(doc(db, COLLECTIONS.addresses, id));
}

export async function fetchOrders(customerId: string): Promise<Order[] | null> {
  const db = getDb();
  if (!db) return null;
  const snap = await getDocs(
    query(collection(db, COLLECTIONS.orders), where("customerId", "==", customerId)),
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Order);
}
