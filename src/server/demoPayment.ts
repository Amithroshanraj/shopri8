import {
  FirebaseIdentityError,
  firestoreTimestamp,
  runFirestoreTransaction,
  verifyFirebaseIdentity,
  type FirestoreDocument,
  type FirestoreWrite,
  type ServerEnvironment,
} from "./firebaseRest.ts";

const MAX_REQUEST_BYTES = 32 * 1024;
const STANDARD_DELIVERY_FEE = 29;

interface CheckoutItemInput {
  productId: string;
  quantity: number;
}

interface NewOrderInput {
  idempotencyKey: string;
  shopId: string;
  deliveryAddressId: string;
  items: CheckoutItemInput[];
}

class PaymentRequestError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function handleDemoPaymentRequest(
  request: Request,
  environment: unknown,
): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/payments/demo/")) return null;

  const env = asServerEnvironment(environment);
  try {
    if (request.method !== "POST") throw new PaymentRequestError(405, "Method not allowed.");
    verifySameOrigin(request);
    const token = bearerToken(request);
    const identity = await verifyFirebaseIdentity(env, token);
    const body = await readJsonBody(request);

    if (url.pathname === "/api/payments/demo/create") {
      const input = parseNewOrderInput(body);
      const orderId = await deriveDemoOrderId(identity.uid, input.idempotencyKey);
      const inputFingerprint = await sha256(
        JSON.stringify({
          shopId: input.shopId,
          deliveryAddressId: input.deliveryAddressId,
          items: input.items,
        }),
      );
      const result = await createDemoOrder(env, identity.uid, input, orderId, inputFingerprint);
      return jsonResponse({
        orderId,
        amount: result.order["totalAmount"],
        currency: "INR",
        status: result.payment["status"] === "SUCCESS" ? "PAID" : "PENDING",
      });
    }

    if (url.pathname === "/api/payments/demo/confirm") {
      const orderId = readOrderId(body);
      return jsonResponse(await confirmDemoPayment(env, identity.uid, orderId));
    }

    throw new PaymentRequestError(404, "Payment endpoint not found.");
  } catch (error) {
    const status =
      error instanceof PaymentRequestError
        ? error.status
        : error instanceof FirebaseIdentityError
          ? 401
          : 500;
    const message =
      error instanceof PaymentRequestError
        ? error.message
        : error instanceof FirebaseIdentityError
          ? error.message
          : "The demo payment service could not complete the request. Please retry.";
    if (status >= 500) console.error("Demo payment request failed.");
    return jsonResponse({ error: message }, status);
  }
}

export function deriveDemoOrderId(uid: string, idempotencyKey: string): Promise<string> {
  return sha256(`shopri8-demo:${uid}:${idempotencyKey}`).then(
    (digest) => `sr8demo_${digest.slice(0, 28)}`,
  );
}

function asServerEnvironment(environment: unknown): ServerEnvironment {
  return environment && typeof environment === "object" ? (environment as ServerEnvironment) : {};
}

function verifySameOrigin(request: Request): void {
  const requestOrigin = new URL(request.url).origin;
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  if ((origin && origin !== requestOrigin) || fetchSite === "cross-site") {
    throw new PaymentRequestError(403, "Cross-origin payment requests are not allowed.");
  }
}

function bearerToken(request: Request): string {
  const match = /^Bearer\s+([^\s]+)$/i.exec(request.headers.get("authorization") ?? "");
  if (!match?.[1]) throw new PaymentRequestError(401, "Sign in to continue.");
  return match[1];
}

async function readJsonBody(request: Request): Promise<unknown> {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_REQUEST_BYTES) {
    throw new PaymentRequestError(413, "The payment request is too large.");
  }
  const text = await request.text();
  if (new TextEncoder().encode(text).length > MAX_REQUEST_BYTES) {
    throw new PaymentRequestError(413, "The payment request is too large.");
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new PaymentRequestError(400, "The payment request is not valid JSON.");
  }
}

function parseNewOrderInput(value: unknown): NewOrderInput {
  if (!isRecord(value)) throw new PaymentRequestError(400, "Invalid checkout request.");
  const { idempotencyKey, shopId, deliveryAddressId, items } = value;
  if (
    typeof idempotencyKey !== "string" ||
    !/^[A-Za-z0-9_-]{16,128}$/.test(idempotencyKey) ||
    !isDocumentId(shopId) ||
    !isDocumentId(deliveryAddressId) ||
    !Array.isArray(items) ||
    items.length < 1 ||
    items.length > 50
  ) {
    throw new PaymentRequestError(400, "Invalid checkout details.");
  }

  const uniqueItems = new Map<string, number>();
  for (const item of items) {
    if (
      !isRecord(item) ||
      !isDocumentId(item["productId"]) ||
      !Number.isInteger(item["quantity"]) ||
      (item["quantity"] as number) < 1
    ) {
      throw new PaymentRequestError(400, "Invalid item quantity.");
    }
    if (uniqueItems.has(item["productId"])) {
      throw new PaymentRequestError(400, "The checkout contains duplicate products.");
    }
    uniqueItems.set(item["productId"], item["quantity"] as number);
  }

  return {
    idempotencyKey,
    shopId,
    deliveryAddressId,
    items: [...uniqueItems.entries()]
      .map(([productId, quantity]) => ({ productId, quantity }))
      .sort((left, right) => left.productId.localeCompare(right.productId)),
  };
}

function readOrderId(value: unknown): string {
  if (!isRecord(value) || !isDocumentId(value["orderId"])) {
    throw new PaymentRequestError(400, "Invalid order.");
  }
  return value["orderId"];
}

function isDocumentId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

async function createDemoOrder(
  env: ServerEnvironment,
  uid: string,
  input: NewOrderInput,
  orderId: string,
  inputFingerprint: string,
): Promise<{ order: FirestoreDocument; payment: FirestoreDocument }> {
  const orderPath = `orders/${orderId}`;
  const paymentPath = `payments/${orderId}`;
  const profilePath = `users/${uid}`;
  const addressPath = `addresses/${input.deliveryAddressId}`;
  const shopPath = `shops/${input.shopId}`;
  const productPaths = input.items.map(({ productId }) => `products/${productId}`);
  const paths = [orderPath, paymentPath, profilePath, addressPath, shopPath, ...productPaths];

  return runFirestoreTransaction(env, paths, (documents) => {
    const existingOrder = documents.get(orderPath);
    const existingPayment = documents.get(paymentPath);
    if (existingOrder || existingPayment) {
      if (
        !existingOrder ||
        !existingPayment ||
        existingOrder.customerId !== uid ||
        existingOrder.paymentMethod !== "DEMO_UPI" ||
        existingPayment.inputFingerprint !== inputFingerprint ||
        existingPayment.orderId !== orderId ||
        !amountsMatch(existingOrder["totalAmount"], existingPayment["amount"])
      ) {
        throw new PaymentRequestError(409, "This checkout conflicts with an existing order.");
      }
      return { writes: [], value: { order: existingOrder, payment: existingPayment } };
    }

    const profile = documents.get(profilePath);
    const address = documents.get(addressPath);
    const shop = documents.get(shopPath);
    if (
      !profile ||
      (profile.status !== undefined && profile.status !== "active") ||
      !Array.isArray(profile.capabilities) ||
      !profile.capabilities.includes("customer")
    ) {
      throw new PaymentRequestError(403, "An active customer account is required.");
    }
    if (!address || address.userId !== uid) {
      throw new PaymentRequestError(400, "Choose an address saved to your account.");
    }
    if (!shop || shop.status !== "ACTIVE") {
      throw new PaymentRequestError(409, "This shop is no longer available.");
    }
    if (
      typeof address.address !== "string" ||
      !address.address.trim() ||
      !Number.isFinite(address.latitude) ||
      !Number.isFinite(address.longitude)
    ) {
      throw new PaymentRequestError(400, "The selected delivery address is incomplete.");
    }

    const orderItems = input.items.map(({ productId, quantity }) => {
      const product = documents.get(`products/${productId}`);
      if (
        !product ||
        product.shopId !== input.shopId ||
        product.availability !== true ||
        typeof product.stock !== "number" ||
        product.stock < quantity ||
        typeof product.price !== "number" ||
        !Number.isFinite(product.price) ||
        product.price < 0
      ) {
        throw new PaymentRequestError(409, "A product is unavailable or has insufficient stock.");
      }
      return {
        productId,
        name: typeof product.name === "string" ? product.name : "Product",
        price: product.price,
        quantity,
        ...(typeof product.image === "string" ? { image: product.image } : {}),
      };
    });
    const subtotal =
      Math.round(orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0) * 100) / 100;
    const totalAmount = Math.round((subtotal + STANDARD_DELIVERY_FEE) * 100) / 100;
    if (!isValidAmount(totalAmount)) {
      throw new PaymentRequestError(400, "The order amount is outside the supported range.");
    }

    const now = firestoreTimestamp();
    const order: FirestoreDocument = {
      customerId: uid,
      shopId: input.shopId,
      shopName: typeof shop.name === "string" ? shop.name : "Shop",
      items: orderItems,
      subtotal,
      deliveryFee: STANDARD_DELIVERY_FEE,
      totalAmount,
      deliveryAddressId: input.deliveryAddressId,
      deliveryAddress: { ...address, id: input.deliveryAddressId },
      paymentMethod: "DEMO_UPI",
      paymentStatus: "PENDING",
      paymentId: orderId,
      paymentCurrency: "INR",
      orderStatus: "PLACED",
      statusHistory: [{ status: "PLACED", at: new Date().toISOString() }],
      createdAt: now,
      updatedAt: now,
    };
    const payment: FirestoreDocument = {
      orderId,
      customerId: uid,
      shopId: input.shopId,
      gateway: "SHOPRI8_DEMO",
      method: "DEMO_UPI",
      amount: totalAmount,
      currency: "INR",
      status: "PENDING",
      paymentMethod: "DEMO_UPI",
      inputFingerprint,
      createdAt: now,
      updatedAt: now,
    };
    const writes: FirestoreWrite[] = [
      { path: orderPath, data: order, exists: false },
      { path: paymentPath, data: payment, exists: false },
    ];
    return { writes, value: { order, payment } };
  });
}

async function confirmDemoPayment(
  env: ServerEnvironment,
  uid: string,
  orderId: string,
): Promise<{ orderId: string; status: "PAID"; amount: number; currency: "INR" }> {
  const orderPath = `orders/${orderId}`;
  const paymentPath = `payments/${orderId}`;
  const profilePath = `users/${uid}`;
  return runFirestoreTransaction(env, [orderPath, paymentPath, profilePath], (documents) => {
    const order = documents.get(orderPath);
    const payment = documents.get(paymentPath);
    const profile = documents.get(profilePath);
    if (
      !profile ||
      (profile.status !== undefined && profile.status !== "active") ||
      !Array.isArray(profile.capabilities) ||
      !profile.capabilities.includes("customer")
    ) {
      throw new PaymentRequestError(403, "An active customer account is required.");
    }
    if (!order || !payment || order.customerId !== uid || payment.customerId !== uid) {
      throw new PaymentRequestError(404, "The order could not be found.");
    }
    const orderAmount = order["totalAmount"];
    if (
      order["paymentMethod"] !== "DEMO_UPI" ||
      payment["paymentMethod"] !== "DEMO_UPI" ||
      payment["gateway"] !== "SHOPRI8_DEMO" ||
      payment["orderId"] !== orderId ||
      !isValidAmount(orderAmount) ||
      !amountsMatch(orderAmount, payment["amount"])
    ) {
      throw new PaymentRequestError(409, "The demo payment does not match this order.");
    }
    if (order.paymentStatus === "PAID" && payment.status === "SUCCESS") {
      return {
        writes: [],
        value: {
          orderId,
          status: "PAID" as const,
          amount: orderAmount,
          currency: "INR" as const,
        },
      };
    }
    if (
      order.orderStatus !== "PLACED" ||
      order.paymentStatus !== "PENDING" ||
      payment.status !== "PENDING"
    ) {
      throw new PaymentRequestError(409, "This order is not payable.");
    }

    const now = firestoreTimestamp();
    const writes: FirestoreWrite[] = [
      {
        path: orderPath,
        data: { ...order, paymentStatus: "PAID", updatedAt: now },
      },
      {
        path: paymentPath,
        data: { ...payment, status: "SUCCESS", paidAt: now, updatedAt: now },
      },
    ];
    return {
      writes,
      value: {
        orderId,
        status: "PAID" as const,
        amount: orderAmount,
        currency: "INR" as const,
      },
    };
  });
}

function amountsMatch(orderAmount: unknown, paymentAmount: unknown): boolean {
  return (
    isValidAmount(orderAmount) && isValidAmount(paymentAmount) && orderAmount === paymentAmount
  );
}

function isValidAmount(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value > 0 &&
    Number.isSafeInteger(Math.round(value * 100))
  );
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
