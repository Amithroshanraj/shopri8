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
 *   payments       one trusted payment record for a demo payment
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
  deleteField,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
  type QueryConstraint,
  type Timestamp,
  type Unsubscribe,
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
  RetailerApplication,
  RetailerApplicationInput,
  RetailerApplicationStatus,
  Shop,
} from "../types";
import { STANDARD_DELIVERY_FEE } from "../types";
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
  retailerApplications: "retailerApplications",
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

function mapOrderDoc(snapshot: { id: string; data: () => DocumentData }): Order {
  const data = snapshot.data();
  return {
    ...data,
    id: snapshot.id,
    createdAt: timestampToIso(data["createdAt"]) ?? "",
    updatedAt: timestampToIso(data["updatedAt"]) ?? "",
  } as Order;
}

function mapDeliveryTaskDoc(snapshot: { id: string; data: () => DocumentData }): DeliveryTask {
  const data = snapshot.data();
  const timestampFields = [
    "createdAt",
    "updatedAt",
    "assignedAt",
    "pickedUpAt",
    "outForDeliveryAt",
    "deliveredAt",
    "failedAt",
  ] as const;
  const timestamps = Object.fromEntries(
    timestampFields.flatMap((field) => {
      const timestamp = timestampToIso(data[field]);
      return timestamp ? [[field, timestamp]] : [];
    }),
  );
  return {
    ...data,
    id: snapshot.id,
    ...timestamps,
  } as DeliveryTask;
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
  available?: boolean;
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
  return mapUserProfile(uid, snapshot.data());
}

export function subscribeToUser(
  uid: string,
  onNext: (profile: UserProfile | null) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    userDoc(uid),
    (snapshot) => onNext(snapshot.exists() ? mapUserProfile(uid, snapshot.data()) : null),
    onError,
  );
}

function mapUserProfile(uid: string, raw: DocumentData): UserProfile {
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
    ...(typeof raw["available"] === "boolean" ? { available: raw["available"] } : {}),
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
      const profile = mapUserProfile(entry.id, entry.data());
      profiles.set(profile.uid, profile);
    }
  }
  return [...profiles.values()];
}

export function subscribeToUsersByCapability(
  capability: Capability,
  onNext: (profiles: UserProfile[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  const storedCapabilities =
    capability === "delivery_worker" ? [capability, "deliveryWorker"] : [capability];
  const snapshotsByCapability = new Map<string, UserProfile[]>();
  const unsubscribers = storedCapabilities.map((storedCapability) =>
    onSnapshot(
      query(usersCollection(), where("capabilities", "array-contains", storedCapability)),
      (snapshot) => {
        snapshotsByCapability.set(
          storedCapability,
          snapshot.docs.map((entry) => mapUserProfile(entry.id, entry.data())),
        );
        const profiles = new Map<string, UserProfile>();
        for (const group of snapshotsByCapability.values()) {
          for (const profile of group) profiles.set(profile.uid, profile);
        }
        onNext([...profiles.values()]);
      },
      onError,
    ),
  );
  return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
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

export async function setWorkerAvailability(uid: string, available: boolean): Promise<void> {
  await updateDoc(userDoc(uid), {
    available,
    updatedAt: serverTimestamp(),
  });
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
// retailerApplications/{applicantUid}
// ---------------------------------------------------------------------------

function retailerApplicationDoc(applicantUid: string) {
  return doc(requireDb(), COLLECTIONS.retailerApplications, applicantUid);
}

function mapRetailerApplication(snapshot: {
  id: string;
  data: () => DocumentData;
}): RetailerApplication {
  const data = snapshot.data();
  const createdAt = timestampToIso(data["createdAt"]);
  const updatedAt = timestampToIso(data["updatedAt"]);
  const reviewedAt = timestampToIso(data["reviewedAt"]);
  if (!createdAt || !updatedAt) {
    throw new Error(`Retailer application ${snapshot.id} has invalid timestamps.`);
  }
  return {
    id: snapshot.id,
    applicantUid: String(data["applicantUid"] ?? snapshot.id),
    applicantName: String(data["applicantName"] ?? ""),
    applicantEmail: String(data["applicantEmail"] ?? ""),
    applicantPhone: String(data["applicantPhone"] ?? ""),
    shopName: String(data["shopName"] ?? ""),
    category: data["category"] as RetailerApplication["category"],
    description: String(data["description"] ?? ""),
    shopPhone: String(data["shopPhone"] ?? ""),
    address: String(data["address"] ?? ""),
    city: String(data["city"] ?? ""),
    state: String(data["state"] ?? ""),
    postalCode: String(data["postalCode"] ?? ""),
    openingTime: String(data["openingTime"] ?? ""),
    closingTime: String(data["closingTime"] ?? ""),
    status: data["status"] as RetailerApplicationStatus,
    createdAt,
    updatedAt,
    ...(reviewedAt ? { reviewedAt } : {}),
    ...(typeof data["reviewedBy"] === "string" ? { reviewedBy: data["reviewedBy"] } : {}),
    ...(typeof data["rejectionReason"] === "string"
      ? { rejectionReason: data["rejectionReason"] }
      : {}),
    ...(typeof data["shopId"] === "string" ? { shopId: data["shopId"] } : {}),
  };
}

function validateRetailerApplication(input: RetailerApplicationInput): void {
  const required: [string, string][] = [
    ["Applicant name", input.applicantName],
    ["Applicant email", input.applicantEmail],
    ["Applicant phone", input.applicantPhone],
    ["Shop name", input.shopName],
    ["Shop phone", input.shopPhone],
    ["Shop address", input.address],
    ["City", input.city],
    ["State", input.state],
    ["Postal code", input.postalCode],
    ["Opening time", input.openingTime],
    ["Closing time", input.closingTime],
  ];
  for (const [label, value] of required) {
    if (!value.trim()) throw new Error(`${label} is required.`);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.applicantEmail.trim())) {
    throw new Error("Enter a valid applicant email address.");
  }
  if (!/^[0-9+() -]{7,20}$/.test(input.applicantPhone.trim())) {
    throw new Error("Enter a valid applicant phone number.");
  }
  if (!/^[0-9+() -]{7,20}$/.test(input.shopPhone.trim())) {
    throw new Error("Enter a valid shop phone number.");
  }
  if (!/^\d{4,10}$/.test(input.postalCode.trim())) {
    throw new Error("Enter a valid postal code.");
  }
  const validTime = (value: string) => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
  if (!validTime(input.openingTime) || !validTime(input.closingTime)) {
    throw new Error("Enter shop hours in HH:mm format.");
  }
  if (!input.description.trim()) throw new Error("Shop description is required.");
}

export async function fetchRetailerApplication(
  applicantUid: string,
): Promise<RetailerApplication | null> {
  const snapshot = await getDoc(retailerApplicationDoc(applicantUid));
  return snapshot.exists() ? mapRetailerApplication(snapshot) : null;
}

export async function fetchRetailerApplications(
  status?: RetailerApplicationStatus,
): Promise<RetailerApplication[]> {
  const constraints: QueryConstraint[] = [];
  if (status) constraints.push(where("status", "==", status));
  constraints.push(orderBy("createdAt", "desc"));
  const snapshot = await getDocs(
    query(collection(requireDb(), COLLECTIONS.retailerApplications), ...constraints),
  );
  return snapshot.docs.map(mapRetailerApplication);
}

export async function submitRetailerApplication(
  applicantUid: string,
  input: RetailerApplicationInput,
): Promise<void> {
  validateRetailerApplication(input);
  const db = requireDb();
  const applicationRef = retailerApplicationDoc(applicantUid);
  await runTransaction(db, async (transaction) => {
    const existing = await transaction.get(applicationRef);
    if (existing.exists() && existing.data()["status"] !== "REJECTED") {
      throw new Error("You already have an application that cannot be resubmitted.");
    }
    const now = serverTimestamp();
    const applicationFields = {
      ...input,
      applicantUid,
      applicantName: input.applicantName.trim(),
      applicantEmail: input.applicantEmail.trim().toLowerCase(),
      applicantPhone: input.applicantPhone.trim(),
      shopName: input.shopName.trim(),
      description: input.description.trim(),
      shopPhone: input.shopPhone.trim(),
      address: input.address.trim(),
      city: input.city.trim(),
      state: input.state.trim(),
      postalCode: input.postalCode.trim(),
      status: "PENDING",
      updatedAt: now,
    };
    if (existing.exists()) {
      transaction.update(applicationRef, {
        ...applicationFields,
        reviewedAt: deleteField(),
        reviewedBy: deleteField(),
        rejectionReason: deleteField(),
        shopId: deleteField(),
      });
    } else {
      transaction.set(applicationRef, { ...applicationFields, createdAt: now });
    }
  });
}

export async function approveRetailerApplication(
  applicantUid: string,
  reviewerUid: string,
): Promise<string> {
  const db = requireDb();
  const applicationRef = retailerApplicationDoc(applicantUid);
  const profileRef = userDoc(applicantUid);
  const shopRef = doc(shopsCollection());
  return runTransaction(db, async (transaction) => {
    const [applicationSnapshot, profileSnapshot] = await Promise.all([
      transaction.get(applicationRef),
      transaction.get(profileRef),
    ]);
    if (!applicationSnapshot.exists()) throw new Error("Retailer application not found.");
    if (!profileSnapshot.exists()) throw new Error("Applicant profile not found.");
    const application = applicationSnapshot.data();
    const profile = profileSnapshot.data();
    if (application["status"] !== "PENDING") {
      throw new Error("Only pending retailer applications can be approved.");
    }
    if (profile["status"] !== "active" || !Array.isArray(profile["capabilities"])) {
      throw new Error("Applicant account is not active or has an invalid profile.");
    }
    if (!profile["capabilities"].includes("customer")) {
      throw new Error("Applicant must have an active customer capability.");
    }
    if (profile["capabilities"].includes("retailer")) {
      throw new Error("Applicant already has retailer access.");
    }
    const now = serverTimestamp();
    transaction.set(shopRef, {
      ownerId: applicantUid,
      name: application["shopName"],
      category: application["category"],
      description: application["description"],
      phone: application["shopPhone"],
      address: `${application["address"]}, ${application["city"]}, ${application["state"]} ${application["postalCode"]}`,
      openingTime: application["openingTime"],
      closingTime: application["closingTime"],
      status: "ACTIVE",
      createdAt: now,
      updatedAt: now,
    });
    transaction.update(profileRef, {
      capabilities: arrayUnion("retailer"),
      updatedAt: now,
    });
    transaction.update(applicationRef, {
      status: "APPROVED",
      shopId: shopRef.id,
      reviewedBy: reviewerUid,
      reviewedAt: now,
      updatedAt: now,
    });
    return shopRef.id;
  });
}

export async function rejectRetailerApplication(
  applicantUid: string,
  reviewerUid: string,
  rejectionReason: string,
): Promise<void> {
  const reason = rejectionReason.trim();
  if (reason.length < 5) throw new Error("Please provide a rejection reason.");
  const applicationRef = retailerApplicationDoc(applicantUid);
  await runTransaction(requireDb(), async (transaction) => {
    const snapshot = await transaction.get(applicationRef);
    if (!snapshot.exists()) throw new Error("Retailer application not found.");
    if (snapshot.data()["status"] !== "PENDING") {
      throw new Error("Only pending retailer applications can be rejected.");
    }
    transaction.update(applicationRef, {
      status: "REJECTED",
      rejectionReason: reason,
      reviewedBy: reviewerUid,
      reviewedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
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
  return snapshot.docs.map(mapOrderDoc);
}

export function subscribeToOrdersForCustomer(
  customerId: string,
  onNext: (orders: Order[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(ordersCollection(), where("customerId", "==", customerId), orderBy("createdAt", "desc")),
    (snapshot) => onNext(snapshot.docs.map(mapOrderDoc)),
    onError,
  );
}

export async function fetchAllOrders(): Promise<Order[]> {
  const snapshot = await getDocs(query(ordersCollection(), orderBy("createdAt", "desc")));
  return snapshot.docs.map(mapOrderDoc);
}

export function subscribeToAllOrders(
  onNext: (orders: Order[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(ordersCollection(), orderBy("createdAt", "desc")),
    (snapshot) => onNext(snapshot.docs.map(mapOrderDoc)),
    onError,
  );
}

/** The retailer order queue. Scoped to one shop so a retailer never sees another's. */
export async function fetchOrdersForShop(shopId: string, status?: OrderStatus): Promise<Order[]> {
  const constraints: QueryConstraint[] = [where("shopId", "==", shopId)];
  if (status) constraints.push(where("orderStatus", "==", status));
  constraints.push(orderBy("createdAt", "desc"));
  const snapshot = await getDocs(query(ordersCollection(), ...constraints));
  return snapshot.docs.map(mapOrderDoc);
}

export function subscribeToOrdersForShop(
  shopId: string,
  onNext: (orders: Order[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(ordersCollection(), where("shopId", "==", shopId), orderBy("createdAt", "desc")),
    (snapshot) => onNext(snapshot.docs.map(mapOrderDoc)),
    onError,
  );
}

export async function fetchOrder(orderId: string): Promise<Order | null> {
  const snapshot = await getDoc(orderDoc(orderId));
  return snapshot.exists() ? mapOrderDoc(snapshot) : null;
}

export async function createCustomerOrder(input: {
  customerId: string;
  shopId: string;
  deliveryAddressId: string;
  items: { productId: string; quantity: number }[];
  paymentMethod: "COD";
}): Promise<string> {
  if (!input.customerId || !input.shopId || !input.deliveryAddressId) {
    throw new Error("Customer, shop and delivery address are required.");
  }
  if (input.paymentMethod !== "COD") throw new Error("Only cash on delivery is available.");
  if (!input.items.length || input.items.length > 50) {
    throw new Error("Your cart must contain between 1 and 50 products.");
  }
  const uniqueItems = new Map<string, number>();
  for (const item of input.items) {
    if (!item.productId || !Number.isInteger(item.quantity) || item.quantity < 1) {
      throw new Error("Each cart item must have a valid product and quantity.");
    }
    if (uniqueItems.has(item.productId)) throw new Error("Your cart contains duplicate products.");
    uniqueItems.set(item.productId, item.quantity);
  }

  const db = requireDb();
  const orderRef = doc(ordersCollection());
  const productRefs = [...uniqueItems.keys()].map((productId) =>
    doc(db, COLLECTIONS.products, productId),
  );
  return runTransaction(db, async (transaction) => {
    const profileRef = userDoc(input.customerId);
    const shopRef = doc(db, COLLECTIONS.shops, input.shopId);
    const addressRef = addressDoc(input.deliveryAddressId);
    const [profileSnapshot, shopSnapshot, addressSnapshot, ...productSnapshots] = await Promise.all(
      [
        transaction.get(profileRef),
        transaction.get(shopRef),
        transaction.get(addressRef),
        ...productRefs.map((ref) => transaction.get(ref)),
      ],
    );
    if (!profileSnapshot.exists()) throw new Error("Your customer profile could not be found.");
    const profile = profileSnapshot.data();
    if (profile["status"] !== undefined && profile["status"] !== "active") {
      throw new Error("Your account is not active.");
    }
    if (!Array.isArray(profile["capabilities"]) || !profile["capabilities"].includes("customer")) {
      throw new Error("An active customer account is required to place an order.");
    }
    if (!shopSnapshot.exists() || shopSnapshot.data()["status"] !== "ACTIVE") {
      throw new Error("This shop is no longer available.");
    }
    if (!addressSnapshot.exists() || addressSnapshot.data()["userId"] !== input.customerId) {
      throw new Error("Choose a saved delivery address that belongs to your account.");
    }
    const address = mapDoc<Address>(addressSnapshot);
    if (
      !Number.isFinite(address.latitude) ||
      !Number.isFinite(address.longitude) ||
      !address.address.trim()
    ) {
      throw new Error("The selected delivery address needs a valid location.");
    }
    const shop = mapShopDoc(shopSnapshot);
    const items = productSnapshots.map((snapshot) => {
      if (!snapshot.exists()) throw new Error("A product in your cart is no longer available.");
      const product = mapProductDoc(snapshot);
      const quantity = uniqueItems.get(product.id)!;
      if (product.shopId !== input.shopId) {
        throw new Error("All products in your order must belong to the selected shop.");
      }
      if (!product.availability || product.stock < quantity) {
        throw new Error(`${product.name} is unavailable or has insufficient stock.`);
      }
      return {
        productId: product.id,
        name: product.name,
        price: product.price,
        quantity,
        ...(product.image ? { image: product.image } : {}),
      };
    });
    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const deliveryAddress = { ...address, id: input.deliveryAddressId };
    const now = new Date().toISOString();
    transaction.set(orderRef, {
      customerId: input.customerId,
      shopId: input.shopId,
      shopName: shop.name,
      items,
      subtotal,
      deliveryFee: STANDARD_DELIVERY_FEE,
      totalAmount: subtotal + STANDARD_DELIVERY_FEE,
      deliveryAddressId: input.deliveryAddressId,
      deliveryAddress,
      paymentMethod: "COD",
      paymentStatus: "COD_PENDING",
      orderStatus: "PLACED",
      statusHistory: [{ status: "PLACED", at: now }],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return orderRef.id;
  });
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
  patch: Partial<Order> = {},
  at: string = new Date().toISOString(),
): Promise<void> {
  const db = requireDb();
  await runTransaction(db, async (transaction) => {
    const ref = orderDoc(orderId);
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists()) throw new Error("Order not found.");
    const order = mapOrderDoc(snapshot);
    const changes: Record<string, unknown> = {
      ...stripUndefined(patch),
      orderStatus: nextStatus,
      statusHistory: arrayUnion({ status: nextStatus, at }),
      updatedAt: serverTimestamp(),
    };
    if (nextStatus === "READY_FOR_PICKUP") {
      const taskId = order.deliveryTaskId ?? `task-${order.id}`;
      const taskRef = deliveryTaskDoc(taskId);
      const taskSnapshot = await transaction.get(taskRef);
      if (taskSnapshot.exists()) {
        const task = taskSnapshot.data();
        if (task["orderId"] !== order.id || task["shopId"] !== order.shopId) {
          throw new Error("A conflicting delivery task already exists for this order.");
        }
      } else {
        const shopSnapshot = await transaction.get(doc(db, COLLECTIONS.shops, order.shopId));
        if (!shopSnapshot.exists()) throw new Error("The order's shop could not be found.");
        const shop = mapShopDoc(shopSnapshot);
        const pickupLatitude = shop.latitude;
        const pickupLongitude = shop.longitude;
        const deliveryLatitude = order.deliveryAddress.latitude;
        const deliveryLongitude = order.deliveryAddress.longitude;
        if (
          !Number.isFinite(pickupLatitude) ||
          !Number.isFinite(pickupLongitude) ||
          !Number.isFinite(deliveryLatitude) ||
          !Number.isFinite(deliveryLongitude)
        ) {
          throw new Error("A valid pickup and delivery location is required to create the task.");
        }
        const latitudeDelta = deliveryLatitude! - pickupLatitude!;
        const longitudeDelta = deliveryLongitude! - pickupLongitude!;
        transaction.set(taskRef, {
          orderId: order.id,
          shopId: order.shopId,
          status: "AVAILABLE",
          pickupLocation: { latitude: pickupLatitude, longitude: pickupLongitude },
          deliveryLocation: { latitude: deliveryLatitude, longitude: deliveryLongitude },
          distance: Math.max(0.5, Math.hypot(latitudeDelta, longitudeDelta) * 111),
          deliveryFee: order.deliveryFee,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      changes["deliveryTaskId"] = taskId;
    }
    transaction.update(ref, changes);
  });
}

// ---------------------------------------------------------------------------
// payments/{paymentId}
// ---------------------------------------------------------------------------

export function paymentsCollection() {
  return collection(requireDb(), COLLECTIONS.payments);
}

export async function fetchPaymentsForOrder(orderId: string): Promise<Payment[]> {
  const snapshot = await getDocs(query(paymentsCollection(), where("orderId", "==", orderId)));
  return snapshot.docs.map((entry) => {
    const data = entry.data();
    return {
      ...data,
      id: entry.id,
      ...Object.fromEntries(
        (["createdAt", "updatedAt", "paidAt"] as const).flatMap((field) => {
          const timestamp = timestampToIso(data[field]);
          return timestamp ? [[field, timestamp]] : [];
        }),
      ),
    } as Payment;
  });
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
  return snapshot.docs.map(mapDeliveryTaskDoc);
}

export function subscribeToAvailableTasks(
  onNext: (tasks: DeliveryTask[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(
      deliveryTasksCollection(),
      where("status", "==", "AVAILABLE"),
      orderBy("createdAt", "desc"),
    ),
    (snapshot) => onNext(snapshot.docs.map(mapDeliveryTaskDoc)),
    onError,
  );
}

export async function fetchTasksForWorker(deliveryWorkerId: string): Promise<DeliveryTask[]> {
  const snapshot = await getDocs(
    query(
      deliveryTasksCollection(),
      where("deliveryWorkerId", "==", deliveryWorkerId),
      orderBy("createdAt", "desc"),
    ),
  );
  return snapshot.docs.map(mapDeliveryTaskDoc);
}

export function subscribeToTasksForWorker(
  deliveryWorkerId: string,
  onNext: (tasks: DeliveryTask[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(
      deliveryTasksCollection(),
      where("deliveryWorkerId", "==", deliveryWorkerId),
      orderBy("createdAt", "desc"),
    ),
    (snapshot) => onNext(snapshot.docs.map(mapDeliveryTaskDoc)),
    onError,
  );
}

export async function fetchAllDeliveryTasks(): Promise<DeliveryTask[]> {
  const snapshot = await getDocs(query(deliveryTasksCollection(), orderBy("createdAt", "desc")));
  return snapshot.docs.map(mapDeliveryTaskDoc);
}

export function subscribeToAllDeliveryTasks(
  onNext: (tasks: DeliveryTask[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(deliveryTasksCollection(), orderBy("createdAt", "desc")),
    (snapshot) => onNext(snapshot.docs.map(mapDeliveryTaskDoc)),
    onError,
  );
}

export async function fetchDeliveryTask(taskId: string): Promise<DeliveryTask | null> {
  const snapshot = await getDoc(deliveryTaskDoc(taskId));
  return snapshot.exists() ? mapDeliveryTaskDoc(snapshot) : null;
}

/**
 * Claims an open task for a worker.
 *
 * Implemented as a conditional transaction so two workers cannot both claim the
 * same AVAILABLE task.
 */
export async function claimDeliveryTask(taskId: string, deliveryWorkerId: string): Promise<void> {
  const db = requireDb();
  await runTransaction(db, async (transaction) => {
    const taskRef = deliveryTaskDoc(taskId);
    const taskSnapshot = await transaction.get(taskRef);
    if (!taskSnapshot.exists()) throw new Error("Delivery task not found.");
    const task = mapDeliveryTaskDoc(taskSnapshot);
    if (task.status !== "AVAILABLE" || task.deliveryWorkerId)
      throw new Error("Task is no longer available.");
    const orderRef = orderDoc(task.orderId);
    const orderSnapshot = await transaction.get(orderRef);
    if (!orderSnapshot.exists()) throw new Error("The order for this task could not be found.");
    const order = mapOrderDoc(orderSnapshot);
    const profileSnapshot = await transaction.get(userDoc(deliveryWorkerId));
    if (!profileSnapshot.exists())
      throw new Error("An active delivery-worker profile is required.");
    const profile = profileSnapshot.data();
    const capabilities = canonicalCapabilities(profile["capabilities"]);
    if (
      profile["status"] === "suspended" ||
      !capabilities.includes("delivery_worker") ||
      profile["available"] === false
    ) {
      throw new Error("You are not available to accept delivery tasks.");
    }
    if (order.orderStatus !== "READY_FOR_PICKUP" || order.deliveryTaskId !== taskId)
      throw new Error("Task is no longer available.");
    const now = new Date().toISOString();
    transaction.update(taskRef, {
      deliveryWorkerId,
      status: "DELIVERY_ASSIGNED",
      assignedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    transaction.update(orderRef, {
      orderStatus: "DELIVERY_ASSIGNED",
      statusHistory: arrayUnion({ status: "DELIVERY_ASSIGNED", at: now }),
      updatedAt: serverTimestamp(),
    });
  });
}

/** Admin dispatch uses the same atomic order/task transition as worker self-claim. */
export async function assignDeliveryTask(taskId: string, deliveryWorkerId: string): Promise<void> {
  const db = requireDb();
  await runTransaction(db, async (transaction) => {
    const taskRef = deliveryTaskDoc(taskId);
    const taskSnapshot = await transaction.get(taskRef);
    if (!taskSnapshot.exists()) throw new Error("Delivery task not found.");
    const task = mapDeliveryTaskDoc(taskSnapshot);
    if (task.status !== "AVAILABLE" || task.deliveryWorkerId)
      throw new Error("Task is no longer available.");

    const orderRef = orderDoc(task.orderId);
    const orderSnapshot = await transaction.get(orderRef);
    if (!orderSnapshot.exists()) throw new Error("The order for this task could not be found.");
    const order = mapOrderDoc(orderSnapshot);
    const profileSnapshot = await transaction.get(userDoc(deliveryWorkerId));
    if (!profileSnapshot.exists()) throw new Error("Delivery worker not found.");
    const profile = profileSnapshot.data();
    const capabilities = canonicalCapabilities(profile["capabilities"]);
    if (
      profile["status"] === "suspended" ||
      !capabilities.includes("delivery_worker") ||
      profile["available"] === false
    ) {
      throw new Error("Choose an active, available delivery worker.");
    }
    if (order.orderStatus !== "READY_FOR_PICKUP" || order.deliveryTaskId !== taskId)
      throw new Error("Task is no longer available.");

    transaction.update(taskRef, {
      deliveryWorkerId,
      status: "DELIVERY_ASSIGNED",
      assignedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    transaction.update(orderRef, {
      orderStatus: "DELIVERY_ASSIGNED",
      statusHistory: arrayUnion({
        status: "DELIVERY_ASSIGNED",
        at: new Date().toISOString(),
      }),
      updatedAt: serverTimestamp(),
    });
  });
}

export async function updateDeliveryTask(
  taskId: string,
  patch: Partial<DeliveryTask>,
): Promise<void> {
  const nextStatus = patch.status;
  if (!nextStatus) throw new Error("A delivery task status is required.");
  const orderStatus: Partial<Record<DeliveryTask["status"], OrderStatus>> = {
    DELIVERY_ASSIGNED: "DELIVERY_ASSIGNED",
    PICKED_UP: "PICKED_UP",
    OUT_FOR_DELIVERY: "OUT_FOR_DELIVERY",
    DELIVERED: "DELIVERED",
    DELIVERY_FAILED: "DELIVERY_FAILED",
  };
  const nextOrderStatus = orderStatus[nextStatus];
  if (!nextOrderStatus) throw new Error("The requested task status is not a worker transition.");
  const allowed: Partial<Record<DeliveryTask["status"], DeliveryTask["status"][]>> = {
    DELIVERY_ASSIGNED: ["PICKED_UP"],
    PICKED_UP: ["OUT_FOR_DELIVERY"],
    OUT_FOR_DELIVERY: ["DELIVERED", "DELIVERY_FAILED"],
  };
  if (nextStatus === "DELIVERY_FAILED") {
    const reason = patch.failureReason?.trim() ?? "";
    if (reason.length < 3 || reason.length > 250) {
      throw new Error("Provide a delivery failure reason between 3 and 250 characters.");
    }
  }
  const db = requireDb();
  await runTransaction(db, async (transaction) => {
    const taskRef = deliveryTaskDoc(taskId);
    const taskSnapshot = await transaction.get(taskRef);
    if (!taskSnapshot.exists()) throw new Error("Delivery task not found.");
    const task = mapDeliveryTaskDoc(taskSnapshot);
    const orderRef = orderDoc(task.orderId);
    const orderSnapshot = await transaction.get(orderRef);
    if (!orderSnapshot.exists()) throw new Error("The order for this task could not be found.");
    const order = mapOrderDoc(orderSnapshot);
    if (!task.deliveryWorkerId || !allowed[task.status]?.includes(nextStatus)) {
      throw new Error("This task can no longer be updated.");
    }
    const expectedCurrentOrderStatus: Partial<Record<DeliveryTask["status"], OrderStatus>> = {
      DELIVERY_ASSIGNED: "DELIVERY_ASSIGNED",
      PICKED_UP: "PICKED_UP",
      OUT_FOR_DELIVERY: "OUT_FOR_DELIVERY",
    };
    if (
      order.deliveryTaskId !== taskId ||
      order.orderStatus !== expectedCurrentOrderStatus[task.status]
    ) {
      throw new Error("The task and order are no longer in sync.");
    }
    const now = new Date().toISOString();
    const timestampField: Partial<Record<DeliveryTask["status"], string>> = {
      PICKED_UP: "pickedUpAt",
      OUT_FOR_DELIVERY: "outForDeliveryAt",
      DELIVERED: "deliveredAt",
      DELIVERY_FAILED: "failedAt",
    };
    const taskPatch: Record<string, unknown> = {
      status: nextStatus,
      updatedAt: serverTimestamp(),
    };
    const milestone = timestampField[nextStatus];
    if (milestone) taskPatch[milestone] = serverTimestamp();
    if (nextStatus === "DELIVERY_FAILED") {
      taskPatch["failureReason"] = patch.failureReason!.trim();
      if (patch.failureNotes?.trim()) taskPatch["failureNotes"] = patch.failureNotes.trim();
      else taskPatch["failureNotes"] = deleteField();
    }
    transaction.update(taskRef, taskPatch);
    transaction.update(orderRef, {
      orderStatus: nextOrderStatus,
      statusHistory: arrayUnion({ status: nextOrderStatus, at: now }),
      updatedAt: serverTimestamp(),
    });
  });
}
