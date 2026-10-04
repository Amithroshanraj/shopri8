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
const HOST = "127.0.0.1";
const AUTH = `http://${HOST}:9099/identitytoolkit.googleapis.com/v1`;
const FS = `http://${HOST}:8081/v1/projects/${PROJECT}/databases/(default)/documents`;
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
  try {
    const r = await fn();
    actual = r.ok ? "allow" : "deny";
  } catch (e) {
    actual = "deny";
  }
  record(actor, action, expected, actual);
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
  authorization: `Bearer ${token}`,
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
async function createDoc(token, collection, data) {
  return fetch(`${FS}/${collection}`, {
    method: "POST",
    headers: req(token),
    body: JSON.stringify({ fields: encodeFields(data) }),
  });
}

async function main() {
  console.log("Seeding SHOPRi8 fixtures into the Firestore emulator...\n");

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
  const worker = await makeUser("worker", {
    email: "worker@shopri8.test",
    password: "Password123!",
  });
  const admin = await makeUser("admin", {
    email: "admin@shopri8.test",
    password: "Password123!",
  });

  await seedPlain(`users/${customer.uid}`, { name: "Cust", capabilities: ["customer"] });
  await seedPlain(`users/${other.uid}`, { name: "Other", capabilities: ["customer"] });
  await seedPlain(`users/${retailer.uid}`, {
    name: "Green Basket",
    capabilities: ["retailer"],
  });
  await seedPlain(`users/${worker.uid}`, {
    name: "Arjun",
    capabilities: ["deliveryWorker"],
  });
  await seedPlain(`users/${admin.uid}`, { name: "Admin", capabilities: ["admin"] });

  await seedPlain("shops/shop-a", {
    ownerId: retailer.uid,
    name: "Shop A",
    status: "ACTIVE",
  });
  await seedPlain("shops/shop-b", {
    ownerId: "someone-else",
    name: "Shop B",
    status: "ACTIVE",
  });
  await seedPlain("products/prod-a", {
    shopId: "shop-a",
    name: "Rice",
    price: 340,
    stock: 10,
    availability: true,
  });
  await seedPlain("products/prod-hidden", {
    shopId: "shop-a",
    name: "Out of stock",
    price: 10,
    stock: 0,
    availability: false,
  });
  await seedPlain("categories/grocery", { name: "Grocery", status: "ACTIVE" });
  await seedPlain(`addresses/addr-${customer.uid}`, {
    userId: customer.uid,
    label: "Home",
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
    orderId: "order-1",
    shopId: "shop-a",
    status: "AVAILABLE",
  });
  await seedPlain("deliveryTasks/task-taken", {
    orderId: "order-1",
    shopId: "shop-a",
    status: "DELIVERY_ASSIGNED",
    deliveryWorkerId: worker.uid,
  });
  await seedPlain("deliveryTasks/task-untouched", {
    orderId: "order-1",
    shopId: "shop-a",
    status: "DELIVERY_ASSIGNED",
    deliveryWorkerId: worker.uid,
  });
  await seedPlain("deliveryTasks/task-legit", {
    orderId: "order-1",
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
    statusHistory: [],
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
  await expect("customer", "read own profile", "allow", () =>
    getDoc(customer.idToken, `users/${customer.uid}`),
  );
  await expect("customer", "read another profile", "deny", () =>
    getDoc(customer.idToken, `users/${other.uid}`),
  );
  await expect("customer", "self-grant admin capability", "deny", () =>
    patchDoc(customer.idToken, `users/${customer.uid}`, { capabilities: ["customer", "admin"] }),
  );
  await expect("customer", "edit own name", "allow", () =>
    patchDoc(customer.idToken, `users/${customer.uid}`, { name: "Cust Renamed" }),
  );
  await expect("retailer", "read a customer profile (admin only)", "deny", () =>
    getDoc(retailer.uid ? retailer.idToken : "", `users/${customer.uid}`),
  );
  await expect("admin", "read any profile", "allow", () =>
    getDoc(admin.idToken, `users/${customer.uid}`),
  );
  await expect("admin", "grant admin capability", "allow", () =>
    patchDoc(admin.idToken, `users/${other.uid}`, { capabilities: ["customer", "retailer"] }),
  );

  // --- shops -------------------------------------------------------------
  await expect("customer", "read ACTIVE shop", "allow", () =>
    getDoc(customer.idToken, "shops/shop-a"),
  );
  await expect("retailer", "read another retailer's shop", "allow", () =>
    getDoc(retailer.idToken, "shops/shop-b"),
  );
  await expect("retailer", "update another retailer's shop", "deny", () =>
    patchDoc(retailer.idToken, "shops/shop-b", { name: "Hijacked" }),
  );
  await expect("retailer", "update own shop", "allow", () =>
    patchDoc(retailer.idToken, "shops/shop-a", { name: "Green Basket v2" }),
  );
  await expect("customer", "update a shop", "deny", () =>
    patchDoc(customer.idToken, "shops/shop-a", { name: "Nope" }),
  );

  // --- products ----------------------------------------------------------
  await expect("customer", "read in-stock product", "allow", () =>
    getDoc(customer.idToken, "products/prod-a"),
  );
  await expect("customer", "read out-of-stock product", "deny", () =>
    getDoc(customer.idToken, "products/prod-hidden"),
  );
  await expect("retailer", "create product in own shop", "allow", () =>
    createDoc(retailer.idToken, "products", { shopId: "shop-a", name: "Dal", price: 155 }),
  );
  await expect("retailer", "create product in another shop", "deny", () =>
    createDoc(retailer.idToken, "products", { shopId: "shop-b", name: "Stolen", price: 1 }),
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
    createDoc(customer.idToken, "orders", {
      customerId: customer.uid,
      shopId: "shop-a",
      orderStatus: "PLACED",
      totalAmount: 100,
    }),
  );
  await expect("customer", "create order for another customerId", "deny", () =>
    createDoc(customer.idToken, "orders", {
      customerId: other.uid,
      shopId: "shop-a",
      orderStatus: "PLACED",
      totalAmount: 100,
    }),
  );
  await expect("customer", "create order skipping straight to DELIVERED", "deny", () =>
    createDoc(customer.idToken, "orders", {
      customerId: customer.uid,
      shopId: "shop-a",
      orderStatus: "DELIVERED",
      totalAmount: 100,
    }),
  );
  await expect("customer", "change order total", "deny", () =>
    patchDoc(customer.idToken, "orders/order-1", { totalAmount: 1 }),
  );
  await expect("customer", "cancel own order", "allow", () =>
    patchDoc(customer.idToken, "orders/order-1", { orderStatus: "CANCELLED" }),
  );
  await expect("customer", "delete own order", "deny", () =>
    fetch(`${FS}/orders/order-1`, { method: "DELETE", headers: req(customer.idToken) }),
  );
  await expect("worker", "advance order they are assigned to", "allow", () =>
    patchDoc(worker.idToken, "orders/order-6", { orderStatus: "DELIVERED" }),
  );
  await expect("customer", "advance own order status", "deny", () =>
    patchDoc(customer.idToken, "orders/order-1", { orderStatus: "PREPARING" }),
  );

  // --- lifecycle integrity (no skipped states) ---------------------------
  await expect("retailer", "legal step: PLACED -> RETAILER_REVIEW", "allow", () =>
    patchDoc(retailer.idToken, "orders/order-2", { orderStatus: "RETAILER_REVIEW" }),
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
  await expect("worker", "claim an AVAILABLE task", "allow", () =>
    patchDoc(worker.idToken, "deliveryTasks/task-open", {
      status: "DELIVERY_ASSIGNED",
      deliveryWorkerId: worker.uid,
    }),
  );
  await expect("worker", "advance own task to next legal state", "allow", () =>
    patchDoc(worker.idToken, "deliveryTasks/task-taken", { status: "PICKED_UP" }),
  );
  // Separate fixtures: the assertion above already moved task-taken forward, so
  // reusing it here would no longer test a skipped state.
  await expect("worker", "skip a lifecycle state on own task", "deny", () =>
    patchDoc(worker.idToken, "deliveryTasks/task-untouched", { status: "OUT_FOR_DELIVERY" }),
  );
  await expect("worker", "legal final step on own task", "allow", () =>
    patchDoc(worker.idToken, "deliveryTasks/task-legit", { status: "DELIVERED" }),
  );
  await expect("customer", "claim a delivery task", "deny", () =>
    patchDoc(customer.idToken, "deliveryTasks/task-open", {
      status: "DELIVERY_ASSIGNED",
      deliveryWorkerId: customer.uid,
    }),
  );

  // --- categories / payments --------------------------------------------
  await expect("customer", "read ACTIVE category", "allow", () =>
    getDoc(customer.idToken, "categories/grocery"),
  );
  await expect("customer", "write a category", "deny", () =>
    patchDoc(customer.idToken, "categories/grocery", { name: "Hacked" }),
  );
  await expect("customer", "read own order's payment", "allow", () =>
    getDoc(customer.idToken, "payments/pay-1"),
  );
  await expect("customer", "write a payment", "deny", () =>
    createDoc(customer.idToken, "payments", { orderId: "order-1", amount: 1 }),
  );
  await expect("admin", "write a payment", "deny", () =>
    createDoc(admin.idToken, "payments", { orderId: "order-1", amount: 1 }),
  );

  // --- unauthenticated ---------------------------------------------------
  await expect("anonymous", "read a shop", "deny", () => getDoc("bogus-token", "shops/shop-a"));
  await expect("anonymous", "create an order", "deny", () =>
    createDoc("bogus-token", "orders", {
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
    }
  }
  console.log(`\n${results.length - failures}/${results.length} assertions passed.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("rules validation crashed:", e);
  process.exit(2);
});
