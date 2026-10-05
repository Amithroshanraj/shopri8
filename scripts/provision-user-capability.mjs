/**
 * Trusted, non-destructive capability provisioning for an existing Firebase user.
 *
 * Uses Application Default Credentials and Firebase Auth/Firestore APIs. It
 * never creates or resets an Auth account; only an IAM-authorized operator can
 * grant capabilities because client Security Rules intentionally reject it.
 *
 * Usage:
 *   npm run provision:user-capability -- --project <project-id> --email <email> --capability retailer
 *   npm run provision:user-capability -- --project <project-id> --uid <firebase-uid> --capability delivery_worker
 */

import { GoogleAuth } from "google-auth-library";

const CAPABILITIES = new Set(["customer", "retailer", "delivery_worker", "admin"]);
const LEGACY_CAPABILITIES = new Map([["deliveryWorker", "delivery_worker"]]);
const AUTH_SCOPE = "https://www.googleapis.com/auth/identitytoolkit";
const FIRESTORE_SCOPE = "https://www.googleapis.com/auth/datastore";

function parseArgs(args) {
  const options = {};
  for (let i = 0; i < args.length; i += 1) {
    const key = args[i];
    if (key === "--help" || key === "-h") {
      options.help = true;
      continue;
    }
    if (!["--project", "--email", "--uid", "--capability"].includes(key)) {
      throw new Error(`Unknown argument: ${key}`);
    }
    const value = args[i + 1];
    if (!value || value.startsWith("--")) throw new Error(`A value is required for ${key}.`);
    options[key.slice(2)] = value;
    i += 1;
  }
  return options;
}

function usage() {
  console.log(
    "Usage: npm run provision:user-capability -- --project <id> (--email <email> | --uid <uid>) --capability <customer|retailer|delivery_worker|admin>",
  );
}

function decodeValue(value) {
  if ("stringValue" in value) return value.stringValue;
  if ("booleanValue" in value) return value.booleanValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return value.doubleValue;
  if ("timestampValue" in value) return value.timestampValue;
  if ("nullValue" in value) return null;
  if ("arrayValue" in value) return (value.arrayValue.values ?? []).map(decodeValue);
  if ("mapValue" in value) return decodeFields(value.mapValue.fields ?? {});
  return undefined;
}

function decodeFields(fields = {}) {
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, decodeValue(value)]),
  );
}

function encodeValue(value) {
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (value === null) return { nullValue: null };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encodeValue) } };
  throw new Error(`Cannot encode value of type ${typeof value}.`);
}

function encodeFields(fields) {
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, encodeValue(value)]),
  );
}

async function requestJson(url, token, project, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "x-goog-user-project": project,
      ...options.headers,
    },
  });
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = {};
  }
  if (!response.ok) {
    const message = body.error?.message ?? `HTTP ${response.status}`;
    throw new Error(`${response.status}: ${message}`);
  }
  return body;
}

async function lookupAuthUser(token, project, options) {
  const body = options.email ? { email: [options.email] } : { localId: [options.uid] };
  const result = await requestJson(
    `https://identitytoolkit.googleapis.com/v1/projects/${encodeURIComponent(project)}/accounts:lookup`,
    token,
    project,
    { method: "POST", body: JSON.stringify(body) },
  );
  const users = result.users ?? [];
  if (users.length !== 1) {
    throw new Error("Firebase Auth lookup did not return exactly one user.");
  }
  return users[0];
}

async function readProfile(token, project, uid) {
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(project)}/databases/(default)/documents/users/${encodeURIComponent(uid)}`;
  const response = await fetch(url, {
    headers: {
      authorization: `Bearer ${token}`,
      "x-goog-user-project": project,
    },
  });
  if (response.status === 404) return { url, profile: null };
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(`Could not parse Firestore profile response (HTTP ${response.status}).`);
  }
  if (!response.ok) {
    throw new Error(`${response.status}: ${body.error?.message ?? "Could not read user profile."}`);
  }
  return { url, profile: decodeFields(body.fields) };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    usage();
    return;
  }

  const project = options.project ?? process.env.GOOGLE_CLOUD_PROJECT ?? process.env.GCLOUD_PROJECT;
  if (!project) throw new Error("Pass --project or set GOOGLE_CLOUD_PROJECT.");
  if (Boolean(options.email) === Boolean(options.uid)) {
    throw new Error("Pass exactly one of --email or --uid.");
  }
  if (!CAPABILITIES.has(options.capability)) {
    throw new Error("--capability must be a canonical SHOPRi8 capability.");
  }
  if (options.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(options.email)) {
    throw new Error("--email must be a valid email address.");
  }

  process.env.GOOGLE_CLOUD_PROJECT ??= project;
  process.env.GOOGLE_CLOUD_QUOTA_PROJECT ??= project;

  const auth = new GoogleAuth({
    projectId: project,
    quotaProjectId: project,
    scopes: [AUTH_SCOPE, FIRESTORE_SCOPE],
  });
  const client = await auth.getClient();
  const tokenResult = await client.getAccessToken();
  const token = typeof tokenResult === "string" ? tokenResult : tokenResult?.token;
  if (!token) throw new Error("Application Default Credentials did not provide an access token.");

  const authUser = await lookupAuthUser(token, project, options);
  if (options.uid && authUser.localId !== options.uid) {
    throw new Error("Firebase Auth returned a UID different from the requested UID.");
  }
  if (options.email && authUser.email?.toLowerCase() !== options.email.toLowerCase()) {
    throw new Error("Firebase Auth returned an email different from the requested email.");
  }

  const { url, profile } = await readProfile(token, project, authUser.localId);
  const now = new Date().toISOString();
  let fields;

  if (!profile) {
    const displayName = authUser.displayName || authUser.email?.split("@")[0] || "SHOPRi8 user";
    fields = {
      uid: authUser.localId,
      displayName,
      capabilities: [options.capability],
      status: "active",
      createdAt: now,
      updatedAt: now,
      ...(authUser.email ? { email: authUser.email } : {}),
      ...(authUser.phoneNumber ? { phoneNumber: authUser.phoneNumber } : {}),
      ...(authUser.photoUrl ? { photoURL: authUser.photoUrl } : {}),
    };
    await requestJson(`${url}?currentDocument.exists=false`, token, project, {
      method: "PATCH",
      body: JSON.stringify({ fields: encodeFields(fields) }),
    });
  } else {
    if (profile.uid !== undefined && profile.uid !== authUser.localId) {
      throw new Error("The existing profile UID does not match Firebase Auth.");
    }
    if (profile.status !== undefined && !["active", "suspended"].includes(profile.status)) {
      throw new Error("The existing account status is invalid; refusing to overwrite the profile.");
    }
    const stored = profile.capabilities ?? [];
    if (!Array.isArray(stored) || stored.some((item) => typeof item !== "string")) {
      throw new Error("The existing capabilities field is invalid; refusing to overwrite it.");
    }
    const capabilities = [
      ...new Set(stored.map((capability) => LEGACY_CAPABILITIES.get(capability) ?? capability)),
    ];
    if (capabilities.some((capability) => !CAPABILITIES.has(capability))) {
      throw new Error(
        "The existing profile contains an unknown capability; refusing to overwrite it.",
      );
    }
    if (!capabilities.includes(options.capability)) capabilities.push(options.capability);

    fields = {
      capabilities,
      updatedAt: now,
      ...(profile.uid === undefined ? { uid: authUser.localId } : {}),
      ...(profile.status === undefined ? { status: "active" } : {}),
      ...(profile.displayName === undefined
        ? {
            displayName:
              profile.name ||
              authUser.displayName ||
              authUser.email?.split("@")[0] ||
              "SHOPRi8 user",
          }
        : {}),
      ...(profile.email === undefined && authUser.email ? { email: authUser.email } : {}),
      ...(profile.phoneNumber === undefined && (profile.phone || authUser.phoneNumber)
        ? { phoneNumber: profile.phone || authUser.phoneNumber }
        : {}),
      ...(profile.photoURL === undefined && (profile.profileImage || authUser.photoUrl)
        ? { photoURL: profile.profileImage || authUser.photoUrl }
        : {}),
    };
    const query = new URLSearchParams();
    for (const field of Object.keys(fields)) query.append("updateMask.fieldPaths", field);
    await requestJson(`${url}?${query}`, token, project, {
      method: "PATCH",
      body: JSON.stringify({ fields: encodeFields(fields) }),
    });
  }

  const verified = await readProfile(token, project, authUser.localId);
  const actual = verified.profile?.capabilities;
  if (!Array.isArray(actual) || !actual.includes(options.capability)) {
    throw new Error(
      "The profile write completed but the requested capability could not be verified.",
    );
  }
  console.log(
    `Provisioned ${options.capability} for Firebase UID ${authUser.localId}. Capabilities: ${actual.join(", ")}`,
  );
}

main().catch((error) => {
  console.error(`Capability provisioning failed: ${error.message ?? error}`);
  process.exitCode = 1;
});
