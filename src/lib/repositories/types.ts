/**
 * Repository contracts.
 *
 * Repositories are the boundary between the UI and Firebase. UI code depends on
 * these shapes, never on the Firestore SDK, which is what makes the
 * domain-by-domain migration reversible: swapping a repository's implementation
 * changes no component.
 *
 * Reads and writes return a `RepositoryResult` rather than throwing, because the
 * app must stay usable while Firebase is unconfigured or offline. A caller that
 * receives `unavailable` or `failed` falls back to the local demo store, which
 * is exactly what the current prototype does.
 */

import type { Capability } from "../types";

export type RepositoryFailureKind = "unavailable" | "unauthenticated" | "failed";

export type RepositoryResult<T> =
  { ok: true; data: T } | { ok: false; kind: RepositoryFailureKind; message: string };

export function repositoryOk<T>(data: T): RepositoryResult<T> {
  return { ok: true, data };
}

/** Firebase is not configured, so the caller should use its demo data. */
export function repositoryUnavailable<T = never>(
  message = "Firebase is not configured.",
): RepositoryResult<T> {
  return { ok: false, kind: "unavailable", message };
}

export function repositoryUnauthenticated<T = never>(
  message = "You must be signed in.",
): RepositoryResult<T> {
  return { ok: false, kind: "unauthenticated", message };
}

export function repositoryFailed<T = never>(error: unknown, fallback: string): RepositoryResult<T> {
  const message = error instanceof Error && error.message ? error.message : fallback;
  return { ok: false, kind: "failed", message };
}

/** Runs a repository call, mapping any throw into a `failed` result. */
export async function runRepository<T>(
  operation: () => Promise<T>,
  fallbackMessage: string,
): Promise<RepositoryResult<T>> {
  try {
    return repositoryOk(await operation());
  } catch (error) {
    return repositoryFailed(error, fallbackMessage);
  }
}

/**
 * Runs a repository call only when Firebase is usable.
 *
 * Returns `unavailable` without invoking the operation otherwise, so a disabled
 * backend never attempts a network call.
 */
export async function runWhenActive<T>(
  isActive: boolean,
  operation: () => Promise<T>,
  fallbackMessage: string,
): Promise<RepositoryResult<T>> {
  if (!isActive) return repositoryUnavailable();
  return runRepository(operation, fallbackMessage);
}

/** The identity a repository acts as. */
export interface RepositoryActor {
  uid: string;
  capabilities: Capability[];
}
