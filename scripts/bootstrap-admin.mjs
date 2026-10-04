/**
 * One-time live bootstrap: create the first SHOPRi8 admin.
 *
 * NOT part of the app. This exists because Security Rules default-deny, so the
 * very first admin cannot be created by a client — it must be written with an
 * admin credential. It reuses the Firebase CLI's own OAuth session
 * (`~/.config/configstore/firebase-tools.json`) rather than asking for a
 * service-account key.
 *
 * Usage:  node scripts/bootstrap-admin.mjs [email]
 *
 * Prints the generated password once. Sign in, then change it immediately.
 */

import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const PROJECT = "hyperlocal-commerce-c9abd";
const API_KEY = process.env.VITE_FIREBASE_API_KEY;
const EMAIL = process.argv[2] ?? "admin@shopri8.com";
const STORE = join(homedir(), ".config/configstore/firebase-tools.json");

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
  if (!json.access_token) {
    throw new Error(`token refresh failed: ${JSON.stringify(json)}`);
  }
  console.log("  (refreshed the CLI access token)");
  return json.access_token;
}

async function createAdminUser(token) {
  const password = randomBytes(12).toString("base64url");
  const auth = (path, body) =>
    fetch(`https://identitytoolkit.googleapis.com/v1/projects/${PROJECT}/${path}`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(body),
    });

  const res = await auth("accounts", {
    localId: "shopri8-admin-1",
    email: EMAIL,
    password,
    displayName: "SHOPRi8 Admin",
    emailVerified: true,
  });
  const json = await res.json();
  if (!json.error) return { uid: json.localId, password, created: true };

  // The account already exists (either the UID or the email). Reuse it and give
  // it a fresh password instead of failing, so the script is re-runnable.
  const alreadyExists =
    String(json.error.message).includes("EMAIL_EXISTS") ||
    String(json.error.message).includes("DUPLICATE_LOCAL_ID");
  if (!alreadyExists) throw new Error(`create failed: ${JSON.stringify(json)}`);

  console.log(`  account already existed — resetting the password`);
  const set = await auth("accounts:update", {
    localId: "shopri8-admin-1",
    password,
    email: EMAIL,
    emailVerified: true,
    displayName: "SHOPRi8 Admin",
  });
  const setJson = await set.json();
  if (setJson.error) throw new Error(`password reset failed: ${JSON.stringify(setJson)}`);
  return { uid: "shopri8-admin-1", password, created: false };
}

/** Writes users/{uid} with the admin capability, bypassing Security Rules. */
async function grantAdmin(token, uid) {
  const res = await fetch(
    `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/users/${uid}`,
    {
      method: "PATCH",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({
        fields: {
          name: { stringValue: "SHOPRi8 Admin" },
          email: { stringValue: EMAIL },
          capabilities: { arrayValue: { values: [{ stringValue: "admin" }] } },
          profileImage: { stringValue: "" },
        },
      }),
    },
  );
  if (!res.ok) throw new Error(`grant failed: ${res.status} ${await res.text()}`);
}

/** Verifies the whole path a real admin takes: sign in, then read through the rules. */
async function verify(uid, password) {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: EMAIL, password, returnSecureToken: true }),
    },
  );
  const auth = await res.json();
  if (!auth.idToken) throw new Error(`verify sign-in failed: ${JSON.stringify(auth)}`);

  const doc = await fetch(
    `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/users/${uid}`,
    { headers: { authorization: `Bearer ${auth.idToken}` } },
  );
  if (!doc.ok) throw new Error(`verify read denied by rules: ${doc.status}`);
  return JSON.parse(await doc.text());
}

async function main() {
  if (!API_KEY) {
    console.error("Set VITE_FIREBASE_API_KEY in the environment for the verification step.");
    process.exit(2);
  }
  const token = await accessToken();
  console.log(`Bootstrapping admin for ${PROJECT}...`);

  const { uid, password, created } = await createAdminUser(token);
  console.log(`  auth user ${created ? "created" : "reused"}: ${uid}`);

  await grantAdmin(token, uid);
  console.log("  users/{uid}.capabilities = ['admin']");

  const doc = await verify(uid, password);
  const caps = doc.fields?.capabilities?.arrayValue?.values?.map((v) => v.stringValue) ?? [];
  console.log(`  verified through Security Rules: capabilities = ${JSON.stringify(caps)}`);

  console.log("\n" + "=".repeat(58));
  console.log("  ADMIN EMAIL   ", EMAIL);
  console.log("  PASSWORD      ", password);
  console.log("=".repeat(58));
  console.log("  Sign in at /admin/login, then change this password immediately.");
  console.log("  Delete this script once the admin exists.\n");
}

main().catch((e) => {
  console.error("bootstrap failed:", e.message ?? e);
  process.exit(1);
});
