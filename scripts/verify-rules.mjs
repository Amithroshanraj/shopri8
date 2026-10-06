/**
 * SHOPRi8 Firestore security-rules validation against the local Emulator Suite.
 *
 * Runs with plain Node (no test framework, no extra dependencies) by talking to
 * the Auth and Firestore emulator REST APIs directly:
 *
 *   1. Seed documents using the emulator's `owner` token (admin bypass).
 *   2. Mint real ID tokens for a customer, retailer, worker and admin via the
 *      Auth emulator.
 *   3. Attempt reads and writes as each role and assert allow / deny.
 *
 * Usage (with `npx firebase emulators:start` running):
 *   node scripts/verify-rules.mjs
 *
 * Exit code 0 means every assertion held.
 */

const PROJECT = "hyperlocal-commerce-c9abd";
const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? "127.0.0.1:9099";
const FIRESTORE_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8081";
const AUTH = `http://${AUTH_HOST}/identitytoolkit.googleapis.com/v1`;
const FS = `http://${FIRESTORE_HOST}/v1/projects/${PROJECT}/databases/(default)/documents`;
const KEY = "fake-api-key";

const results = [];
let failures = 0;

function record(actor, action, expected, actual) {
  const pass = expected === actual;
  if (!pass) failures++;
  results.push({ pass, actor, action, expected, actual });
}

async function expect(actor, action, expected, fn) {
  let actual;
  let detail;
  try {
    const r = await fn();
    actual = r.ok ? "allow" : "deny";
    if (!r.ok) detail = await r.text();
  } catch (e) {
    actual = "deny";
    detail = e instanceof Error ? e.message : String(e);
  }
  record(actor, action, expected, actual);
  if (detail) results.at(-1).detail = detail;
}

/**
 * Creates an emulator user and returns { uid, idToken }.
 *
 * Falls back to sign-in when the account already exists, so the script is
 * re-runnable against a long-lived emulator without wiping it first.
 */
async function makeUser(label, body) {
  const post = (url) =>
    fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...body, returnSecureToken: true }),
    });

  let res = await post(`${AUTH}/accounts:signUp?key=${KEY}`);
  if (!res.ok) {
    res = await post(`${AUTH}/accounts:signInWithPassword?key=${KEY}`);
  }
  const json = await res.json();
  if (!json.idToken) throw new Error(`could not create ${label}: ${JSON.stringify(json)}`);
  return { uid: json.localId, idToken: json.idToken, email: json.email };
}

/** Writes a document bypassing rules, using the emulator owner token. */
async function seedPlain(path, data) {
  const res = await fetch(`${FS}/${path}`, {
    method: "PATCH",
    headers: { authorization: "Bearer owner", "content-type": "application/json" },
    body: JSON.stringify({ fields: encodeFields(data) }),
  });
  if (!res.ok) throw new Error(`seed ${path} failed: ${res.status} ${await res.text()}`);
}

/** Minimal Firestore REST Value encoder. */
function encode(value) {
  if (value === null) return { nullValue: null };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encode) } };
  if (typeof value === "object") return { mapValue: { fields: encodeFields(value) } };
  throw new Error(`cannot encode ${typeof value}`);
}

/** Encodes a plain object into a Firestore Document `fields` map. */
function encodeFields(value) {
  const fields = {};
  for (const [key, v] of Object.entries(value)) {
    if (v === undefined) continue;
    fields[key] = encode(v);
  }
  return fields;
}

const req = (token) => ({
  ...(token ? { authorization: `Bearer ${token}` } : {}),
  "content-type": "application/json",
});

async function getDoc(token, path) {
  return fetch(`${FS}/${path}`, { headers: req(token) });
}
/**
 * Partial update.
 *
 * Uses an explicit `updateMask`, matching what the SDK's `updateDoc()` sends.
 * A bare REST PATCH replaces the whole document, which would erase unrelated
 * fields and test a scenario the app never performs.
 */
async function patchDoc(token, path, data) {
  const mask = Object.keys(data)
    .map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`)
    .join("&");
  return fetch(`${FS}/${path}?${mask}`, {
    method: "PATCH",
    headers: req(token),
    body: JSON.stringify({ fields: encodeFields(data) }),
  });
}

function orderCreateFixture(customerUid, overrides = {}) {
  const addressId = `addr-${customerUid}`;
  return {
    customerId: customerUid,
    shopId: "shop-a",
    shopName: "Shop A",
    items: [{ productId: "prod-a", name: "Rice", price: 340, quantity: 1 }],
    subtotal: 340,
    deliveryFee: 29,
    totalAmount: 369,
    deliveryAddressId: addressId,
    deliveryAddress: {
      id: addressId,
      userId: customerUid,
      label: "Home",
      recipientName: "Customer",
      phone: "+1 415 555 0100",
      address: "1 Test Street",
      latitude: 37.7749,
      longitude: -122.4194,
    },
    paymentMethod: "COD",
    paymentStatus: "COD_PENDING",
    orderStatus: "PLACED",
    statusHistory: [{ status: "PLACED", at: new Date().toISOString() }],
    ...overrides,
  };
}

function appendOrderStatus(history, status) {
  return [...history, { status, at: new Date().toISOString() }];
}
async function createDoc(token, collection, data) {
  return fetch(`${FS}/${collection}`, {
    method: "POST",
    headers: req(token),
    body: JSON.stringify({ fields: encodeFields(data) }),
  });
}

async function writeWithTimestamps(
  token,
  path,
  data,
  timestampFields,
  exists,
  fieldPaths = Object.keys(data),
) {
  const fields = encodeFields(data);
  return fetch(`${FS}:commit`, {
    method: "POST",
    headers: req(token),
    body: JSON.stringify({
      writes: [
        {
          update: {
            name: `projects/${PROJECT}/databases/(default)/documents/${path}`,
            fields,
          },
          updateMask: { fieldPaths },
          updateTransforms: timestampFields.map((fieldPath) => ({
            fieldPath,
            setToServerValue: "REQUEST_TIME",
          })),
          currentDocument: { exists },
        },
      ],
    }),
  });
}

async function commitWrites(token, writes) {
  return fetch(`${FS}:commit`, {
    method: "POST",
    headers: req(token),
    body: JSON.stringify({
      writes: writes.map(({ path, data, timestampFields, exists, fieldPaths }) => ({
        update: {
          name: `projects/${PROJECT}/databases/(default)/documents/${path}`,
          fields: encodeFields(data),
        },
        updateMask: { fieldPaths: fieldPaths ?? Object.keys(data) },
        ...(timestampFields?.length
          ? {
              updateTransforms: timestampFields.map((fieldPath) => ({
                fieldPath,
                setToServerValue: "REQUEST_TIME",
              })),
            }
          : {}),
        ...(exists !== undefined ? { currentDocument: { exists } } : {}),
      })),
    }),
  });
}

function fieldFilter(fieldPath, op, value) {
  return {
    fieldFilter: {
      field: { fieldPath },
      op,
      value: encode(value),
    },
  };
}

function applicationFixture(applicantUid, applicantEmail, shopName) {
  return {
    applicantUid,
    applicantName: "Retailer Applicant",
    applicantEmail,
    applicantPhone: "+1 415 555 0132",
    shopName,
    category: "grocery",
    description: "A neighbourhood grocery shop with fresh local products.",
    shopPhone: "+1 415 555 0133",
    address: "50 Market Street",
    city: "San Francisco",
    state: "California",
    postalCode: "94105",
    openingTime: "09:00",
    closingTime: "21:00",
    status: "PENDING",
  };
}

async function runQuery(token, collectionId, filters) {
  return fetch(`${FS}:runQuery`, {
    method: "POST",
    headers: req(token),
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId }],
        ...(filters.length ? { where: { compositeFilter: { op: "AND", filters } } } : {}),
      },
    }),
  });
}

async function createUserProfile(token, uid, data) {
  const fields = encodeFields(data);
  delete fields.createdAt;
  delete fields.updatedAt;
  return fetch(`${FS}:commit`, {
    method: "POST",
    headers: req(token),
    body: JSON.stringify({
      writes: [
        {
          update: {
            name: `projects/${PROJECT}/databases/(default)/documents/users/${uid}`,
            fields,
          },
          updateMask: {
            fieldPaths: Object.keys(data).filter(
              (key) => key !== "createdAt" && key !== "updatedAt",
            ),
          },
          updateTransforms: [
            { fieldPath: "createdAt", setToServerValue: "REQUEST_TIME" },
            { fieldPath: "updatedAt", setToServerValue: "REQUEST_TIME" },
          ],
          currentDocument: { exists: false },
        },
      ],
    }),
  });
}

async function main() {
  console.log("Seeding SHOPRi8 fixtures into the Firestore emulator...\n");

  const runId = Date.now();
  const customer = await makeUser("customer", {
    email: "cust@shopri8.test",
    password: "Password123!",
  });
  const other = await makeUser("other-customer", {
    email: "other@shopri8.test",
    password: "Password123!",
  });
  const retailer = await makeUser("retailer", {
    email: "retailer@shopri8.test",
    password: "Password123!",
  });
  const retailerTwo = await makeUser("retailer-two", {
    email: "retailer-two@shopri8.test",
    password: "Password123!",
  });
  const worker = await makeUser("worker", {
    email: "worker@shopri8.test",
    password: "Password123!",
  });
  const workerB = await makeUser("worker-b", {
    email: "worker-b@shopri8.test",
    password: "Password123!",
  });
  const offlineWorker = await makeUser("offline-worker", {
    email: "offline-worker@shopri8.test",
    password: "Password123!",
  });
  const legacyWorker = await makeUser("legacy-worker", {
    email: "legacy-worker@shopri8.test",
    password: "Password123!",
  });
  const suspended = await makeUser("suspended", {
    email: "suspended@shopri8.test",
    password: "Password123!",
  });
  const fresh = await makeUser("fresh-customer", {
    email: `fresh-${runId}@shopri8.test`,
    password: "Password123!",
  });
  const escalated = await makeUser("profile-escalation", {
    email: `escalated-${runId}@shopri8.test`,
    password: "Password123!",
  });
  const approvalApplicant = await makeUser("approval-applicant", {
    email: `approval-${runId}@shopri8.test`,
    password: "Password123!",
  });
  const rejectedApplicant = await makeUser("rejected-applicant", {
    email: `rejected-${runId}@shopri8.test`,
    password: "Password123!",
  });
  const admin = await makeUser("admin", {
    email: "admin@shopri8.test",
    password: "Password123!",
  });

  await seedPlain(`users/${customer.uid}`, {
    uid: customer.uid,
    displayName: "Cust",
    capabilities: ["customer"],
    status: "active",
  });
  await seedPlain(`users/${other.uid}`, {
    uid: other.uid,
    displayName: "Other",
    capabilities: ["customer"],
    status: "active",
  });
  await seedPlain(`users/${retailer.uid}`, {
    uid: retailer.uid,
    displayName: "Green Basket",
    capabilities: ["retailer"],
    status: "active",
  });
  await seedPlain(`users/${retailerTwo.uid}`, {
    uid: retailerTwo.uid,
    displayName: "Market Two",
    capabilities: ["retailer"],
    status: "active",
  });
  await seedPlain(`users/${worker.uid}`, {
    uid: worker.uid,
    displayName: "Arjun",
    capabilities: ["delivery_worker"],
    status: "active",
  });
  await seedPlain(`users/${workerB.uid}`, {
    uid: workerB.uid,
    displayName: "Bea",
    capabilities: ["delivery_worker"],
    status: "active",
  });
  await seedPlain(`users/${offlineWorker.uid}`, {
    uid: offlineWorker.uid,
    displayName: "Offline Worker",
    capabilities: ["delivery_worker"],
    status: "active",
    available: false,
  });
  await seedPlain(`users/${legacyWorker.uid}`, {
    name: "Legacy Arjun",
    capabilities: ["deliveryWorker"],
  });
  await seedPlain(`users/${suspended.uid}`, {
    uid: suspended.uid,
    displayName: "Suspended",
    capabilities: ["customer", "retailer"],
    status: "suspended",
  });
  await seedPlain(`users/${admin.uid}`, {
    uid: admin.uid,
    displayName: "Admin",
    capabilities: ["admin"],
    status: "active",
  });
  for (const applicant of [approvalApplicant, rejectedApplicant]) {
    await seedPlain(`users/${applicant.uid}`, {
      uid: applicant.uid,
      displayName: applicant.email,
      email: applicant.email,
      capabilities: ["customer"],
      status: "active",
    });
  }

  await seedPlain("shops/shop-a", {
    ownerId: retailer.uid,
    name: "Shop A",
    category: "grocery",
    description: "A grocery shop",
    address: "1 Market Road",
    openingTime: "08:00",
    closingTime: "20:00",
    status: "ACTIVE",
  });
  await seedPlain("shops/shop-b", {
    ownerId: retailerTwo.uid,
    name: "Shop B",
    category: "grocery",
    description: "Another grocery shop",
    address: "2 Market Road",
    openingTime: "08:00",
    closingTime: "20:00",
    status: "INACTIVE",
  });
  await seedPlain("shops/shop-inactive", {
    ownerId: "someone-else",
    name: "Inactive Shop",
    category: "grocery",
    description: "An inactive shop",
    address: "3 Market Road",
    openingTime: "08:00",
    closingTime: "20:00",
    status: "INACTIVE",
  });
  await seedPlain("shops/shop-suspended", {
    ownerId: suspended.uid,
    name: "Suspended Shop",
    category: "grocery",
    address: "6 Market Road",
    status: "ACTIVE",
  });
  await seedPlain("products/prod-a", {
    shopId: "shop-a",
    name: "Rice",
    description: "Bag of rice",
    category: "grocery",
    price: 340,
    stock: 10,
    availability: true,
  });
  await seedPlain("products/prod-hidden", {
    shopId: "shop-a",
    name: "Out of stock",
    description: "Unavailable item",
    category: "grocery",
    price: 10,
    stock: 0,
    availability: false,
  });
  await seedPlain("products/prod-empty-available", {
    shopId: "shop-a",
    name: "Invalid empty stock",
    category: "grocery",
    price: 1,
    stock: 0,
    availability: true,
  });
  await seedPlain("products/prod-b", {
    shopId: "shop-b",
    name: "Oil",
    description: "Cooking oil",
    category: "grocery",
    price: 10,
    stock: 4,
    availability: true,
  });
  await seedPlain("categories/grocery", { name: "Grocery", status: "ACTIVE" });
  await seedPlain(`addresses/addr-${customer.uid}`, {
    userId: customer.uid,
    label: "Home",
    recipientName: "Customer",
    phone: "+1 415 555 0100",
    address: "1 Test Street",
    latitude: 37.7749,
    longitude: -122.4194,
  });

  await seedPlain("orders/order-1", {
    customerId: customer.uid,
    shopId: "shop-a",
    deliveryTaskId: "task-taken",
    orderStatus: "PLACED",
    totalAmount: 500,
    statusHistory: [],
  });
  await seedPlain("deliveryTasks/task-open", {
    orderId: "order-open",
    shopId: "shop-a",
    status: "AVAILABLE",
  });
  await seedPlain("deliveryTasks/task-taken", {
    orderId: "order-taken",
    shopId: "shop-a",
    status: "DELIVERY_ASSIGNED",
    deliveryWorkerId: worker.uid,
  });
  await seedPlain("deliveryTasks/task-untouched", {
    orderId: "order-untouched",
    shopId: "shop-a",
    status: "DELIVERY_ASSIGNED",
    deliveryWorkerId: worker.uid,
  });
  await seedPlain("deliveryTasks/task-legit", {
    orderId: "order-6",
    shopId: "shop-a",
    status: "OUT_FOR_DELIVERY",
    deliveryWorkerId: worker.uid,
  });
  await seedPlain("orders/order-6", {
    customerId: customer.uid,
    shopId: "shop-a",
    deliveryTaskId: "task-legit",
    orderStatus: "OUT_FOR_DELIVERY",
    totalAmount: 100,
    statusHistory: [{ status: "OUT_FOR_DELIVERY", at: new Date().toISOString() }],
    paymentStatus: "COD_PENDING",
  });
  await seedPlain("orders/order-open", {
    customerId: customer.uid,
    shopId: "shop-a",
    deliveryTaskId: "task-open",
    orderStatus: "READY_FOR_PICKUP",
    totalAmount: 100,
    statusHistory: [{ status: "READY_FOR_PICKUP", at: new Date().toISOString() }],
  });
  await seedPlain("orders/order-taken", {
    customerId: customer.uid,
    shopId: "shop-a",
    deliveryTaskId: "task-taken",
    orderStatus: "DELIVERY_ASSIGNED",
    totalAmount: 100,
    statusHistory: [{ status: "DELIVERY_ASSIGNED", at: new Date().toISOString() }],
  });
  await seedPlain("orders/order-untouched", {
    customerId: customer.uid,
    shopId: "shop-a",
    deliveryTaskId: "task-untouched",
    orderStatus: "DELIVERY_ASSIGNED",
    totalAmount: 100,
    statusHistory: [{ status: "DELIVERY_ASSIGNED", at: new Date().toISOString() }],
  });
  await seedPlain(`deliveryTasks/task-failed-${runId}`, {
    orderId: `order-failed-${runId}`,
    shopId: "shop-a",
    status: "DELIVERY_FAILED",
    deliveryWorkerId: workerB.uid,
    failureReason: "Customer unavailable",
  });
  await seedPlain(`orders/order-failed-${runId}`, {
    customerId: customer.uid,
    shopId: "shop-a",
    deliveryTaskId: `task-failed-${runId}`,
    orderStatus: "DELIVERY_FAILED",
    totalAmount: 100,
    statusHistory: [{ status: "DELIVERY_FAILED", at: new Date().toISOString() }],
  });
  await seedPlain(`deliveryTasks/task-delivered-${runId}`, {
    orderId: `order-delivered-${runId}`,
    shopId: "shop-a",
    status: "DELIVERED",
    deliveryWorkerId: workerB.uid,
  });
  await seedPlain(`orders/order-delivered-${runId}`, {
    customerId: customer.uid,
    shopId: "shop-a",
    deliveryTaskId: `task-delivered-${runId}`,
    orderStatus: "DELIVERED",
    totalAmount: 100,
    statusHistory: [{ status: "DELIVERED", at: new Date().toISOString() }],
  });
  await seedPlain(`deliveryTasks/task-failure-${runId}`, {
    orderId: `order-failure-${runId}`,
    shopId: "shop-a",
    status: "OUT_FOR_DELIVERY",
    deliveryWorkerId: workerB.uid,
  });
  await seedPlain(`orders/order-failure-${runId}`, {
    customerId: customer.uid,
    shopId: "shop-a",
    deliveryTaskId: `task-failure-${runId}`,
    orderStatus: "OUT_FOR_DELIVERY",
    totalAmount: 100,
    statusHistory: [{ status: "OUT_FOR_DELIVERY", at: new Date().toISOString() }],
  });
  await seedPlain(`deliveryTasks/task-failure-no-reason-${runId}`, {
    orderId: `order-failure-no-reason-${runId}`,
    shopId: "shop-a",
    status: "OUT_FOR_DELIVERY",
    deliveryWorkerId: workerB.uid,
  });
  await seedPlain(`orders/order-failure-no-reason-${runId}`, {
    customerId: customer.uid,
    shopId: "shop-a",
    deliveryTaskId: `task-failure-no-reason-${runId}`,
    orderStatus: "OUT_FOR_DELIVERY",
    totalAmount: 100,
    statusHistory: [{ status: "OUT_FOR_DELIVERY", at: new Date().toISOString() }],
  });
  await seedPlain(`deliveryTasks/task-race-${runId}`, {
    orderId: `order-race-${runId}`,
    shopId: "shop-a",
    status: "AVAILABLE",
  });
  await seedPlain(`orders/order-race-${runId}`, {
    customerId: customer.uid,
    shopId: "shop-a",
    deliveryTaskId: `task-race-${runId}`,
    orderStatus: "READY_FOR_PICKUP",
    totalAmount: 100,
    statusHistory: [{ status: "READY_FOR_PICKUP", at: new Date().toISOString() }],
  });
  await seedPlain(`deliveryTasks/task-offline-${runId}`, {
    orderId: `order-offline-${runId}`,
    shopId: "shop-a",
    status: "AVAILABLE",
  });
  await seedPlain(`orders/order-offline-${runId}`, {
    customerId: customer.uid,
    shopId: "shop-a",
    deliveryTaskId: `task-offline-${runId}`,
    orderStatus: "READY_FOR_PICKUP",
    totalAmount: 100,
    statusHistory: [{ status: "READY_FOR_PICKUP", at: new Date().toISOString() }],
  });
  await seedPlain(`deliveryTasks/task-already-claimed-${runId}`, {
    orderId: `order-already-claimed-${runId}`,
    shopId: "shop-a",
    status: "DELIVERY_ASSIGNED",
    deliveryWorkerId: worker.uid,
  });
  await seedPlain(`orders/order-already-claimed-${runId}`, {
    customerId: customer.uid,
    shopId: "shop-a",
    deliveryTaskId: `task-already-claimed-${runId}`,
    orderStatus: "DELIVERY_ASSIGNED",
    totalAmount: 100,
    statusHistory: [{ status: "DELIVERY_ASSIGNED", at: new Date().toISOString() }],
  });
  await seedPlain(`orders/order-ready-create-${runId}`, {
    customerId: customer.uid,
    shopId: "shop-a",
    orderStatus: "PREPARING",
    totalAmount: 100,
    statusHistory: [{ status: "PREPARING", at: new Date().toISOString() }],
  });
  await seedPlain(`orders/order-admin-dispatch-${runId}`, {
    customerId: customer.uid,
    shopId: "shop-a",
    deliveryTaskId: `task-admin-dispatch-${runId}`,
    orderStatus: "READY_FOR_PICKUP",
    totalAmount: 100,
    statusHistory: [{ status: "READY_FOR_PICKUP", at: new Date().toISOString() }],
  });
  await seedPlain(`deliveryTasks/task-admin-dispatch-${runId}`, {
    orderId: `order-admin-dispatch-${runId}`,
    shopId: "shop-a",
    status: "AVAILABLE",
  });
  await seedPlain("payments/pay-1", { orderId: "order-1", status: "COD_PENDING", amount: 500 });

  // Orders staged at different lifecycle points for transition assertions.
  await seedPlain("orders/order-2", {
    customerId: customer.uid,
    shopId: "shop-a",
    orderStatus: "PLACED",
    totalAmount: 100,
    statusHistory: [],
  });
  await seedPlain("orders/order-3", {
    customerId: customer.uid,
    shopId: "shop-a",
    orderStatus: "PLACED",
    totalAmount: 100,
    statusHistory: [],
  });
  await seedPlain(
    "orders/order-demo-payment-pending",
    orderCreateFixture(customer.uid, {
      paymentMethod: "DEMO_UPI",
      paymentStatus: "PENDING",
    }),
  );
  await seedPlain("orders/order-4", {
    customerId: customer.uid,
    shopId: "shop-a",
    orderStatus: "PLACED",
    totalAmount: 100,
    statusHistory: [],
  });
  await seedPlain("orders/order-5", {
    customerId: customer.uid,
    shopId: "shop-a",
    deliveryTaskId: "task-taken",
    orderStatus: "PICKED_UP",
    totalAmount: 100,
    statusHistory: [],
  });

  console.log("Running rules assertions...\n");

  // --- users -------------------------------------------------------------
  const createOwnProfile = await createUserProfile(fresh.idToken, fresh.uid, {
    uid: fresh.uid,
    displayName: "Fresh Customer",
    email: fresh.email,
    capabilities: ["customer"],
    status: "active",
    createdAt: null,
    updatedAt: null,
  });
  record(
    "customer",
    "create own customer profile",
    "allow",
    createOwnProfile.ok ? "allow" : "deny",
  );
  const createPrivilegedProfile = await createUserProfile(escalated.idToken, escalated.uid, {
    uid: escalated.uid,
    displayName: "Escalated",
    email: escalated.email,
    capabilities: ["customer", "admin"],
    status: "active",
    createdAt: null,
    updatedAt: null,
  });
  record(
    "customer",
    "create own privileged profile",
    "deny",
    createPrivilegedProfile.ok ? "allow" : "deny",
  );
  const createMismatchedProfile = await createUserProfile(escalated.idToken, escalated.uid, {
    uid: "another-users-uid",
    displayName: "Mismatched",
    email: escalated.email,
    capabilities: ["customer"],
    status: "active",
    createdAt: null,
    updatedAt: null,
  });
  record(
    "customer",
    "create profile with mismatched uid",
    "deny",
    createMismatchedProfile.ok ? "allow" : "deny",
  );
  await expect("customer", "read own profile", "allow", () =>
    getDoc(customer.idToken, `users/${customer.uid}`),
  );
  await expect("customer", "read another profile", "deny", () =>
    getDoc(customer.idToken, `users/${other.uid}`),
  );
  await expect("customer", "self-grant admin capability", "deny", () =>
    patchDoc(customer.idToken, `users/${customer.uid}`, { capabilities: ["customer", "admin"] }),
  );
  await expect("customer", "self-grant retailer capability", "deny", () =>
    patchDoc(customer.idToken, `users/${customer.uid}`, { capabilities: ["customer", "retailer"] }),
  );
  await expect("customer", "self-grant worker capability", "deny", () =>
    patchDoc(customer.idToken, `users/${customer.uid}`, {
      capabilities: ["customer", "deliveryWorker"],
    }),
  );
  await expect("customer", "edit own name", "allow", () =>
    patchDoc(customer.idToken, `users/${customer.uid}`, { displayName: "Cust Renamed" }),
  );
  await expect("legacy worker", "migrate legacy profile uid and status", "allow", () =>
    patchDoc(legacyWorker.idToken, `users/${legacyWorker.uid}`, {
      uid: legacyWorker.uid,
      status: "active",
    }),
  );
  await expect("customer", "cannot reactivate suspended profile", "deny", () =>
    patchDoc(suspended.idToken, `users/${suspended.uid}`, { status: "active" }),
  );
  await expect("suspended", "read own suspended profile", "allow", () =>
    getDoc(suspended.idToken, `users/${suspended.uid}`),
  );
  await expect("suspended", "read private address while suspended", "deny", () =>
    getDoc(suspended.idToken, `addresses/addr-${customer.uid}`),
  );
  await expect("suspended", "create order while suspended", "deny", () =>
    createDoc(suspended.idToken, "orders", {
      customerId: suspended.uid,
      shopId: "shop-a",
      orderStatus: "PLACED",
    }),
  );
  await expect("admin", "suspend active profile", "allow", () =>
    patchDoc(admin.idToken, `users/${fresh.uid}`, { status: "suspended" }),
  );
  await expect("suspended", "suspended profile cannot create an address", "deny", () =>
    createDoc(fresh.idToken, "addresses", { userId: fresh.uid, label: "Home" }),
  );
  await expect("retailer", "read a customer profile (admin only)", "deny", () =>
    getDoc(retailer.uid ? retailer.idToken : "", `users/${customer.uid}`),
  );
  await expect("admin", "read any profile", "allow", () =>
    getDoc(admin.idToken, `users/${customer.uid}`),
  );
  await expect("admin", "delete a profile through the client", "deny", () =>
    fetch(`${FS}/users/${other.uid}`, { method: "DELETE", headers: req(admin.idToken) }),
  );
  await expect("admin", "grant retailer capability without approval", "deny", () =>
    patchDoc(admin.idToken, `users/${other.uid}`, { capabilities: ["customer", "retailer"] }),
  );
  await expect("admin", "grant worker capability", "allow", () =>
    patchDoc(admin.idToken, `users/${other.uid}`, {
      capabilities: ["customer", "delivery_worker"],
    }),
  );
  await expect("admin", "grant legacy worker alias", "deny", () =>
    patchDoc(admin.idToken, `users/${other.uid}`, {
      capabilities: ["customer", "retailer", "delivery_worker", "deliveryWorker"],
    }),
  );
  await expect("admin", "grant admin capability", "deny", () =>
    patchDoc(admin.idToken, `users/${other.uid}`, { capabilities: ["customer", "admin"] }),
  );

  // --- retailer applications --------------------------------------------
  const approvalApplication = applicationFixture(
    approvalApplicant.uid,
    approvalApplicant.email,
    "Approved Market",
  );
  const createApprovalApplication = await writeWithTimestamps(
    approvalApplicant.idToken,
    `retailerApplications/${approvalApplicant.uid}`,
    approvalApplication,
    ["createdAt", "updatedAt"],
    false,
  );
  record(
    "customer applicant",
    "create own retailer application",
    "allow",
    createApprovalApplication.ok ? "allow" : "deny",
  );
  await expect("customer applicant", "read own retailer application", "allow", () =>
    getDoc(approvalApplicant.idToken, `retailerApplications/${approvalApplicant.uid}`),
  );
  await expect("customer", "read another customer's application", "deny", () =>
    getDoc(customer.idToken, `retailerApplications/${approvalApplicant.uid}`),
  );
  await expect("admin", "query retailer applications", "allow", () =>
    runQuery(admin.idToken, "retailerApplications", []),
  );
  await expect("customer applicant", "edit pending application", "deny", () =>
    patchDoc(approvalApplicant.idToken, `retailerApplications/${approvalApplicant.uid}`, {
      shopName: "Changed without resubmission",
    }),
  );
  await expect("customer applicant", "self-approve application", "deny", () =>
    writeWithTimestamps(
      approvalApplicant.idToken,
      `retailerApplications/${approvalApplicant.uid}`,
      {
        status: "APPROVED",
        reviewedBy: approvalApplicant.uid,
        shopId: `shop-self-approved-${runId}`,
      },
      ["reviewedAt", "updatedAt"],
      true,
    ),
  );
  await expect("customer applicant", "self-grant retailer capability after applying", "deny", () =>
    patchDoc(approvalApplicant.idToken, `users/${approvalApplicant.uid}`, {
      capabilities: ["customer", "retailer"],
    }),
  );

  const approvedShopId = `shop-approved-${runId}`;
  const approvalCommit = await commitWrites(admin.idToken, [
    {
      path: `retailerApplications/${approvalApplicant.uid}`,
      data: {
        status: "APPROVED",
        reviewedBy: admin.uid,
        shopId: approvedShopId,
      },
      timestampFields: ["reviewedAt", "updatedAt"],
      fieldPaths: ["status", "reviewedBy", "reviewedAt", "updatedAt", "shopId"],
      exists: true,
    },
    {
      path: `users/${approvalApplicant.uid}`,
      data: { capabilities: ["customer", "retailer"] },
      timestampFields: ["updatedAt"],
      fieldPaths: ["capabilities", "updatedAt"],
      exists: true,
    },
    {
      path: `shops/${approvedShopId}`,
      data: {
        ownerId: approvalApplicant.uid,
        name: approvalApplication.shopName,
        category: approvalApplication.category,
        description: approvalApplication.description,
        phone: approvalApplication.shopPhone,
        address: `${approvalApplication.address}, ${approvalApplication.city}, ${approvalApplication.state} ${approvalApplication.postalCode}`,
        openingTime: approvalApplication.openingTime,
        closingTime: approvalApplication.closingTime,
        status: "ACTIVE",
      },
      timestampFields: ["createdAt", "updatedAt"],
      exists: false,
    },
  ]);
  record(
    "admin",
    "approve application, grant capability and create owned shop atomically",
    "allow",
    approvalCommit.ok ? "allow" : "deny",
  );
  if (!approvalCommit.ok) results.at(-1).detail = await approvalCommit.text();
  await expect("approved applicant", "read approved application", "allow", () =>
    getDoc(approvalApplicant.idToken, `retailerApplications/${approvalApplicant.uid}`),
  );
  await expect("approved applicant", "read application-linked shop", "allow", () =>
    getDoc(approvalApplicant.idToken, `shops/${approvedShopId}`),
  );
  await expect("admin", "cannot re-review an approved application", "deny", () =>
    patchDoc(admin.idToken, `retailerApplications/${approvalApplicant.uid}`, {
      status: "REJECTED",
    }),
  );

  const rejectedApplication = applicationFixture(
    rejectedApplicant.uid,
    rejectedApplicant.email,
    "Resubmitting Market",
  );
  const createRejectedApplication = await writeWithTimestamps(
    rejectedApplicant.idToken,
    `retailerApplications/${rejectedApplicant.uid}`,
    rejectedApplication,
    ["createdAt", "updatedAt"],
    false,
  );
  record(
    "customer applicant",
    "create application for rejection test",
    "allow",
    createRejectedApplication.ok ? "allow" : "deny",
  );
  await expect("admin", "reject pending application with a reason", "allow", () =>
    writeWithTimestamps(
      admin.idToken,
      `retailerApplications/${rejectedApplicant.uid}`,
      {
        status: "REJECTED",
        reviewedBy: admin.uid,
        rejectionReason: "Please provide a clearer shop description.",
      },
      ["reviewedAt", "updatedAt"],
      true,
    ),
  );
  await expect("admin", "reject application without a reason", "deny", () =>
    writeWithTimestamps(
      admin.idToken,
      `retailerApplications/${rejectedApplicant.uid}`,
      {
        status: "REJECTED",
        reviewedBy: admin.uid,
        rejectionReason: "",
      },
      ["reviewedAt", "updatedAt"],
      true,
    ),
  );
  await expect("customer applicant", "resubmit rejected application", "allow", () =>
    writeWithTimestamps(
      rejectedApplicant.idToken,
      `retailerApplications/${rejectedApplicant.uid}`,
      { ...rejectedApplication, applicantName: "Updated Applicant", status: "PENDING" },
      ["updatedAt"],
      true,
      [
        ...Object.keys(rejectedApplication),
        "applicantName",
        "updatedAt",
        "reviewedAt",
        "reviewedBy",
        "rejectionReason",
        "shopId",
      ],
    ),
  );
  await expect("resubmitted applicant", "still lacks retailer capability", "deny", () =>
    patchDoc(rejectedApplicant.idToken, `users/${rejectedApplicant.uid}`, {
      capabilities: ["customer", "retailer"],
    }),
  );

  // --- shops -------------------------------------------------------------
  await expect("customer", "read ACTIVE shop", "allow", () =>
    getDoc(customer.idToken, "shops/shop-a"),
  );
  await expect("customer", "read inactive shop", "deny", () =>
    getDoc(customer.idToken, "shops/shop-inactive"),
  );
  await expect("admin", "read inactive shop", "allow", () =>
    getDoc(admin.idToken, "shops/shop-inactive"),
  );
  await expect("customer", "query ACTIVE shops", "allow", () =>
    runQuery(customer.idToken, "shops", [fieldFilter("status", "EQUAL", "ACTIVE")]),
  );
  await expect("anonymous", "read public ACTIVE shop", "allow", () => getDoc(null, "shops/shop-a"));
  await expect("anonymous", "read inactive shop", "deny", () => getDoc(null, "shops/shop-b"));
  await expect("customer", "query shops without an ACTIVE filter", "deny", () =>
    runQuery(customer.idToken, "shops", []),
  );
  await expect("admin", "query all shops", "allow", () => runQuery(admin.idToken, "shops", []));
  await expect("retailer", "query own shop by owner", "allow", () =>
    runQuery(retailer.idToken, "shops", [fieldFilter("ownerId", "EQUAL", retailer.uid)]),
  );
  await expect("retailer two", "query own inactive shop by owner", "allow", () =>
    runQuery(retailerTwo.idToken, "shops", [fieldFilter("ownerId", "EQUAL", retailerTwo.uid)]),
  );
  await expect("suspended retailer", "query own shop", "deny", () =>
    runQuery(suspended.idToken, "shops", [fieldFilter("ownerId", "EQUAL", suspended.uid)]),
  );
  await expect("retailer", "read another retailer's inactive shop", "deny", () =>
    getDoc(retailer.idToken, "shops/shop-b"),
  );
  await expect("retailer", "update another retailer's shop", "deny", () =>
    writeWithTimestamps(
      retailer.idToken,
      "shops/shop-b",
      { name: "Hijacked" },
      ["updatedAt"],
      true,
    ),
  );
  await expect("retailer", "update own shop", "allow", () =>
    writeWithTimestamps(
      retailer.idToken,
      "shops/shop-a",
      { name: "Green Basket v2" },
      ["updatedAt"],
      true,
    ),
  );
  await expect("retailer", "change own shop owner", "deny", () =>
    writeWithTimestamps(
      retailer.idToken,
      "shops/shop-a",
      { ownerId: other.uid },
      ["updatedAt"],
      true,
    ),
  );
  await expect("retailer", "create a shop", "deny", () =>
    writeWithTimestamps(
      retailer.idToken,
      "shops/shop-retailer-created",
      {
        ownerId: retailer.uid,
        name: "Unapproved",
        category: "grocery",
        address: "4 Market Road",
        status: "ACTIVE",
      },
      ["createdAt", "updatedAt"],
      false,
    ),
  );
  await expect("admin", "create a valid shop", "allow", () =>
    writeWithTimestamps(
      admin.idToken,
      `shops/shop-admin-created-${runId}`,
      {
        ownerId: retailer.uid,
        name: "Admin Created",
        category: "grocery",
        address: "5 Market Road",
        status: "ACTIVE",
      },
      ["createdAt", "updatedAt"],
      false,
    ),
  );
  await expect("customer", "update a shop", "deny", () =>
    writeWithTimestamps(customer.idToken, "shops/shop-a", { name: "Nope" }, ["updatedAt"], true),
  );

  // --- products ----------------------------------------------------------
  await expect("customer", "read in-stock product", "allow", () =>
    getDoc(customer.idToken, "products/prod-a"),
  );
  await expect("customer", "read out-of-stock product", "deny", () =>
    getDoc(customer.idToken, "products/prod-hidden"),
  );
  await expect("anonymous", "read public in-stock product", "allow", () =>
    getDoc(null, "products/prod-a"),
  );
  await expect("customer", "read available product with zero stock", "deny", () =>
    getDoc(customer.idToken, "products/prod-empty-available"),
  );
  await expect("customer", "read product from inactive shop", "deny", () =>
    getDoc(customer.idToken, "products/prod-b"),
  );
  await expect("customer", "query available products scoped to a shop", "allow", () =>
    runQuery(customer.idToken, "products", [
      fieldFilter("shopId", "EQUAL", "shop-a"),
      fieldFilter("availability", "EQUAL", true),
      fieldFilter("stock", "GREATER_THAN", 0),
    ]),
  );
  await expect("customer", "query products without public-read filters", "deny", () =>
    runQuery(customer.idToken, "products", []),
  );
  await expect("admin", "query all products", "allow", () =>
    runQuery(admin.idToken, "products", []),
  );
  await expect("retailer", "query products in own shop", "allow", () =>
    runQuery(retailer.idToken, "products", [fieldFilter("shopId", "EQUAL", "shop-a")]),
  );
  await expect("retailer two", "query products in own inactive shop", "allow", () =>
    runQuery(retailerTwo.idToken, "products", [fieldFilter("shopId", "EQUAL", "shop-b")]),
  );
  await expect("retailer", "query products in another shop", "deny", () =>
    runQuery(retailer.idToken, "products", [fieldFilter("shopId", "EQUAL", "shop-b")]),
  );
  await expect("retailer", "create product in own shop", "allow", () =>
    writeWithTimestamps(
      retailer.idToken,
      "products/prod-retailer-created",
      {
        shopId: "shop-a",
        name: "Dal",
        description: "Split pigeon peas",
        category: "grocery",
        price: 155,
        stock: 5,
        availability: true,
      },
      ["createdAt", "updatedAt"],
      false,
    ),
  );
  await expect("retailer", "create product in another shop", "deny", () =>
    writeWithTimestamps(
      retailer.idToken,
      "products/prod-cross-shop",
      {
        shopId: "shop-b",
        name: "Stolen",
        description: "Unauthorized",
        category: "grocery",
        price: 1,
        stock: 1,
        availability: true,
      },
      ["createdAt", "updatedAt"],
      false,
    ),
  );
  await expect("retailer", "create product for nonexistent shop", "deny", () =>
    writeWithTimestamps(
      retailer.idToken,
      "products/prod-no-shop",
      {
        shopId: "missing-shop",
        name: "Nowhere",
        category: "grocery",
        price: 1,
        stock: 1,
        availability: true,
      },
      ["createdAt", "updatedAt"],
      false,
    ),
  );
  await expect("retailer", "update own product", "allow", () =>
    writeWithTimestamps(retailer.idToken, "products/prod-a", { price: 345 }, ["updatedAt"], true),
  );
  await expect("retailer", "set own product Storage image metadata", "allow", () =>
    writeWithTimestamps(
      retailer.idToken,
      "products/prod-a",
      {
        imageSource: {
          type: "uploaded",
          ref: "https://firebasestorage.googleapis.com/emulator-image",
          storagePath: "shops/shop-a/products/prod-a/image-product-image.webp",
        },
      },
      ["updatedAt"],
      true,
    ),
  );
  await expect("retailer", "cannot point own product at another shop's image path", "deny", () =>
    writeWithTimestamps(
      retailer.idToken,
      "products/prod-a",
      {
        imageSource: {
          type: "uploaded",
          ref: "https://firebasestorage.googleapis.com/emulator-image",
          storagePath: "shops/shop-b/products/prod-a/image-product-image.webp",
        },
      },
      ["updatedAt"],
      true,
    ),
  );
  await expect("retailer", "update another shop's product", "deny", () =>
    writeWithTimestamps(retailer.idToken, "products/prod-b", { price: 11 }, ["updatedAt"], true),
  );
  await expect("retailer", "change product shop ownership", "deny", () =>
    writeWithTimestamps(
      retailer.idToken,
      "products/prod-a",
      { shopId: "shop-b" },
      ["updatedAt"],
      true,
    ),
  );
  await expect("retailer", "write invalid product stock", "deny", () =>
    writeWithTimestamps(retailer.idToken, "products/prod-a", { stock: -1 }, ["updatedAt"], true),
  );
  await expect("retailer", "mark zero-stock product available", "deny", () =>
    writeWithTimestamps(
      retailer.idToken,
      "products/prod-a",
      { stock: 0, availability: true },
      ["updatedAt"],
      true,
    ),
  );
  await expect("admin", "update product", "allow", () =>
    writeWithTimestamps(admin.idToken, "products/prod-b", { price: 12 }, ["updatedAt"], true),
  );
  await expect("retailer", "delete own product", "allow", () =>
    fetch(`${FS}/products/prod-retailer-created`, {
      method: "DELETE",
      headers: req(retailer.idToken),
    }),
  );
  await expect("customer", "update a product price", "deny", () =>
    patchDoc(customer.idToken, "products/prod-a", { price: 1 }),
  );

  // --- addresses ---------------------------------------------------------
  await expect("customer", "read own address", "allow", () =>
    getDoc(customer.idToken, `addresses/addr-${customer.uid}`),
  );
  await expect("other", "read someone else's address", "deny", () =>
    getDoc(other.idToken, `addresses/addr-${customer.uid}`),
  );
  await expect("customer", "create address owned by someone else", "deny", () =>
    createDoc(customer.idToken, "addresses", { userId: other.uid, label: "Theirs" }),
  );

  // --- orders ------------------------------------------------------------
  await expect("customer", "read own order", "allow", () =>
    getDoc(customer.idToken, "orders/order-1"),
  );
  await expect("other", "read another customer's order", "deny", () =>
    getDoc(other.idToken, "orders/order-1"),
  );
  await expect("retailer", "read own shop's order", "allow", () =>
    getDoc(retailer.idToken, "orders/order-1"),
  );
  await expect("customer", "create own order starting PLACED", "allow", () =>
    commitWrites(customer.idToken, [
      {
        path: `orders/order-created-valid-${Date.now()}`,
        data: orderCreateFixture(customer.uid),
        timestampFields: ["createdAt", "updatedAt"],
        exists: false,
      },
    ]),
  );
  await expect("customer", "cannot create an online order from the client", "deny", () =>
    commitWrites(customer.idToken, [
      {
        path: "orders/order-client-demo-payment",
        data: orderCreateFixture(customer.uid, {
          paymentMethod: "DEMO_UPI",
          paymentStatus: "PENDING",
        }),
        timestampFields: ["createdAt", "updatedAt"],
        exists: false,
      },
    ]),
  );
  await expect("customer", "create order for another customerId", "deny", () =>
    commitWrites(customer.idToken, [
      {
        path: "orders/order-created-other-customer",
        data: orderCreateFixture(other.uid),
        timestampFields: ["createdAt", "updatedAt"],
        exists: false,
      },
    ]),
  );
  await expect("customer", "create order skipping straight to DELIVERED", "deny", () =>
    commitWrites(customer.idToken, [
      {
        path: "orders/order-created-skipped",
        data: orderCreateFixture(customer.uid, {
          orderStatus: "DELIVERED",
          statusHistory: [{ status: "DELIVERED", at: new Date().toISOString() }],
        }),
        timestampFields: ["createdAt", "updatedAt"],
        exists: false,
      },
    ]),
  );
  await expect("customer", "change order total", "deny", () =>
    patchDoc(customer.idToken, "orders/order-1", { totalAmount: 1 }),
  );
  await expect("customer", "cancel own order", "allow", () =>
    writeWithTimestamps(
      customer.idToken,
      "orders/order-1",
      {
        orderStatus: "CANCELLED",
        statusHistory: appendOrderStatus([], "CANCELLED"),
      },
      ["updatedAt"],
      true,
    ),
  );
  await expect("customer", "delete own order", "deny", () =>
    fetch(`${FS}/orders/order-1`, { method: "DELETE", headers: req(customer.idToken) }),
  );
  await expect("worker", "cannot advance an order without its task", "deny", () =>
    patchDoc(worker.idToken, "orders/order-6", {
      orderStatus: "DELIVERED",
      statusHistory: appendOrderStatus([{ status: "OUT_FOR_DELIVERY", at: "before" }], "DELIVERED"),
    }),
  );
  await expect("admin", "cannot change order status without a matching task update", "deny", () =>
    patchDoc(admin.idToken, "orders/order-6", {
      orderStatus: "DELIVERED",
      statusHistory: appendOrderStatus([{ status: "OUT_FOR_DELIVERY", at: "before" }], "DELIVERED"),
    }),
  );
  await expect("customer", "advance own order status", "deny", () =>
    patchDoc(customer.idToken, "orders/order-1", { orderStatus: "PREPARING" }),
  );

  // --- lifecycle integrity (no skipped states) ---------------------------
  await expect("retailer", "legal step: PLACED -> RETAILER_REVIEW", "allow", () =>
    writeWithTimestamps(
      retailer.idToken,
      "orders/order-2",
      {
        orderStatus: "RETAILER_REVIEW",
        statusHistory: appendOrderStatus([], "RETAILER_REVIEW"),
      },
      ["updatedAt"],
      true,
    ),
  );
  await expect("retailer", "cannot mark an order paid while processing it", "deny", () =>
    writeWithTimestamps(
      retailer.idToken,
      "orders/order-3",
      {
        orderStatus: "RETAILER_REVIEW",
        paymentStatus: "PAID",
        statusHistory: appendOrderStatus([], "RETAILER_REVIEW"),
      },
      ["updatedAt"],
      true,
    ),
  );
  await expect("retailer", "cannot process an online order before verified payment", "deny", () =>
    writeWithTimestamps(
      retailer.idToken,
      "orders/order-demo-payment-pending",
      {
        orderStatus: "RETAILER_REVIEW",
        statusHistory: appendOrderStatus([{ status: "PLACED", at: "before" }], "RETAILER_REVIEW"),
      },
      ["updatedAt"],
      true,
    ),
  );
  await expect("retailer", "skip states: PLACED -> READY_FOR_PICKUP", "deny", () =>
    patchDoc(retailer.idToken, "orders/order-3", { orderStatus: "READY_FOR_PICKUP" }),
  );
  await expect("retailer", "backwards: PLACED -> DELIVERED", "deny", () =>
    patchDoc(retailer.idToken, "orders/order-4", { orderStatus: "DELIVERED" }),
  );
  await expect("worker", "skip delivery states on own task's order", "deny", () =>
    patchDoc(worker.idToken, "orders/order-5", { orderStatus: "DELIVERED" }),
  );
  await expect("worker", "worker cannot move a retailer-stage order", "deny", () =>
    patchDoc(worker.idToken, "orders/order-2", { orderStatus: "PREPARING" }),
  );

  // --- deliveryTasks -----------------------------------------------------
  await expect("worker", "read open board", "allow", () =>
    getDoc(worker.idToken, "deliveryTasks/task-open"),
  );
  await expect("anonymous", "cannot read delivery task", "deny", () =>
    getDoc(null, "deliveryTasks/task-open"),
  );
  await expect("customer", "cannot read delivery task directly", "deny", () =>
    getDoc(customer.idToken, "deliveryTasks/task-open"),
  );
  await expect("legacy worker", "read open board with legacy capability", "allow", () =>
    getDoc(legacyWorker.idToken, "deliveryTasks/task-open"),
  );
  await expect("worker", "claim task and assign order atomically", "allow", () =>
    commitWrites(worker.idToken, [
      {
        path: "deliveryTasks/task-open",
        data: { status: "DELIVERY_ASSIGNED", deliveryWorkerId: worker.uid },
        timestampFields: ["assignedAt", "updatedAt"],
      },
      {
        path: "orders/order-open",
        data: {
          orderStatus: "DELIVERY_ASSIGNED",
          statusHistory: appendOrderStatus(
            [{ status: "READY_FOR_PICKUP", at: "before" }],
            "DELIVERY_ASSIGNED",
          ),
        },
        timestampFields: ["updatedAt"],
      },
    ]),
  );
  await expect("worker", "advance task and order atomically", "allow", () =>
    commitWrites(worker.idToken, [
      {
        path: "deliveryTasks/task-taken",
        data: { status: "PICKED_UP" },
        timestampFields: ["pickedUpAt", "updatedAt"],
      },
      {
        path: "orders/order-taken",
        data: {
          orderStatus: "PICKED_UP",
          statusHistory: appendOrderStatus(
            [{ status: "DELIVERY_ASSIGNED", at: "before" }],
            "PICKED_UP",
          ),
        },
        timestampFields: ["updatedAt"],
      },
    ]),
  );
  // Separate fixtures: the assertion above already moved task-taken forward, so
  // reusing it here would no longer test a skipped state.
  await expect("worker", "skip a lifecycle state on own task", "deny", () =>
    patchDoc(worker.idToken, "deliveryTasks/task-untouched", { status: "OUT_FOR_DELIVERY" }),
  );
  await expect("worker", "legal final step on task and order", "allow", () =>
    commitWrites(worker.idToken, [
      {
        path: "deliveryTasks/task-legit",
        data: { status: "DELIVERED" },
        timestampFields: ["deliveredAt", "updatedAt"],
      },
      {
        path: "orders/order-6",
        data: {
          orderStatus: "DELIVERED",
          statusHistory: appendOrderStatus(
            [{ status: "OUT_FOR_DELIVERY", at: "before" }],
            "DELIVERED",
          ),
        },
        timestampFields: ["updatedAt"],
      },
    ]),
  );
  await expect("customer", "claim a delivery task", "deny", () =>
    patchDoc(customer.idToken, "deliveryTasks/task-open", {
      status: "DELIVERY_ASSIGNED",
      deliveryWorkerId: customer.uid,
    }),
  );
  await expect("retailer", "cannot claim a delivery task", "deny", () =>
    patchDoc(retailer.idToken, "deliveryTasks/task-open", {
      status: "DELIVERY_ASSIGNED",
      deliveryWorkerId: retailer.uid,
    }),
  );
  await expect("worker two", "cannot claim a task already assigned to another worker", "deny", () =>
    commitWrites(workerB.idToken, [
      {
        path: `deliveryTasks/task-already-claimed-${runId}`,
        data: { status: "DELIVERY_ASSIGNED", deliveryWorkerId: workerB.uid },
      },
      {
        path: `orders/order-already-claimed-${runId}`,
        data: {
          orderStatus: "DELIVERY_ASSIGNED",
          statusHistory: appendOrderStatus(
            [{ status: "DELIVERY_ASSIGNED", at: "before" }],
            "DELIVERY_ASSIGNED",
          ),
        },
      },
    ]),
  );
  await expect("offline worker", "cannot claim task while marked unavailable", "deny", () =>
    commitWrites(offlineWorker.idToken, [
      {
        path: `deliveryTasks/task-offline-${runId}`,
        data: { status: "DELIVERY_ASSIGNED", deliveryWorkerId: offlineWorker.uid },
        timestampFields: ["assignedAt", "updatedAt"],
      },
      {
        path: `orders/order-offline-${runId}`,
        data: {
          orderStatus: "DELIVERY_ASSIGNED",
          statusHistory: appendOrderStatus(
            [{ status: "READY_FOR_PICKUP", at: "before" }],
            "DELIVERY_ASSIGNED",
          ),
        },
        timestampFields: ["updatedAt"],
      },
    ]),
  );
  await expect("worker", "can update own availability safely", "allow", () =>
    writeWithTimestamps(
      worker.idToken,
      `users/${worker.uid}`,
      { available: true },
      ["updatedAt"],
      true,
      ["available", "updatedAt"],
    ),
  );
  await expect("worker two", "cannot update another worker's task", "deny", () =>
    patchDoc(workerB.idToken, "deliveryTasks/task-taken", { status: "OUT_FOR_DELIVERY" }),
  );
  await expect("worker two", "cannot modify delivered task", "deny", () =>
    patchDoc(workerB.idToken, `deliveryTasks/task-delivered-${runId}`, {
      status: "PICKED_UP",
    }),
  );
  await expect("worker two", "cannot modify failed task", "deny", () =>
    patchDoc(workerB.idToken, `deliveryTasks/task-failed-${runId}`, {
      status: "OUT_FOR_DELIVERY",
    }),
  );
  await expect("worker", "cannot report failure before out for delivery", "deny", () =>
    patchDoc(worker.idToken, "deliveryTasks/task-open", {
      status: "DELIVERY_FAILED",
      failureReason: "Customer unavailable",
    }),
  );

  const readyOrderId = `order-ready-create-${runId}`;
  const readyTaskId = `task-${readyOrderId}`;
  const readyTask = {
    orderId: readyOrderId,
    shopId: "shop-a",
    status: "AVAILABLE",
    pickupLocation: { latitude: 12.9, longitude: 77.5 },
    deliveryLocation: { latitude: 12.91, longitude: 77.51 },
    distance: 1.5,
    deliveryFee: 29,
  };
  await expect("retailer", "create exactly one task with READY_FOR_PICKUP", "allow", () =>
    commitWrites(retailer.idToken, [
      {
        path: `orders/${readyOrderId}`,
        data: {
          orderStatus: "READY_FOR_PICKUP",
          deliveryTaskId: readyTaskId,
          statusHistory: appendOrderStatus(
            [{ status: "PREPARING", at: "before" }],
            "READY_FOR_PICKUP",
          ),
        },
        timestampFields: ["updatedAt"],
      },
      {
        path: `deliveryTasks/${readyTaskId}`,
        data: readyTask,
        timestampFields: ["createdAt", "updatedAt"],
        exists: false,
      },
    ]),
  );
  await expect("retailer", "cannot create a duplicate task for one order", "deny", () =>
    commitWrites(retailer.idToken, [
      {
        path: `deliveryTasks/task-duplicate-${readyOrderId}`,
        data: readyTask,
        timestampFields: ["createdAt", "updatedAt"],
        exists: false,
      },
    ]),
  );
  await expect("admin", "cannot create a delivery task without a valid order", "deny", () =>
    commitWrites(admin.idToken, [
      {
        path: `deliveryTasks/task-orphan-${runId}`,
        data: {
          ...readyTask,
          orderId: `order-orphan-${runId}`,
        },
        timestampFields: ["createdAt", "updatedAt"],
        exists: false,
      },
    ]),
  );

  const adminTaskId = `task-admin-dispatch-${runId}`;
  const adminOrderId = `order-admin-dispatch-${runId}`;
  await expect("admin", "assign eligible worker atomically", "allow", () =>
    commitWrites(admin.idToken, [
      {
        path: `deliveryTasks/${adminTaskId}`,
        data: { status: "DELIVERY_ASSIGNED", deliveryWorkerId: worker.uid },
        timestampFields: ["assignedAt", "updatedAt"],
      },
      {
        path: `orders/${adminOrderId}`,
        data: {
          orderStatus: "DELIVERY_ASSIGNED",
          statusHistory: appendOrderStatus(
            [{ status: "READY_FOR_PICKUP", at: "before" }],
            "DELIVERY_ASSIGNED",
          ),
        },
        timestampFields: ["updatedAt"],
      },
    ]),
  );
  await expect("admin", "cannot dispatch to an unavailable worker", "deny", () =>
    commitWrites(admin.idToken, [
      {
        path: `deliveryTasks/task-offline-${runId}`,
        data: {
          status: "DELIVERY_ASSIGNED",
          deliveryWorkerId: offlineWorker.uid,
        },
        timestampFields: ["assignedAt", "updatedAt"],
      },
      {
        path: `orders/order-offline-${runId}`,
        data: {
          orderStatus: "DELIVERY_ASSIGNED",
          statusHistory: appendOrderStatus(
            [{ status: "READY_FOR_PICKUP", at: "before" }],
            "DELIVERY_ASSIGNED",
          ),
        },
        timestampFields: ["updatedAt"],
      },
    ]),
  );
  await expect("worker two", "report delivery failure with reason atomically", "allow", () =>
    commitWrites(workerB.idToken, [
      {
        path: `deliveryTasks/task-failure-${runId}`,
        data: {
          status: "DELIVERY_FAILED",
          failureReason: "Customer unavailable",
        },
        timestampFields: ["failedAt", "updatedAt"],
      },
      {
        path: `orders/order-failure-${runId}`,
        data: {
          orderStatus: "DELIVERY_FAILED",
          statusHistory: appendOrderStatus(
            [{ status: "OUT_FOR_DELIVERY", at: "before" }],
            "DELIVERY_FAILED",
          ),
        },
        timestampFields: ["updatedAt"],
      },
    ]),
  );
  await expect("worker two", "cannot report failure without a meaningful reason", "deny", () =>
    commitWrites(workerB.idToken, [
      {
        path: `deliveryTasks/task-failure-no-reason-${runId}`,
        data: { status: "DELIVERY_FAILED" },
        timestampFields: ["failedAt", "updatedAt"],
      },
      {
        path: `orders/order-failure-no-reason-${runId}`,
        data: {
          orderStatus: "DELIVERY_FAILED",
          statusHistory: appendOrderStatus(
            [{ status: "OUT_FOR_DELIVERY", at: "before" }],
            "DELIVERY_FAILED",
          ),
        },
        timestampFields: ["updatedAt"],
      },
    ]),
  );
  await expect("admin", "cannot delete an order and leave a task orphaned", "deny", () =>
    fetch(`${FS}/orders/${adminOrderId}`, { method: "DELETE", headers: req(admin.idToken) }),
  );
  await expect("admin", "cannot delete a task referenced by an order", "deny", () =>
    fetch(`${FS}/deliveryTasks/${adminTaskId}`, {
      method: "DELETE",
      headers: req(admin.idToken),
    }),
  );

  const raceTaskId = `task-race-${runId}`;
  const raceOrderId = `order-race-${runId}`;
  const makeClaim = (actor) =>
    commitWrites(actor.idToken, [
      {
        path: `deliveryTasks/${raceTaskId}`,
        data: { status: "DELIVERY_ASSIGNED", deliveryWorkerId: actor.uid },
        timestampFields: ["assignedAt", "updatedAt"],
      },
      {
        path: `orders/${raceOrderId}`,
        data: {
          orderStatus: "DELIVERY_ASSIGNED",
          statusHistory: appendOrderStatus(
            [{ status: "READY_FOR_PICKUP", at: "before" }],
            "DELIVERY_ASSIGNED",
          ),
        },
        timestampFields: ["updatedAt"],
      },
    ]);
  const concurrentClaims = await Promise.all([makeClaim(worker), makeClaim(workerB)]);
  const winnerIndex = concurrentClaims.findIndex((response) => response.ok);
  record(
    "concurrency",
    "exactly one concurrent worker claim succeeds",
    "allow",
    concurrentClaims.filter((response) => response.ok).length === 1 ? "allow" : "deny",
  );
  if (winnerIndex >= 0) {
    const winningWorker = [worker, workerB][winnerIndex];
    const storedTaskResponse = await getDoc(winningWorker.idToken, `deliveryTasks/${raceTaskId}`);
    const storedTask = await storedTaskResponse.json();
    const storedWorkerId =
      storedTask.fields?.deliveryWorkerId?.stringValue ?? storedTask.fields?.deliveryWorkerId;
    record(
      "concurrency",
      "winning worker remains assigned without overwrite",
      "allow",
      storedWorkerId === winningWorker.uid ? "allow" : "deny",
    );
    const storedOrderResponse = await getDoc(winningWorker.idToken, `orders/${raceOrderId}`);
    const storedOrder = await storedOrderResponse.json();
    record(
      "concurrency",
      "concurrent claim leaves order synchronized",
      "allow",
      storedOrder.fields?.orderStatus?.stringValue === "DELIVERY_ASSIGNED" ? "allow" : "deny",
    );
  } else {
    record("concurrency", "winning worker remains assigned without overwrite", "allow", "deny");
    record("concurrency", "concurrent claim leaves order synchronized", "allow", "deny");
  }

  // --- categories / payments --------------------------------------------
  await expect("customer", "read ACTIVE category", "allow", () =>
    getDoc(customer.idToken, "categories/grocery"),
  );
  await expect("customer", "write a category", "deny", () =>
    patchDoc(customer.idToken, "categories/grocery", { name: "Hacked" }),
  );
  await expect("customer", "cannot read private payment session details", "deny", () =>
    getDoc(customer.idToken, "payments/pay-1"),
  );
  await expect("retailer", "cannot read payment provider details", "deny", () =>
    getDoc(retailer.idToken, "payments/pay-1"),
  );
  await expect("worker", "cannot read payment provider details", "deny", () =>
    getDoc(worker.idToken, "payments/pay-1"),
  );
  await expect("admin", "read payment for administration", "allow", () =>
    getDoc(admin.idToken, "payments/pay-1"),
  );
  await expect("customer", "write a payment", "deny", () =>
    createDoc(customer.idToken, "payments", { orderId: "order-1", amount: 1 }),
  );
  await expect("customer", "cannot mark own payment paid", "deny", () =>
    patchDoc(customer.idToken, "payments/pay-1", { status: "PAID" }),
  );
  await expect("admin", "write a payment", "deny", () =>
    createDoc(admin.idToken, "payments", { orderId: "order-1", amount: 1 }),
  );

  // --- unauthenticated ---------------------------------------------------
  await expect("anonymous", "create an order", "deny", () =>
    createDoc(null, "orders", {
      customerId: "x",
      shopId: "shop-a",
      orderStatus: "PLACED",
    }),
  );

  // --- report ------------------------------------------------------------
  const byActor = new Map();
  for (const r of results) {
    const entry = byActor.get(r.actor) ?? { pass: 0, fail: 0 };
    r.pass ? entry.pass++ : entry.fail++;
    byActor.set(r.actor, entry);
  }
  console.log("Results by actor:");
  for (const [actor, e] of byActor) {
    console.log(`  ${actor.padEnd(12)} ${e.pass} passed, ${e.fail} failed`);
  }

  const failed = results.filter((r) => !r.pass);
  if (failed.length) {
    console.log("\nFAILURES:");
    for (const f of failed) {
      console.log(`  [${f.actor}] ${f.action}: expected ${f.expected}, got ${f.actual}`);
      if (f.detail) console.log(`    ${f.detail}`);
    }
  }
  console.log(`\n${results.length - failures}/${results.length} assertions passed.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("rules validation crashed:", e);
  process.exit(2);
});
