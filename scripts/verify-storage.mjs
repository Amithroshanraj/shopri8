/**
 * Product-image Storage rules tests against local Auth, Firestore and Storage
 * emulators only. This script never contacts Firebase production services.
 */

const PROJECT = "hyperlocal-commerce-c9abd";
const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? "127.0.0.1:9099";
const FIRESTORE_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8081";
const STORAGE_HOST = process.env.FIREBASE_STORAGE_EMULATOR_HOST ?? "127.0.0.1:9199";
const AUTH = `http://${AUTH_HOST}/identitytoolkit.googleapis.com/v1`;
const FIRESTORE = `http://${FIRESTORE_HOST}/v1/projects/${PROJECT}/databases/(default)/documents`;
const STORAGE = `http://${STORAGE_HOST}/v0/b`;
const BUCKET = `${PROJECT}.firebasestorage.app`;
const API_KEY = "fake-api-key";
const IMAGE = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
const results = [];

function record(actor, action, expected, actual, detail) {
  const passed = expected === actual;
  results.push({ passed, actor, action, expected, actual, detail });
}

async function expect(actor, action, expected, operation) {
  try {
    const response = await operation();
    const actual = response.ok ? "allow" : "deny";
    const detail = response.ok ? undefined : `${response.status} ${await response.text()}`;
    record(actor, action, expected, actual, detail);
  } catch (error) {
    record(actor, action, expected, "deny", error instanceof Error ? error.message : String(error));
  }
}

async function makeUser(label, password) {
  const body = { email: `${label}@shopri8.test`, password, returnSecureToken: true };
  let response = await fetch(`${AUTH}/accounts:signUp?key=${API_KEY}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    response = await fetch(`${AUTH}/accounts:signInWithPassword?key=${API_KEY}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }
  const result = await response.json();
  if (!response.ok || typeof result.idToken !== "string") {
    throw new Error(`Could not authenticate emulator test user ${label}.`);
  }
  return { uid: result.localId, token: result.idToken };
}

function encode(value) {
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") return { integerValue: String(value) };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encode) } };
  if (value && typeof value === "object") {
    return {
      mapValue: {
        fields: Object.fromEntries(
          Object.entries(value).map(([key, child]) => [key, encode(child)]),
        ),
      },
    };
  }
  throw new Error("Unsupported emulator fixture value.");
}

async function seed(path, data) {
  const fields = Object.fromEntries(
    Object.entries(data).map(([key, value]) => [key, encode(value)]),
  );
  const response = await fetch(`${FIRESTORE}/${path}`, {
    method: "PATCH",
    headers: {
      authorization: "Bearer owner",
      "content-type": "application/json",
    },
    body: JSON.stringify({ fields }),
  });
  if (!response.ok) throw new Error(`Could not seed emulator document ${path}.`);
}

async function deleteSeed(path) {
  const response = await fetch(`${FIRESTORE}/${path}`, {
    method: "DELETE",
    headers: { authorization: "Bearer owner" },
  });
  if (!response.ok) throw new Error(`Could not delete emulator document ${path}.`);
}

function objectUrl(path) {
  const query = new URLSearchParams({ name: path });
  return `${STORAGE}/${BUCKET}/o?${query}`;
}

function objectUrlByName(path) {
  return `${STORAGE}/${BUCKET}/o/${encodeURIComponent(path)}`;
}

function upload(token, path, contentType = "image/jpeg", bytes = IMAGE) {
  return fetch(`${objectUrl(path)}&uploadType=media`, {
    method: "POST",
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      "content-type": contentType,
    },
    body: bytes,
  });
}

function read(token, path) {
  return fetch(`${objectUrlByName(path)}?alt=media`, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

function remove(token, path) {
  return fetch(objectUrlByName(path), {
    method: "DELETE",
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

async function main() {
  const password = "local-storage-rules-test-only";
  const retailerA = await makeUser("storage-retailer-a", password);
  const retailerB = await makeUser("storage-retailer-b", password);
  const customer = await makeUser("storage-customer", password);
  const admin = await makeUser("storage-admin", password);

  await Promise.all([
    seed(`users/${retailerA.uid}`, { status: "active", capabilities: ["retailer"] }),
    seed(`users/${retailerB.uid}`, { status: "active", capabilities: ["retailer"] }),
    seed(`users/${customer.uid}`, { status: "active", capabilities: ["customer"] }),
    seed(`users/${admin.uid}`, { status: "active", capabilities: ["admin"] }),
    seed(`shops/shop-a`, { ownerId: retailerA.uid, status: "ACTIVE" }),
    seed(`shops/shop-b`, { ownerId: retailerB.uid, status: "ACTIVE" }),
    seed(`products/product-a`, {
      shopId: "shop-a",
      availability: true,
      stock: 3,
      imageSource: {
        type: "uploaded",
        ref: "https://firebasestorage.googleapis.com/emulator-image",
        storagePath: "shops/shop-a/products/product-a/image-owned.jpg",
      },
    }),
    seed(`products/product-b`, {
      shopId: "shop-b",
      availability: true,
      stock: 3,
      imageSource: {
        type: "uploaded",
        ref: "https://firebasestorage.googleapis.com/emulator-image",
        storagePath: "shops/shop-b/products/product-b/image-other.jpg",
      },
    }),
  ]);

  const ownPath = "shops/shop-a/products/product-a/image-owned.jpg";
  const replacementPath = "shops/shop-a/products/product-a/image-replacement.webp";
  const otherPath = "shops/shop-b/products/product-b/image-other.jpg";

  await expect("retailer A", "upload own product image", "allow", () =>
    upload(retailerA.token, ownPath),
  );
  await expect("retailer B", "upload own shop image", "allow", () =>
    upload(retailerB.token, otherPath),
  );
  await expect("customer", "read public available product image", "allow", () =>
    read(customer.token, ownPath),
  );
  await expect("anonymous", "read public available product image", "allow", () =>
    read(null, ownPath),
  );
  await expect("retailer A", "replace own product image", "allow", () =>
    upload(retailerA.token, ownPath, "image/jpeg", new Uint8Array([1, 2, 3])),
  );
  await expect("admin", "read product image", "allow", () => read(admin.token, ownPath));
  await expect("customer", "upload product image", "deny", () =>
    upload(customer.token, replacementPath),
  );
  await expect("anonymous", "upload product image", "deny", () => upload(null, replacementPath));
  await expect("retailer A", "upload into another shop path", "deny", () =>
    upload(retailerA.token, otherPath),
  );
  await expect("retailer A", "path traversal outside own product", "deny", () =>
    upload(retailerA.token, "shops/shop-a/products/product-a/../product-b/image-traversal.jpg"),
  );
  await expect("retailer A", "upload unsupported GIF", "deny", () =>
    upload(retailerA.token, "shops/shop-a/products/product-a/image-animated.gif", "image/gif"),
  );
  await expect("retailer A", "reject MIME type inconsistent with file extension", "deny", () =>
    upload(retailerA.token, replacementPath, "image/png"),
  );
  await expect("retailer A", "reject image larger than 5 MB", "deny", () =>
    upload(
      retailerA.token,
      "shops/shop-a/products/product-a/image-too-large.jpg",
      "image/jpeg",
      new Uint8Array(5 * 1024 * 1024 + 1),
    ),
  );
  await expect("customer", "cannot delete product image", "deny", () =>
    remove(customer.token, ownPath),
  );
  await expect("retailer B", "cannot delete another retailer image", "deny", () =>
    remove(retailerB.token, ownPath),
  );
  await expect("admin", "upload image for an existing product", "allow", () =>
    upload(admin.token, "shops/shop-b/products/product-b/image-admin.webp", "image/webp"),
  );
  await expect("admin", "delete product image", "allow", () => remove(admin.token, otherPath));
  await expect("retailer A", "delete own product image", "allow", () =>
    remove(retailerA.token, ownPath),
  );
  await expect("retailer A", "restore image fixture before deleting its product", "allow", () =>
    upload(retailerA.token, ownPath),
  );
  await deleteSeed("products/product-a");
  await expect("retailer A", "delete own image after product deletion", "allow", () =>
    remove(retailerA.token, ownPath),
  );

  const failures = results.filter((result) => !result.passed);
  for (const actor of [...new Set(results.map((result) => result.actor))]) {
    const group = results.filter((result) => result.actor === actor);
    const passed = group.filter((result) => result.passed).length;
    console.log(`${actor}: ${passed}/${group.length} passed`);
  }
  if (failures.length) {
    console.error("\nStorage rules failures:");
    for (const failure of failures) {
      console.error(
        `- ${failure.actor}: ${failure.action} expected ${failure.expected}, got ${failure.actual}`,
      );
      if (failure.detail) console.error(`  ${failure.detail}`);
    }
  }
  console.log(`\n${results.length - failures.length}/${results.length} Storage assertions passed.`);
  if (failures.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error("Storage rules validation crashed:", error);
  process.exitCode = 2;
});
