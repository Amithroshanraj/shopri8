export interface ServerEnvironment {
  [key: string]: unknown;
}

export interface FirebaseIdentity {
  uid: string;
  email?: string;
  displayName?: string;
  disabled: boolean;
}

export interface FirestoreDocument {
  [key: string]: unknown;
  address?: unknown;
  amount?: unknown;
  attemptNumber?: unknown;
  availability?: unknown;
  capabilities?: unknown;
  currency?: unknown;
  customerId?: unknown;
  data?: unknown;
  deliveryAddress?: unknown;
  failureReason?: unknown;
  image?: unknown;
  inputFingerprint?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  name?: unknown;
  order?: unknown;
  orderId?: unknown;
  orderStatus?: unknown;
  order_id?: unknown;
  paymentMethod?: unknown;
  paymentStatus?: unknown;
  phone?: unknown;
  price?: unknown;
  shopId?: unknown;
  status?: unknown;
  stock?: unknown;
  userId?: unknown;
}

export interface FirestoreWrite {
  path: string;
  data: FirestoreDocument;
  exists?: boolean;
}

interface FirestoreValue {
  stringValue?: string;
  integerValue?: string;
  doubleValue?: number;
  booleanValue?: boolean;
  nullValue?: string;
  timestampValue?: string;
  arrayValue?: { values?: FirestoreValue[] };
  mapValue?: { fields?: Record<string, FirestoreValue> };
}

interface FirestoreRestDocument {
  name: string;
  fields?: Record<string, FirestoreValue>;
}

interface FirestoreDocumentResult {
  documents: Map<string, FirestoreDocument | null>;
  transactionId: string;
}

export interface FirestoreTransactionResult<T> {
  writes: FirestoreWrite[];
  value: T;
}

export interface FirestoreTimestamp {
  readonly __firestoreTimestamp: string;
}

export class FirebaseIdentityError extends Error {}

let cachedAccessToken: { serviceAccount: string; token: string; expiresAt: number } | undefined;

export function serverEnv(env: ServerEnvironment, name: string): string {
  const boundValue = env[name];
  if (typeof boundValue === "string" && boundValue.trim()) return boundValue.trim();

  const processEnv = (
    globalThis as typeof globalThis & {
      process?: { env?: Record<string, string | undefined> };
    }
  ).process?.env?.[name];
  return typeof processEnv === "string" ? processEnv.trim() : "";
}

export function firestoreTimestamp(value = new Date()): FirestoreTimestamp {
  return { __firestoreTimestamp: value.toISOString() };
}

export async function verifyFirebaseIdentity(
  env: ServerEnvironment,
  idToken: string,
): Promise<FirebaseIdentity> {
  const projectId = serverEnv(env, "FIREBASE_PROJECT_ID");
  const apiKey = serverEnv(env, "FIREBASE_WEB_API_KEY");
  if (!projectId || !apiKey) {
    throw new Error("Firebase server authentication is not configured.");
  }

  const emulatorHost = serverEnv(env, "FIREBASE_AUTH_EMULATOR_HOST");
  const baseUrl = emulatorHost
    ? `http://${emulatorHost.replace(/^https?:\/\//, "")}/identitytoolkit.googleapis.com/v1`
    : "https://identitytoolkit.googleapis.com/v1";
  const response = await fetch(`${baseUrl}/accounts:lookup?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ idToken }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new FirebaseIdentityError("The Firebase session is invalid or expired.");

  const payload = (await response.json()) as {
    users?: Array<{
      localId?: unknown;
      email?: unknown;
      displayName?: unknown;
      disabled?: unknown;
    }>;
  };
  const user = payload.users?.[0];
  if (!user || typeof user.localId !== "string" || user.disabled === true) {
    throw new FirebaseIdentityError("An active Firebase account is required.");
  }

  return {
    uid: user.localId,
    ...(typeof user.email === "string" ? { email: user.email } : {}),
    ...(typeof user.displayName === "string" ? { displayName: user.displayName } : {}),
    disabled: false,
  };
}

export async function runFirestoreTransaction<T>(
  env: ServerEnvironment,
  paths: string[],
  action: (documents: Map<string, FirestoreDocument | null>) => FirestoreTransactionResult<T>,
): Promise<T> {
  const read = await beginFirestoreTransaction(env, paths);
  try {
    const result = action(read.documents);
    if (result.writes.length) {
      await commitFirestoreTransaction(env, read.transactionId, result.writes);
    } else {
      await rollbackFirestoreTransaction(env, read.transactionId);
    }
    return result.value;
  } catch (error) {
    await rollbackFirestoreTransaction(env, read.transactionId).catch(() => undefined);
    throw error;
  }
}

export async function getFirestoreDocument(
  env: ServerEnvironment,
  path: string,
): Promise<FirestoreDocument | null> {
  const projectId = requiredProjectId(env);
  const response = await firestoreFetch(
    env,
    `${firestoreDocumentsUrl(env, projectId)}/${encodeDocumentPath(path)}`,
    { method: "GET" },
  );
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("Could not read trusted Firestore data.");
  return decodeFirestoreDocument((await response.json()) as FirestoreRestDocument);
}

export function firebaseDocumentPath(projectId: string, path: string): string {
  return `projects/${projectId}/databases/(default)/documents/${path}`;
}

async function beginFirestoreTransaction(
  env: ServerEnvironment,
  paths: string[],
): Promise<FirestoreDocumentResult> {
  const projectId = requiredProjectId(env);
  const baseUrl = firestoreDocumentsUrl(env, projectId);
  const beginResponse = await firestoreFetch(env, `${baseUrl}:beginTransaction`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ options: { readWrite: {} } }),
  });
  if (!beginResponse.ok) throw new Error("Could not begin a trusted Firestore transaction.");
  const beginPayload = (await beginResponse.json()) as { transaction?: string };
  if (!beginPayload.transaction) throw new Error("Firestore returned an invalid transaction.");

  if (!paths.length) return { documents: new Map(), transactionId: beginPayload.transaction };

  const response = await firestoreFetch(env, `${baseUrl}:batchGet`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      documents: paths.map((path) => firebaseDocumentPath(projectId, path)),
      transaction: beginPayload.transaction,
    }),
  });
  if (!response.ok) {
    await rollbackFirestoreTransaction(env, beginPayload.transaction).catch(() => undefined);
    throw new Error("Could not read trusted Firestore data.");
  }

  const responseText = await response.text();
  const results = parseBatchGetResponse(responseText) as Array<{
    found?: FirestoreRestDocument;
    missing?: { name?: string };
  }>;
  const documents = new Map<string, FirestoreDocument | null>();
  for (const result of results) {
    const document = result.found;
    const name = document?.name ?? result.missing?.name;
    if (!name) continue;
    const path = name.split("/documents/")[1];
    if (!path) continue;
    const decodedPath = decodeDocumentPath(path);
    documents.set(decodedPath, document ? decodeFirestoreDocument(document) : null);
  }
  for (const path of paths) {
    if (!documents.has(path)) documents.set(path, null);
  }
  return { documents, transactionId: beginPayload.transaction };
}

function parseBatchGetResponse(responseText: string): unknown {
  try {
    return JSON.parse(responseText) as unknown;
  } catch {
    const entries = responseText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (!entries.length) throw new Error("Firestore returned an empty transaction read.");
    try {
      return entries.map((entry) => JSON.parse(entry) as unknown);
    } catch {
      throw new Error("Firestore returned an invalid transaction read.");
    }
  }
}

async function commitFirestoreTransaction(
  env: ServerEnvironment,
  transactionId: string,
  writes: FirestoreWrite[],
): Promise<void> {
  const projectId = requiredProjectId(env);
  const response = await firestoreFetch(env, `${firestoreDocumentsUrl(env, projectId)}:commit`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      transaction: transactionId,
      writes: writes.map((write) => ({
        update: {
          name: firebaseDocumentPath(projectId, write.path),
          fields: encodeFirestoreFields(write.data),
        },
        ...(write.exists === undefined ? {} : { currentDocument: { exists: write.exists } }),
      })),
    }),
  });
  if (!response.ok) throw new Error("Could not commit trusted Firestore changes.");
}

async function rollbackFirestoreTransaction(
  env: ServerEnvironment,
  transactionId: string,
): Promise<void> {
  const projectId = requiredProjectId(env);
  await firestoreFetch(env, `${firestoreDocumentsUrl(env, projectId)}:rollback`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ transaction: transactionId }),
  });
}

async function firestoreFetch(
  env: ServerEnvironment,
  url: string,
  init: RequestInit,
): Promise<Response> {
  const headers = new Headers(init.headers);
  if (!serverEnv(env, "FIRESTORE_EMULATOR_HOST")) {
    headers.set("authorization", `Bearer ${await getServiceAccessToken(env)}`);
  }
  return fetch(url, { ...init, headers, signal: AbortSignal.timeout(15_000) });
}

async function getServiceAccessToken(env: ServerEnvironment): Promise<string> {
  const serviceAccount = serverEnv(env, "FIREBASE_SERVICE_ACCOUNT_EMAIL");
  const privateKey = serverEnv(env, "FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY");
  if (!serviceAccount || !privateKey) {
    throw new Error("Firebase trusted server credentials are not configured.");
  }
  if (
    cachedAccessToken?.serviceAccount === serviceAccount &&
    cachedAccessToken.expiresAt > Date.now() + 60_000
  ) {
    return cachedAccessToken.token;
  }

  const now = Math.floor(Date.now() / 1000);
  const assertion = await signServiceAccountJwt(serviceAccount, privateKey, now);
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!tokenResponse.ok) throw new Error("Could not authenticate the Firebase service identity.");
  const tokenPayload = (await tokenResponse.json()) as {
    access_token?: unknown;
    expires_in?: unknown;
  };
  if (typeof tokenPayload.access_token !== "string") {
    throw new Error("Google returned an invalid service access token.");
  }
  const expiresIn = typeof tokenPayload.expires_in === "number" ? tokenPayload.expires_in : 3600;
  cachedAccessToken = {
    serviceAccount,
    token: tokenPayload.access_token,
    expiresAt: Date.now() + expiresIn * 1000,
  };
  return tokenPayload.access_token;
}

async function signServiceAccountJwt(
  serviceAccount: string,
  privateKey: string,
  issuedAt: number,
): Promise<string> {
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64Url(
    JSON.stringify({
      iss: serviceAccount,
      scope: "https://www.googleapis.com/auth/datastore",
      aud: "https://oauth2.googleapis.com/token",
      iat: issuedAt,
      exp: issuedAt + 3600,
    }),
  );
  const signingInput = `${header}.${claims}`;
  const keyBytes = decodePem(privateKey);
  const signingKey = await crypto.subtle.importKey(
    "pkcs8",
    keyBytes,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    signingKey,
    new TextEncoder().encode(signingInput),
  );
  return `${signingInput}.${base64UrlBytes(new Uint8Array(signature))}`;
}

function decodePem(pem: string): ArrayBuffer {
  const encoded = pem
    .replace(/\\n/g, "\n")
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
}

function base64Url(value: string): string {
  return base64UrlBytes(new TextEncoder().encode(value));
}

function base64UrlBytes(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function requiredProjectId(env: ServerEnvironment): string {
  const projectId = serverEnv(env, "FIREBASE_PROJECT_ID");
  if (!projectId) throw new Error("Firebase server project is not configured.");
  return projectId;
}

function firestoreDocumentsUrl(env: ServerEnvironment, projectId: string): string {
  const emulatorHost = serverEnv(env, "FIRESTORE_EMULATOR_HOST");
  const baseUrl = emulatorHost
    ? `http://${emulatorHost.replace(/^https?:\/\//, "")}/v1`
    : "https://firestore.googleapis.com/v1";
  return `${baseUrl}/projects/${encodeURIComponent(projectId)}/databases/(default)/documents`;
}

function encodeDocumentPath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

function decodeDocumentPath(path: string): string {
  return path.split("/").map(decodeURIComponent).join("/");
}

function encodeFirestoreFields(data: FirestoreDocument): Record<string, FirestoreValue> {
  return Object.fromEntries(
    Object.entries(data)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, encodeFirestoreValue(value)]),
  );
}

function encodeFirestoreValue(value: unknown): FirestoreValue {
  if (value === null) return { nullValue: "NULL_VALUE" };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") {
    return Number.isSafeInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(encodeFirestoreValue) } };
  }
  if (typeof value === "object" && value && "__firestoreTimestamp" in value) {
    return { timestampValue: String(value.__firestoreTimestamp) };
  }
  if (typeof value === "object" && value) {
    return {
      mapValue: {
        fields: encodeFirestoreFields(value as FirestoreDocument),
      },
    };
  }
  throw new Error("Unsupported Firestore field value.");
}

function decodeFirestoreDocument(document: FirestoreRestDocument): FirestoreDocument {
  return Object.fromEntries(
    Object.entries(document.fields ?? {}).map(([key, value]) => [key, decodeFirestoreValue(value)]),
  );
}

function decodeFirestoreValue(value: FirestoreValue): unknown {
  if ("stringValue" in value) return value.stringValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return value.doubleValue;
  if ("booleanValue" in value) return value.booleanValue;
  if ("nullValue" in value) return null;
  if ("timestampValue" in value) return value.timestampValue;
  if (value.arrayValue) return (value.arrayValue.values ?? []).map(decodeFirestoreValue);
  if (value.mapValue) {
    return decodeFirestoreDocument({
      name: "",
      ...(value.mapValue.fields ? { fields: value.mapValue.fields } : {}),
    });
  }
  return null;
}
