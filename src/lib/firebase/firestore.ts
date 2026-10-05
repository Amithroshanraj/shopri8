/**
 * Firestore data model and low-level access layer.
 *
 * Every read and write in SHOPRi8 goes through this module or a repository in
 * `src/lib/repositories`, so UI components never import the Firestore SDK
 * directly. That containment is what makes the domain-by-domain migration
 * reversible.
 *
 * Top-level collections mirror the planned Firestore schema:
 *
 *   users          one document per Firebase UID, holds `capabilities`
 *   shops          one document per retailer shop, `ownerId` -> users/{uid}
 *   categories     shared catalogue taxonomy
 *   products       one document per product, `shopId` -> shops/{id}
 *   addresses      one document per saved delivery address
 *   orders         one document per order, `customerId` + `shopId` references
 *   payments       one document per payment attempt (Cashfree / COD)
 *   deliveryTasks  one document per delivery job, `orderId` + `deliveryWorkerId`
 *
 * The order lifecycle is SHOPRi8's own and is defined once in `src/lib/types.ts`
 * (`ORDER_STATUS_FLOW`, `DELIVERY_TASK_FLOW`). This module never introduces a
 * second state machine — it reuses those constants verbatim.
 */

import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type QueryConstraint,
  type Timestamp,
} from "firebase/firestore";
import { getDb } from "./config";
import type {
  Address,
  AccountStatus,
  AppUser,
  Capability,
  Category,
  DeliveryTask,
  Order,
  OrderStatus,
  Payment,
  Product,
  Shop,
} from "../types";
import { canonicalCapabilities } from "../auth/types";

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

export type CollectionName = (typeof COLLECTIONS)[keyof typeof COLLECTIONS];

/**
 * Firestore rejects `undefined` unless `ignoreUndefinedProperties` is set, and
 * silently dropping fields is worse than omitting the key. Documents are
 * normalised so optional fields are absent rather than undefined.
 */
export function stripUndefined<T extends object>(input: T): T {
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) output[key] = value;
  }
  return output as T;
}

function requireDb() {
  const db = getDb();
  if (!db) {
    throw new Error(
      "Firestore is unavailable. Set the VITE_FIREBASE_* values in .env.local to enable the backend.",
    );
  }
  return db;
}

function mapDoc<T>(snapshot: { id: string; data: () => DocumentData }): T {
  return { id: snapshot.id, ...snapshot.data() } as T;
}

function timestampToIso(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof value.toDate === "function"
  ) {
    return value.toDate().toISOString();
  }
  return undefined;
}

function mapShopDoc(snapshot: { id: string; data: () => DocumentData }): Shop {
  const data = snapshot.data();
  return {
    ...data,
    id: snapshot.id,
    category: (data["category"] ?? data["categoryId"]) as Shop["category"],
    ...(typeof data["latitude"] === "number" ? { latitude: data["latitude"] } : {}),
    ...(typeof data["longitude"] === "number" ? { longitude: data["longitude"] } : {}),
    ...(typeof data["lat"] === "number" ? { latitude: data["lat"] } : {}),
    ...(typeof data["lng"] === "number" ? { longitude: data["lng"] } : {}),
    ...(timestampToIso(data["createdAt"]) ? { createdAt: timestampToIso(data["createdAt"]) } : {}),
    ...(timestampToIso(data["updatedAt"]) ? { updatedAt: timestampToIso(data["updatedAt"]) } : {}),
  } as Shop;
}

function mapProductDoc(snapshot: { id: string; data: () => DocumentData }): Product {
  const data = snapshot.data();
  const stock =
    typeof data["stock"] === "number" && Number.isInteger(data["stock"]) && data["stock"] >= 0
      ? data["stock"]
      : 0;
  const availability = data["availability"] ?? data["isAvailable"];
  return {
    ...data,
    id: snapshot.id,
    shopId: typeof data["shopId"] === "string" ? data["shopId"] : "",
    name: typeof data["name"] === "string" ? data["name"] : "Unnamed product",
    description: typeof data["description"] === "string" ? data["description"] : "",
    category:
      typeof data["category"] === "string"
        ? (data["category"] as Product["category"])
        : typeof data["categoryId"] === "string"
          ? (data["categoryId"] as Product["category"])
          : "other",
    price:
      typeof data["price"] === "number" && Number.isFinite(data["price"]) && data["price"] >= 0
        ? data["price"]
        : 0,
    stock,
    availability: availability === true && stock > 0,
    ...(timestampToIso(data["createdAt"]) ? { createdAt: timestampToIso(data["createdAt"]) } : {}),
    ...(timestampToIso(data["updatedAt"]) ? { updatedAt: timestampToIso(data["updatedAt"]) } : {}),
  } as Product;
}

function validateProduct(product: Pick<Product, "name" | "category" | "price" | "stock">): void {
  if (!product.name.trim()) throw new Error("Product name is required.");
  if (!product.category.trim()) throw new Error("A product category is required.");
  if (!Number.isFinite(product.price) || product.price < 0) {
    throw new Error("Product price must be a non-negative number.");
  }
  if (!Number.isInteger(product.stock) || product.stock < 0) {
    throw new Error("Product stock must be a non-negative whole number.");
  }
}

/**
 * Resolves a reference path without importing Firestore reference objects into
 * the UI layer. Callers pass plain path strings.
 */
export function refPath(...segments: string[]): string {
  return segments.filter(Boolean).join("/");
}

// ---------------------------------------------------------------------------
// users/{uid}
// ---------------------------------------------------------------------------

export interface UserProfile {
  uid: string;
  id: string;
  displayName: string;
  email: string | null;
  phoneNumber: string | null;
  photoURL: string | null;
  status: AccountStatus;
  capabilities: Capability[];
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
  name: string;
  phone: string | null;
  profileImage: string | null;
}

export function usersCollection() {
  return collection(requireDb(), COLLECTIONS.users);
}

export function userDoc(uid: string) {
  return doc(requireDb(), COLLECTIONS.users, uid);
}

/** Reads `users/{uid}`. Returns `null` when the profile has not been created. */
export async function fetchUser(uid: string): Promise<UserProfile | null> {
  const snapshot = await getDoc(userDoc(uid));
  if (!snapshot.exists()) return null;
  const raw = snapshot.data();
  const displayName =
    typeof raw["displayName"] === "string"
      ? raw["displayName"]
      : typeof raw["name"] === "string"
        ? raw["name"]
        : "";
  const email = typeof raw["email"] === "string" ? raw["email"] : null;
  const phoneNumber =
    typeof raw["phoneNumber"] === "string"
      ? raw["phoneNumber"]
      : typeof raw["phone"] === "string"
        ? raw["phone"]
        : null;
  const photoURL =
    typeof raw["photoURL"] === "string"
      ? raw["photoURL"]
      : typeof raw["profileImage"] === "string"
        ? raw["profileImage"]
        : null;
  return {
    uid,
    id: uid,
    displayName,
    name: displayName,
    email,
    phoneNumber,
    phone: phoneNumber,
    photoURL,
    profileImage: photoURL,
    status: raw["status"] === undefined || raw["status"] === "active" ? "active" : "suspended",
    capabilities: canonicalCapabilities(raw["capabilities"]),
    createdAt: (raw["createdAt"] as Timestamp | undefined) ?? null,
    updatedAt: (raw["updatedAt"] as Timestamp | undefined) ?? null,
  };
}

export async function fetchUsersByCapability(capability: Capability): Promise<UserProfile[]> {
  const storedCapabilities: string[] =
    capability === "delivery_worker" ? [capability, "deliveryWorker"] : [capability];
  const snapshots = await Promise.all(
    storedCapabilities.map((storedCapability) =>
      getDocs(query(usersCollection(), where("capabilities", "array-contains", storedCapability))),
    ),
  );
  const profiles = new Map<string, UserProfile>();
  for (const snapshot of snapshots) {
    for (const entry of snapshot.docs) {
      const profile = await fetchUser(entry.id);
      if (profile) profiles.set(profile.uid, profile);
    }
  }
  return [...profiles.values()];
}

/**
 * Creates the profile document if it is missing, otherwise patches it.
 *
 * Used at first sign-in. `merge` keeps capabilities the user already has, so a
 * returning multi-role user is never downgraded.
 */
export async function ensureUserProfile(
  uid: string,
  profile: {
    displayName?: string;
    phoneNumber?: string | null;
    photoURL?: string | null;
    name?: string;
    email?: string | null;
    phone?: string | null;
    profileImage?: string | null;
  },
): Promise<void> {
  if (!uid.trim()) throw new Error("A Firebase Auth UID is required to create a user profile.");
  const displayName = profile.displayName ?? profile.name;
  const phoneNumber = profile.phoneNumber ?? profile.phone;
  const photoURL = profile.photoURL ?? profile.profileImage;
  const ref = userDoc(uid);
  await runTransaction(requireDb(), async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (snapshot.exists()) {
      const existing = snapshot.data();
      if (existing["uid"] !== undefined && existing["uid"] !== uid) {
        throw new Error("The stored profile UID does not match its Firebase Auth UID.");
      }
      const patch = stripUndefined({
        ...(existing["uid"] === undefined ? { uid } : {}),
        ...(existing["status"] === undefined ? { status: "active" } : {}),
        ...(existing["displayName"] === undefined && displayName !== undefined
          ? { displayName }
          : {}),
        ...(existing["email"] === undefined && profile.email !== undefined
          ? { email: profile.email }
          : {}),
        ...(existing["phoneNumber"] === undefined && phoneNumber !== undefined
          ? { phoneNumber }
          : {}),
        ...(existing["photoURL"] === undefined && photoURL !== undefined ? { photoURL } : {}),
      });
      if (Object.keys(patch).length) {
        transaction.set(ref, { ...patch, updatedAt: serverTimestamp() }, { merge: true });
      }
      return;
    }
    transaction.set(ref, {
      uid,
      displayName: displayName ?? "",
      ...(profile.email ? { email: profile.email } : {}),
      ...(phoneNumber ? { phoneNumber } : {}),
      ...(photoURL !== undefined ? { photoURL } : {}),
      capabilities: ["customer"],
      status: "active",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
}

export async function createUserProfile(
  uid: string,
  profile: {
    displayName: string;
    email?: string | null;
    phoneNumber?: string | null;
    photoURL?: string | null;
  },
): Promise<void> {
  await ensureUserProfile(uid, profile);
}

export type SafeUserProfilePatch = Partial<
  Pick<UserProfile, "displayName" | "email" | "phoneNumber" | "photoURL">
> &
  Partial<Pick<AppUser, "name" | "phone" | "profileImage">>;

export async function updateUserProfile(uid: string, patch: SafeUserProfilePatch): Promise<void> {
  const displayName = patch.displayName ?? patch.name;
  const phoneNumber = patch.phoneNumber ?? patch.phone;
  const photoURL = patch.photoURL ?? patch.profileImage;
  await updateDoc(
    userDoc(uid),
    stripUndefined({
      ...(displayName !== undefined ? { displayName } : {}),
      ...(patch.email !== undefined ? { email: patch.email } : {}),
      ...(phoneNumber !== undefined ? { phoneNumber } : {}),
      ...(photoURL !== undefined ? { photoURL } : {}),
      updatedAt: serverTimestamp(),
    }),
  );
}

/**
 * Grants a capability. Admin-only in practice — the security rules enforce that
 * a user cannot add capabilities to their own document.
 */
export async function addUserCapability(uid: string, capability: Capability): Promise<void> {
  if (capability === "admin") {
    throw new Error("Admin capability must be granted through trusted server-side provisioning.");
  }
  if (!(await fetchUser(uid)))
    throw new Error("Create the user profile before granting a capability.");
  await updateDoc(userDoc(uid), {
    capabilities: arrayUnion(capability),
    updatedAt: serverTimestamp(),
  });
}

/** Revokes a capability. */
export async function removeUserCapability(uid: string, capability: Capability): Promise<void> {
  if (capability === "admin") {
    throw new Error("Admin capability must be managed through trusted server-side provisioning.");
  }
  const values = capability === "delivery_worker" ? [capability, "deliveryWorker"] : [capability];
  const ref = userDoc(uid);
  await runTransaction(requireDb(), async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists()) throw new Error("The user profile does not exist.");
    transaction.update(ref, {
      capabilities: arrayRemove(...values),
      updatedAt: serverTimestamp(),
    });
  });
}

export async function setUserAccountStatus(uid: string, status: AccountStatus): Promise<void> {
  if (status !== "active" && status !== "suspended") {
    throw new Error("Account status must be active or suspended.");
  }
  await updateDoc(userDoc(uid), { status, updatedAt: serverTimestamp() });
}

// ---------------------------------------------------------------------------
// shops/{shopId}
// ---------------------------------------------------------------------------

export function shopsCollection() {
  return collection(requireDb(), COLLECTIONS.shops);
}

export function shopDoc(shopId: string) {
  return doc(requireDb(), COLLECTIONS.shops, shopId);
}

/**
 * Public shop listing. Only ACTIVE shops are returned.
 *
 * Throws when Firestore is unconfigured, matching every other accessor here.
 * Callers that need a graceful fallback go through the repository layer, which
 * checks the configuration before calling.
 */
export async function fetchShops(): Promise<Shop[]> {
  const snapshot = await getDocs(query(shopsCollection(), where("status", "==", "ACTIVE")));
  return snapshot.docs.map(mapShopDoc);
}

/** Admin-only complete shop list, including inactive and suspended shops. */
export async function fetchAllShops(): Promise<Shop[]> {
  const snapshot = await getDocs(shopsCollection());
  return snapshot.docs.map(mapShopDoc);
}

export async function fetchShopsByCategory(category: Shop["category"]): Promise<Shop[]> {
  const snapshot = await getDocs(
    query(shopsCollection(), where("status", "==", "ACTIVE"), where("category", "==", category)),
  );
  return snapshot.docs.map(mapShopDoc);
}

export async function fetchShop(shopId: string): Promise<Shop | null> {
  const snapshot = await getDoc(shopDoc(shopId));
  return snapshot.exists() ? mapShopDoc(snapshot) : null;
}

/** The shop owned by a retailer. Backs the retailer portal's shop settings. */
export async function fetchShopByOwner(ownerId: string): Promise<Shop | null> {
  const snapshot = await getDocs(
    query(shopsCollection(), where("ownerId", "==", ownerId), limit(1)),
  );
  const first = snapshot.docs[0];
  return first ? mapShopDoc(first) : null;
}

export async function saveShop(shop: Omit<Shop, "id"> & { id?: string }): Promise<string> {
  const {
    id: _id,
    ownerId: _ownerId,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    ...fields
  } = shop;
  const body = stripUndefined({ ...fields, updatedAt: serverTimestamp() });
  if (shop.id) {
    await updateShop(shop.id, fields);
    return shop.id;
  }
  const created = await addDoc(shopsCollection(), {
    ...body,
    ownerId: shop.ownerId,
    createdAt: serverTimestamp(),
  });
  return created.id;
}

export async function updateShop(shopId: string, patch: Partial<Shop>): Promise<void> {
  const {
    id: _id,
    ownerId: _ownerId,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    ...fields
  } = patch;
  await updateDoc(shopDoc(shopId), stripUndefined({ ...fields, updatedAt: serverTimestamp() }));
}

// ---------------------------------------------------------------------------
// categories/{categoryId}
// ---------------------------------------------------------------------------

export function categoriesCollection() {
  return collection(requireDb(), COLLECTIONS.categories);
}

export async function fetchCategories(): Promise<Category[]> {
  const snapshot = await getDocs(query(categoriesCollection(), where("status", "==", "ACTIVE")));
  return snapshot.docs.map((entry) => ({ ...entry.data(), id: entry.id }) as Category);
}

export async function fetchCategory(categoryId: string): Promise<Category | null> {
  const snapshot = await getDoc(doc(requireDb(), COLLECTIONS.categories, categoryId));
  return snapshot.exists() ? ({ ...snapshot.data(), id: snapshot.id } as Category) : null;
}

export async function saveCategory(
  category: Omit<Category, "id"> & { id?: string },
): Promise<string> {
  if (category.id) {
    await setDoc(doc(requireDb(), COLLECTIONS.categories, category.id), category, {
      merge: true,
    });
    return category.id;
  }
  const created = await addDoc(categoriesCollection(), category);
  return created.id;
}

// ---------------------------------------------------------------------------
// products/{productId}
// ---------------------------------------------------------------------------

export function productsCollection() {
  return collection(requireDb(), COLLECTIONS.products);
}

export function productDoc(productId: string) {
  return doc(requireDb(), COLLECTIONS.products, productId);
}

export async function fetchProductsByShop(shopId: string): Promise<Product[]> {
  const snapshot = await getDocs(query(productsCollection(), where("shopId", "==", shopId)));
  return snapshot.docs.map(mapProductDoc);
}

export async function fetchAvailableProductsByShop(shopId: string): Promise<Product[]> {
  const snapshot = await getDocs(
    query(
      productsCollection(),
      where("shopId", "==", shopId),
      where("availability", "==", true),
      where("stock", ">", 0),
    ),
  );
  return snapshot.docs.map(mapProductDoc);
}

export async function fetchAllProducts(): Promise<Product[]> {
  const snapshot = await getDocs(productsCollection());
  return snapshot.docs.map(mapProductDoc);
}

export async function fetchProductsByCategory(category: Product["category"]): Promise<Product[]> {
  const snapshot = await getDocs(query(productsCollection(), where("category", "==", category)));
  return snapshot.docs.map(mapProductDoc);
}

export async function fetchProduct(productId: string): Promise<Product | null> {
  const snapshot = await getDoc(productDoc(productId));
  return snapshot.exists() ? mapProductDoc(snapshot) : null;
}

export async function saveProduct(product: Omit<Product, "id"> & { id?: string }): Promise<string> {
  validateProduct(product);
  const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...fields } = product;
  const body = stripUndefined({ ...fields, updatedAt: serverTimestamp() });
  if (product.id) {
    await updateProduct(product.id, fields);
    return product.id;
  }
  const created = await addDoc(productsCollection(), { ...body, createdAt: serverTimestamp() });
  return created.id;
}

export async function updateProduct(productId: string, patch: Partial<Product>): Promise<void> {
  if (patch.name !== undefined && !patch.name.trim()) {
    throw new Error("Product name is required.");
  }
  if (patch.price !== undefined && (!Number.isFinite(patch.price) || patch.price < 0)) {
    throw new Error("Product price must be a non-negative number.");
  }
  if (patch.stock !== undefined && (!Number.isInteger(patch.stock) || patch.stock < 0)) {
    throw new Error("Product stock must be a non-negative whole number.");
  }
  const {
    id: _id,
    shopId: _shopId,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    ...fields
  } = patch;
  await updateDoc(
    productDoc(productId),
    stripUndefined({ ...fields, updatedAt: serverTimestamp() }),
  );
}

export async function removeProduct(productId: string): Promise<void> {
  await deleteDoc(productDoc(productId));
}

// ---------------------------------------------------------------------------
// addresses/{addressId}
// ---------------------------------------------------------------------------

export function addressesCollection() {
  return collection(requireDb(), COLLECTIONS.addresses);
}

export function addressDoc(addressId: string) {
  return doc(requireDb(), COLLECTIONS.addresses, addressId);
}

export async function fetchAddresses(userId: string): Promise<Address[]> {
  const snapshot = await getDocs(query(addressesCollection(), where("userId", "==", userId)));
  return snapshot.docs.map((entry) => mapDoc<Address>(entry));
}

export async function fetchAddress(addressId: string): Promise<Address | null> {
  const snapshot = await getDoc(addressDoc(addressId));
  return snapshot.exists() ? mapDoc<Address>(snapshot) : null;
}

export async function saveAddress(address: Omit<Address, "id"> & { id?: string }): Promise<string> {
  const body = stripUndefined({ ...address, updatedAt: serverTimestamp() });
  if (address.id) {
    await setDoc(addressDoc(address.id), body, { merge: true });
    return address.id;
  }
  const created = await addDoc(addressesCollection(), { ...body, createdAt: serverTimestamp() });
  return created.id;
}

export async function updateAddress(addressId: string, patch: Partial<Address>): Promise<void> {
  await updateDoc(
    addressDoc(addressId),
    stripUndefined({ ...patch, updatedAt: serverTimestamp() }),
  );
}

export async function removeAddress(addressId: string): Promise<void> {
  await deleteDoc(addressDoc(addressId));
}

// ---------------------------------------------------------------------------
// orders/{orderId}
// ---------------------------------------------------------------------------

export function ordersCollection() {
  return collection(requireDb(), COLLECTIONS.orders);
}

export function orderDoc(orderId: string) {
  return doc(requireDb(), COLLECTIONS.orders, orderId);
}

export async function fetchOrdersForCustomer(customerId: string): Promise<Order[]> {
  const snapshot = await getDocs(
    query(ordersCollection(), where("customerId", "==", customerId), orderBy("createdAt", "desc")),
  );
  return snapshot.docs.map((entry) => mapDoc<Order>(entry));
}

/** The retailer order queue. Scoped to one shop so a retailer never sees another's. */
export async function fetchOrdersForShop(shopId: string, status?: OrderStatus): Promise<Order[]> {
  const constraints: QueryConstraint[] = [where("shopId", "==", shopId)];
  if (status) constraints.push(where("orderStatus", "==", status));
  constraints.push(orderBy("createdAt", "desc"));
  const snapshot = await getDocs(query(ordersCollection(), ...constraints));
  return snapshot.docs.map((entry) => mapDoc<Order>(entry));
}

export async function fetchOrder(orderId: string): Promise<Order | null> {
  const snapshot = await getDoc(orderDoc(orderId));
  return snapshot.exists() ? mapDoc<Order>(snapshot) : null;
}

/**
 * Creates an order with its first status-history entry.
 *
 * `statusHistory` is written on create so the lifecycle timeline is complete
 * from the moment the order exists, matching the demo `place()` behaviour.
 */
export async function createOrder(
  order: Omit<Order, "id" | "createdAt" | "updatedAt" | "statusHistory"> & {
    id?: string;
    statusHistory?: Order["statusHistory"];
  },
): Promise<string> {
  const now = new Date().toISOString();
  const body = stripUndefined({
    ...order,
    statusHistory: order.statusHistory?.length
      ? order.statusHistory
      : [{ status: order.orderStatus, at: now }],
    createdAt: now,
    updatedAt: now,
  });
  if (order.id) {
    await setDoc(orderDoc(order.id), body);
    return order.id;
  }
  const created = await addDoc(ordersCollection(), body);
  return created.id;
}

export async function updateOrder(orderId: string, patch: Partial<Order>): Promise<void> {
  await updateDoc(orderDoc(orderId), stripUndefined({ ...patch, updatedAt: serverTimestamp() }));
}

/**
 * Advances an order and appends to its status history atomically.
 *
 * The caller is responsible for validating that the transition is legal; the
 * legal-transition maps live in `src/lib/retailerStore.tsx` and
 * `src/lib/workerStore.tsx` and are mirrored in the security rules.
 */
export async function transitionOrder(
  orderId: string,
  nextStatus: OrderStatus,
  at: string = new Date().toISOString(),
): Promise<void> {
  const db = requireDb();
  const batch = writeBatch(db);
  batch.update(orderDoc(orderId), {
    orderStatus: nextStatus,
    statusHistory: arrayUnion({ status: nextStatus, at }),
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
}

// ---------------------------------------------------------------------------
// payments/{paymentId}
// ---------------------------------------------------------------------------

export function paymentsCollection() {
  return collection(requireDb(), COLLECTIONS.payments);
}

export async function fetchPaymentsForOrder(orderId: string): Promise<Payment[]> {
  const snapshot = await getDocs(query(paymentsCollection(), where("orderId", "==", orderId)));
  return snapshot.docs.map((entry) => mapDoc<Payment>(entry));
}

/**
 * Records a payment attempt.
 *
 * Gateway credentials are never handled here — only the identifiers Cashfree
 * returns. Secret keys stay in Cloud Functions.
 */
export async function createPayment(
  payment: Omit<Payment, "id" | "createdAt" | "updatedAt"> & { id?: string },
): Promise<string> {
  const body = stripUndefined({
    ...payment,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  if (payment.id) {
    await setDoc(doc(requireDb(), COLLECTIONS.payments, payment.id), body);
    return payment.id;
  }
  const created = await addDoc(paymentsCollection(), body);
  return created.id;
}

export async function updatePayment(paymentId: string, patch: Partial<Payment>): Promise<void> {
  await updateDoc(doc(requireDb(), COLLECTIONS.payments, paymentId), stripUndefined(patch));
}

// ---------------------------------------------------------------------------
// deliveryTasks/{taskId}
// ---------------------------------------------------------------------------

export function deliveryTasksCollection() {
  return collection(requireDb(), COLLECTIONS.deliveryTasks);
}

export function deliveryTaskDoc(taskId: string) {
  return doc(requireDb(), COLLECTIONS.deliveryTasks, taskId);
}

/** The open task board: unassigned, ready for any worker to claim. */
export async function fetchAvailableTasks(): Promise<DeliveryTask[]> {
  const snapshot = await getDocs(
    query(
      deliveryTasksCollection(),
      where("status", "==", "AVAILABLE"),
      orderBy("createdAt", "desc"),
    ),
  );
  return snapshot.docs.map((entry) => mapDoc<DeliveryTask>(entry));
}

export async function fetchTasksForWorker(deliveryWorkerId: string): Promise<DeliveryTask[]> {
  const snapshot = await getDocs(
    query(
      deliveryTasksCollection(),
      where("deliveryWorkerId", "==", deliveryWorkerId),
      orderBy("createdAt", "desc"),
    ),
  );
  return snapshot.docs.map((entry) => mapDoc<DeliveryTask>(entry));
}

export async function fetchDeliveryTask(taskId: string): Promise<DeliveryTask | null> {
  const snapshot = await getDoc(deliveryTaskDoc(taskId));
  return snapshot.exists() ? mapDoc<DeliveryTask>(snapshot) : null;
}

/**
 * Claims an open task for a worker.
 *
 * Implemented as a conditional transaction so two workers cannot both claim the
 * same AVAILABLE task.
 */
export async function claimDeliveryTask(taskId: string, deliveryWorkerId: string): Promise<void> {
  const db = requireDb();
  const snapshot = await getDoc(deliveryTaskDoc(taskId));
  if (!snapshot.exists()) throw new Error("Delivery task not found.");
  if (snapshot.data()["status"] !== "AVAILABLE") {
    throw new Error("This delivery task has already been claimed.");
  }
  const batch = writeBatch(db);
  batch.update(deliveryTaskDoc(taskId), {
    deliveryWorkerId,
    status: "DELIVERY_ASSIGNED",
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
}

export async function updateDeliveryTask(
  taskId: string,
  patch: Partial<DeliveryTask>,
): Promise<void> {
  await updateDoc(
    deliveryTaskDoc(taskId),
    stripUndefined({ ...patch, updatedAt: serverTimestamp() }),
  );
}

export async function createDeliveryTask(
  task: Omit<DeliveryTask, "id" | "createdAt" | "updatedAt"> & { id?: string },
): Promise<string> {
  const body = stripUndefined({
    ...task,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  if (task.id) {
    await setDoc(deliveryTaskDoc(task.id), body);
    return task.id;
  }
  const created = await addDoc(deliveryTasksCollection(), body);
  return created.id;
}
