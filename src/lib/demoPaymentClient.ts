import { getFirebaseAuth } from "./firebase";

export { buildDemoQrPayload } from "./demoPaymentPayload";

export interface DemoPaymentResult {
  orderId: string;
  amount: number;
  currency: "INR";
  status: "PENDING" | "PAID";
}

const CHECKOUT_KEY_STORAGE = "shopri8.demo-checkout.v1";

export async function demoPaymentRequest(
  endpoint: "create" | "confirm",
  body: Record<string, unknown>,
): Promise<DemoPaymentResult> {
  const user = getFirebaseAuth()?.currentUser;
  if (!user) throw new Error("Sign in with your customer account to continue.");
  const token = await user.getIdToken();
  const response = await fetch(`/api/payments/demo/${endpoint}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
    credentials: "same-origin",
    cache: "no-store",
  });
  const payload = (await response.json()) as DemoPaymentResult & { error?: string };
  if (!response.ok) throw new Error(payload.error || "Could not complete the demo payment.");
  if (
    typeof payload.orderId !== "string" ||
    (payload.status !== "PENDING" && payload.status !== "PAID") ||
    (endpoint === "create" && (typeof payload.amount !== "number" || payload.currency !== "INR"))
  ) {
    throw new Error("The demo payment service returned an invalid response.");
  }
  return payload;
}

export function getDemoCheckoutIdempotencyKey(fingerprint: string): string {
  const user = getFirebaseAuth()?.currentUser;
  if (!user) throw new Error("Sign in with your customer account to continue.");
  const storageKey = `${CHECKOUT_KEY_STORAGE}:${user.uid}`;
  const existing = window.sessionStorage.getItem(storageKey);
  if (existing) {
    try {
      const record = JSON.parse(existing) as { fingerprint?: unknown; key?: unknown };
      if (record.fingerprint === fingerprint && typeof record.key === "string") {
        return record.key;
      }
    } catch {
      window.sessionStorage.removeItem(storageKey);
    }
  }
  const key = crypto.randomUUID();
  window.sessionStorage.setItem(storageKey, JSON.stringify({ fingerprint, key }));
  return key;
}

export function clearDemoCheckoutIdempotencyKey(): void {
  const user = getFirebaseAuth()?.currentUser;
  if (user) window.sessionStorage.removeItem(`${CHECKOUT_KEY_STORAGE}:${user.uid}`);
}
