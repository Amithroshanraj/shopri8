/**
 * Provisions the live portal accounts used to test Firebase authentication.
 *
 * NOT part of the app, and not part of the build. Security Rules default-deny, so
 * privileged roles cannot be created from a client: `retailer`, `deliveryWorker`
 * and `admin` have to be written with an admin credential. It reuses the Firebase
 * CLI's own OAuth session (`~/.config/configstore/firebase-tools.json`) rather than
 * asking for a service-account key.
 *
 * Usage:  node scripts/provision-portal-accounts.mjs
 *
 * Re-runnable: an existing account keeps its uid and gets a fresh password, so
 * the printed credentials are always current. Rotate them before anyone else uses
 * these accounts.
 */

import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const PROJECT = "hyperlocal-commerce-c9abd";
const API_KEY = process.env.VITE_FIREBASE_API_KEY;
const STORE = join(homedir(), ".config/configstore/firebase-tools.json");

const ACCOUNTS = [
  {
    uid: "shopri8-retailer-1",
    email: "retailer@shopri8.com",
    displayName: "Green Basket Grocers",
    capabilities: ["retailer"],
  },
  {
    uid: "shopri8-worker-1",
    email: "worker@shopri8.com",
    displayName: "Arjun Kumar",
    capabilities: ["deliveryWorker"],
  },
  {
    uid: "shopri8-customer-1",
    email: "customer@shopri8.test",
    displayName: "Customer 0001",
    capabilities: ["customer"],
  },
  {
    // Proves a single uid can hold more than one capability: this account gets
    // into the storefront *and* the worker portal.
    uid: "shopri8-dual-1",
    email: "dual@shopri8.test",
    displayName: "Customer 0002",
    capabilities: ["customer", "deliveryWorker"],
  },
];

function store() {
  return JSON.parse(readFileSync(STORE, "utf8"));
}

/** Returns a valid access token, refreshing it when the cached one has expired. */
async function accessToken() {
  const cached = store().tokens;
  if (cached.expires_at > Date.now() + 60_000) return cached.access_token;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: store().user.azp,
      client_secret: process.env.FIREBASE_CLIENT_SECRET ?? "",
      refresh_token: cached.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  const json = await res.json();
  if (!json.access_token) throw new Error(`token refresh failed: ${JSON.stringify(json)}`);
  console.log("  (refreshed the CLI access token)");
  return json.access_token;
}

async function upsertAccount(token, account) {
  const password = randomBytes(12).toString("base64url");
  const auth = (path, body) =>
    fetch(`https://identitytoolkit.googleapis.com/v1/projects/${PROJECT}/${path}`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(body),
    });

  const res = await auth("accounts", {
    localId: account.uid,
    email: account.email,
    password,
    displayName: account.displayName,
    emailVerified: true,
  });
  const json = await res.json();
  if (!json.error) return { password, created: true };

  const alreadyExists =
    String(json.error.message).includes("EMAIL_EXISTS") ||
    String(json.error.message).includes("DUPLICATE_LOCAL_ID");
  if (!alreadyExists) throw new Error(`create failed: ${JSON.stringify(json)}`);

  const set = await auth("accounts:update", {
    localId: account.uid,
    password,
    email: account.email,
    emailVerified: true,
    displayName: account.displayName,
  });
  const setJson = await set.json();
  if (setJson.error) throw new Error(`password reset failed: ${JSON.stringify(setJson)}`);
  return { password, created: false };
}

/** Writes users/{uid} with the granted capabilities, bypassing Security Rules. */
async function writeProfile(token, account) {
  const res = await fetch(
    `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/users/${account.uid}`,
    {
      method: "PATCH",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({
        fields: {
          name: { stringValue: account.displayName },
          email: { stringValue: account.email },
          capabilities: {
            arrayValue: { values: account.capabilities.map((c) => ({ stringValue: c })) },
          },
        },
      }),
    },
  );
  if (!res.ok) throw new Error(`profile write failed: ${res.status} ${await res.text()}`);
}

/** Signs in through the REST API and re-reads the profile through Security Rules. */
async function verifyThroughRules(account, password) {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: account.email, password, returnSecureToken: true }),
    },
  );
  const auth = await res.json();
  if (!auth.idToken) throw new Error(`verify sign-in failed: ${JSON.stringify(auth)}`);

  const doc = await fetch(
    `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/users/${account.uid}`,
    { headers: { authorization: `Bearer ${auth.idToken}` } },
  );
  if (!doc.ok) throw new Error(`verify read denied by rules: ${doc.status}`);
  const parsed = JSON.parse(await doc.text());
  return parsed.fields?.capabilities?.arrayValue?.values?.map((v) => v.stringValue) ?? [];
}

async function main() {
  if (!API_KEY) {
    console.error("Set VITE_FIREBASE_API_KEY in the environment for the verification step.");
    process.exit(2);
  }
  const token = await accessToken();
  console.log(`Provisioning portal accounts for ${PROJECT}...`);

  const results = [];
  for (const account of ACCOUNTS) {
    const { password, created } = await upsertAccount(token, account);
    await writeProfile(token, account);
    const capabilities = await verifyThroughRules(account, password);
    const expected = JSON.stringify(account.capabilities);
    if (JSON.stringify(capabilities) !== expected) {
      throw new Error(
        `${account.email}: capabilities ${JSON.stringify(capabilities)} !== ${expected}`,
      );
    }
    console.log(`  ${created ? "created" : "reset "} ${account.email} -> ${expected}`);
    results.push({ ...account, password });
  }

  console.log("\n" + "=".repeat(66));
  console.log("  ROLE          EMAIL                      PASSWORD");
  console.log("=".repeat(66));
  for (const { email, password } of results) {
    console.log(`  ${email.padEnd(28)}${password}`);
  }
  console.log("=".repeat(66));
  console.log("  Every password was just generated. Rotate them before sharing.");
  console.log("  Sign-in pages: /auth (customer), /retailer/login,");
  console.log("                 /worker/login, /admin/login\n");
}

main().catch((e) => {
  console.error("provision failed:", e.message ?? e);
  process.exit(1);
});
