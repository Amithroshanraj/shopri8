const FIREBASE_AUTH_MESSAGES: Record<string, string> = {
  "auth/email-already-in-use":
    "That email is already registered. Sign in instead, or link it to your existing account.",
  "auth/invalid-credential":
    "Those sign-in details do not match an account. Check your email and password.",
  "auth/wrong-password":
    "Those sign-in details do not match an account. Check your email and password.",
  "auth/invalid-email": "Enter a valid email address.",
  "auth/invalid-phone-number":
    "Enter a valid phone number in international format, for example +919876543210.",
  "auth/invalid-verification-code": "That code is incorrect. Check the code and try again.",
  "auth/invalid-verification-id": "This sign-in attempt expired. Request a new code.",
  "auth/missing-phone-number": "Enter your phone number to continue.",
  "auth/too-many-requests": "Too many attempts. Wait a few minutes before trying again.",
  "auth/network-request-failed":
    "We could not reach the network. Check your connection and try again.",
  "auth/operation-not-allowed":
    "This sign-in method is not enabled yet for this project. Contact support.",
  "auth/phone-number-already-in-use":
    "That phone number is already linked to another account. Sign in with it, or link it to your current account.",
  "auth/requires-recent-login": "For security, sign in again before making this change.",
  "auth/user-disabled": "This account has been disabled. Contact support.",
  "auth/user-not-found": "We could not find an account with those details.",
  "auth/weak-password": "Choose a password with at least 6 characters.",
  "auth/credential-already-in-use":
    "Those details already belong to a different account. Sign in with that account first, then link them from your profile.",
  "auth/email-already-authenticated-with-different-credential":
    "This email is already confirmed with a different sign-in method. Sign in with the original method.",
  "auth/unverified-email": "Confirm your email address before continuing.",
  "auth/popup-closed-by-user": "The sign-in window closed before finishing. Try again.",
  "auth/captcha-check-failed":
    "We could not verify that you are human. Refresh the page and try again.",
  "auth/too-many-requests-verify": "Too many code attempts. Request a new code and try again.",
  "auth/network-error": "We could not reach the network. Check your connection and try again.",
};

const FALLBACK_MESSAGE = "We could not complete sign-in. Please try again.";

function readCode(error: unknown): string {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string") return code;
  }
  return "";
}

export function isFirebaseAuthError(error: unknown): boolean {
  return readCode(error).startsWith("auth/");
}

export function toAuthErrorMessage(error: unknown, fallback?: string): string {
  const code = readCode(error);
  if (code && FIREBASE_AUTH_MESSAGES[code]) return FIREBASE_AUTH_MESSAGES[code];
  if (fallback) return fallback;
  if (error instanceof Error && error.message && !code) return error.message;
  return FALLBACK_MESSAGE;
}

export const AUTH_CODES = {
  missingCredential: "auth/missing-credential",
  invalidCredential: "auth/invalid-credential",
  userNotFound: "auth/user-not-found",
  emailAlreadyInUse: "auth/email-already-in-use",
  phoneNumberAlreadyInUse: "auth/phone-number-already-in-use",
  invalidVerificationCode: "auth/invalid-verification-code",
  invalidVerificationId: "auth/invalid-verification-id",
  tooManyRequests: "auth/too-many-requests",
  captchaCheckFailed: "auth/captcha-check-failed",
  credentialAlreadyInUse: "auth/credential-already-in-use",
  operationNotAllowed: "auth/operation-not-allowed",
  networkRequestFailed: "auth/network-request-failed",
} as const;
