import assert from "node:assert/strict";
import test from "node:test";
import { buildDemoQrPayload } from "../src/lib/demoPaymentPayload.ts";
import { deriveDemoOrderId, handleDemoPaymentRequest } from "../src/server/demoPayment.ts";

const env = {
  FIREBASE_PROJECT_ID: "shopri8-test",
  FIREBASE_WEB_API_KEY: "test-web-key",
  FIREBASE_AUTH_EMULATOR_HOST: "auth.test",
  FIRESTORE_EMULATOR_HOST: "firestore.test",
};

function encodeValue(value) {
  if (value === null) return { nullValue: "NULL_VALUE" };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") {
    return Number.isSafeInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encodeValue) } };
  if (value && typeof value === "object" && "__firestoreTimestamp" in value) {
    return { timestampValue: value.__firestoreTimestamp };
  }
  if (value && typeof value === "object") {
    return {
      mapValue: {
        fields: Object.fromEntries(
          Object.entries(value).map(([key, child]) => [key, encodeValue(child)]),
        ),
      },
    };
  }
  throw new Error("Unsupported Firestore value in test fixture.");
}

function encodeDocument(path, data) {
  return {
    name: `projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/${path}`,
    fields: Object.fromEntries(
      Object.entries(data).map(([key, value]) => [key, encodeValue(value)]),
    ),
  };
}

function decodeValue(value) {
  if ("stringValue" in value) return value.stringValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return value.doubleValue;
  if ("booleanValue" in value) return value.booleanValue;
  if ("nullValue" in value) return null;
  if ("timestampValue" in value) return value.timestampValue;
  if (value.arrayValue) return (value.arrayValue.values ?? []).map(decodeValue);
  if (value.mapValue) {
    return Object.fromEntries(
      Object.entries(value.mapValue.fields ?? {}).map(([key, child]) => [key, decodeValue(child)]),
    );
  }
  throw new Error("Unsupported Firestore value in test write.");
}

function makeRuntime() {
  const documents = new Map([
    ["users/customer-1", { status: "active", capabilities: ["customer"] }],
    ["users/customer-2", { status: "active", capabilities: ["customer"] }],
    ["shops/shop-1", { status: "ACTIVE", name: "Test Shop" }],
    [
      "addresses/address-1",
      {
        userId: "customer-1",
        address: "1 Test Street",
        latitude: 12.9,
        longitude: 77.6,
      },
    ],
    [
      "products/product-1",
      {
        shopId: "shop-1",
        name: "Test Product",
        price: 100,
        stock: 5,
        availability: true,
      },
    ],
  ]);
  let commits = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === "string" ? input : input.url);
    const method = init.method ?? "GET";

    if (url.hostname === "auth.test") {
      const { idToken } = JSON.parse(String(init.body));
      const uid = idToken === "customer-token" ? "customer-1" : "customer-2";
      return Response.json({
        users: [{ localId: uid, disabled: false }],
      });
    }

    if (url.hostname !== "firestore.test") {
      throw new Error(`Unexpected test request to ${url.hostname}`);
    }

    if (method === "POST" && url.pathname.endsWith("/documents:beginTransaction")) {
      return Response.json({ transaction: `tx-${commits}` });
    }
    if (method === "POST" && url.pathname.endsWith("/documents:rollback")) {
      return Response.json({});
    }
    if (method === "POST" && url.pathname.endsWith("/documents:batchGet")) {
      const body = JSON.parse(String(init.body));
      const results = body.documents.map((name) => {
        const path = name.split("/documents/")[1];
        const decodedPath = path.split("/").map(decodeURIComponent).join("/");
        const data = documents.get(decodedPath);
        return data ? { found: encodeDocument(decodedPath, data) } : { missing: { name } };
      });
      return Response.json(results);
    }
    if (method === "POST" && url.pathname.endsWith("/documents:commit")) {
      const body = JSON.parse(String(init.body));
      for (const write of body.writes) {
        const path = write.update.name.split("/documents/")[1];
        const decodedPath = path.split("/").map(decodeURIComponent).join("/");
        const data = Object.fromEntries(
          Object.entries(write.update.fields).map(([key, value]) => [key, decodeValue(value)]),
        );
        if (write.currentDocument?.exists === false && documents.has(decodedPath)) {
          return new Response(null, { status: 409 });
        }
        documents.set(decodedPath, data);
      }
      commits += 1;
      return Response.json({});
    }
    const pathIndex = url.pathname.indexOf("/documents/");
    if (pathIndex < 0) throw new Error(`Unexpected Firestore request: ${method} ${url.pathname}`);
    const resourcePath = url.pathname
      .slice(pathIndex + "/documents/".length)
      .split("/")
      .map(decodeURIComponent)
      .join("/");
    if (method === "GET") {
      const data = documents.get(resourcePath);
      return data
        ? Response.json(encodeDocument(resourcePath, data))
        : new Response(null, { status: 404 });
    }
    throw new Error(`Unexpected Firestore request: ${method} ${resourcePath}`);
  };

  return {
    documents,
    get commits() {
      return commits;
    },
    restore() {
      globalThis.fetch = originalFetch;
    },
  };
}

function request(path, token, payload) {
  return new Request(`https://shopri8.test/api/payments/demo/${path}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      origin: "https://shopri8.test",
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

async function call(path, token, payload, runtime) {
  const response = await handleDemoPaymentRequest(request(path, token, payload), env);
  assert.ok(response);
  return {
    response,
    payload: await response.json(),
  };
}

const checkout = {
  idempotencyKey: "stable-checkout-key-1234",
  shopId: "shop-1",
  deliveryAddressId: "address-1",
  items: [{ productId: "product-1", quantity: 1 }],
};

test("demo QR contains only harmless SHOPRi8 demo information", () => {
  const value = buildDemoQrPayload("sr8demo_test-order", 129);
  assert.equal(value, "SHOPRI8-DEMO|ORDER:sr8demo_test-order|AMOUNT:129.00|NO-REAL-PAYMENT");
  assert.doesNotMatch(value, /upi:\/\/|@|bank|token|credential/i);
});

test("demo checkout creates a server-priced order and pending payment atomically", async (t) => {
  const runtime = makeRuntime();
  t.after(() => runtime.restore());
  const { response, payload } = await call(
    "create",
    "customer-token",
    { ...checkout, amount: 1 },
    runtime,
  );
  assert.equal(response.status, 200);
  assert.equal(payload.amount, 129);
  assert.equal(payload.status, "PENDING");
  const order = runtime.documents.get(`orders/${payload.orderId}`);
  const payment = runtime.documents.get(`payments/${payload.orderId}`);
  assert.equal(order.paymentMethod, "DEMO_UPI");
  assert.equal(order.paymentStatus, "PENDING");
  assert.equal(order.totalAmount, 129);
  assert.equal(payment.gateway, "SHOPRI8_DEMO");
  assert.equal(payment.method, "DEMO_UPI");
  assert.equal(payment.amount, 129);
  assert.equal(payment.status, "PENDING");
  assert.equal(runtime.commits, 1);
});

test("only the owning customer can confirm the server-stored amount", async (t) => {
  const runtime = makeRuntime();
  t.after(() => runtime.restore());
  const created = await call("create", "customer-token", checkout, runtime);
  const orderId = created.payload.orderId;

  const denied = await call("confirm", "other-customer-token", { orderId, amount: 1 }, runtime);
  assert.equal(denied.response.status, 404);
  assert.equal(runtime.documents.get(`orders/${orderId}`).paymentStatus, "PENDING");

  const confirmed = await call("confirm", "customer-token", { orderId, amount: 1 }, runtime);
  assert.equal(confirmed.response.status, 200);
  assert.equal(confirmed.payload.status, "PAID");
  assert.equal(runtime.documents.get(`orders/${orderId}`).paymentStatus, "PAID");
  assert.equal(runtime.documents.get(`payments/${orderId}`).status, "SUCCESS");
  assert.equal(runtime.documents.get(`payments/${orderId}`).amount, 129);
  assert.ok(runtime.documents.get(`payments/${orderId}`).paidAt);
  assert.equal(runtime.commits, 2);
});

test("repeated demo confirmation is idempotent", async (t) => {
  const runtime = makeRuntime();
  t.after(() => runtime.restore());
  const created = await call("create", "customer-token", checkout, runtime);
  const orderId = created.payload.orderId;
  await call("confirm", "customer-token", { orderId }, runtime);
  const paidAt = runtime.documents.get(`payments/${orderId}`).paidAt;

  const duplicate = await call("confirm", "customer-token", { orderId }, runtime);
  assert.equal(duplicate.response.status, 200);
  assert.equal(duplicate.payload.status, "PAID");
  assert.equal(runtime.documents.get(`payments/${orderId}`).paidAt, paidAt);
  assert.equal(runtime.commits, 2);
});

test("confirmation rejects an order that is no longer payable", async (t) => {
  const runtime = makeRuntime();
  t.after(() => runtime.restore());
  const created = await call("create", "customer-token", checkout, runtime);
  const orderId = created.payload.orderId;
  runtime.documents.set(`orders/${orderId}`, {
    ...runtime.documents.get(`orders/${orderId}`),
    orderStatus: "PREPARING",
  });

  const denied = await call("confirm", "customer-token", { orderId }, runtime);
  assert.equal(denied.response.status, 409);
  assert.equal(runtime.documents.get(`orders/${orderId}`).paymentStatus, "PENDING");
  assert.equal(runtime.documents.get(`payments/${orderId}`).status, "PENDING");
});

test("demo order IDs are deterministic and account-scoped", async () => {
  const first = await deriveDemoOrderId("customer-1", "same-key-12345678");
  const repeated = await deriveDemoOrderId("customer-1", "same-key-12345678");
  const otherAccount = await deriveDemoOrderId("customer-2", "same-key-12345678");
  assert.equal(first, repeated);
  assert.notEqual(first, otherAccount);
});
