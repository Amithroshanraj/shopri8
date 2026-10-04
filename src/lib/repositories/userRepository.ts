/**
 * User repository — `users/{uid}` and the capability model.
 *
 * A user document holds every capability the account has been granted, so one
 * Firebase account can be a customer, a retailer and a delivery worker at once.
 * Nothing here assumes a single role.
 */

import {
  addUserCapability,
  ensureUserProfile,
  fetchUser,
  fetchUsersByCapability,
  isFirebaseActive,
  removeUserCapability,
  updateUserProfile,
  type UserProfile,
} from "../firebase";
import type { AppUser, Capability } from "../types";
import { runRepository, runWhenActive, type RepositoryResult } from "./types";

export const userRepository = {
  /**
   * Reads `users/{uid}`.
   *
   * `ok: false / unavailable` when Firebase is off; `ok: true / data: null` when
   * the account exists in Auth but has no profile document yet. Those are
   * different states and callers treat them differently.
   */
  async get(uid: string): Promise<RepositoryResult<UserProfile | null>> {
    return runWhenActive(isFirebaseActive, () => fetchUser(uid), "Could not load your profile.");
  },

  /**
   * Creates the profile if missing, otherwise patches it.
   *
   * Merge semantics preserve capabilities the user already holds, so a returning
   * multi-role user is never downgraded by a routine profile update.
   */
  async ensure(
    uid: string,
    profile: {
      name?: string;
      email?: string;
      phone?: string;
      profileImage?: string;
      capabilities?: Capability[];
    },
  ): Promise<RepositoryResult<void>> {
    return runWhenActive(
      isFirebaseActive,
      () => ensureUserProfile(uid, profile),
      "Could not save your profile.",
    );
  },

  async update(
    uid: string,
    patch: Partial<Omit<AppUser, "id" | "capabilities">>,
  ): Promise<RepositoryResult<void>> {
    return runWhenActive(
      isFirebaseActive,
      () => updateUserProfile(uid, patch),
      "Could not update your profile.",
    );
  },

  /** Grants a capability. Admin-only in practice; enforced by the security rules. */
  async grantCapability(uid: string, capability: Capability): Promise<RepositoryResult<void>> {
    return runWhenActive(
      isFirebaseActive,
      () => addUserCapability(uid, capability),
      "Could not grant that capability.",
    );
  },

  async revokeCapability(uid: string, capability: Capability): Promise<RepositoryResult<void>> {
    return runWhenActive(
      isFirebaseActive,
      () => removeUserCapability(uid, capability),
      "Could not revoke that capability.",
    );
  },

  async listByCapability(capability: Capability): Promise<RepositoryResult<UserProfile[]>> {
    return runWhenActive(
      isFirebaseActive,
      () => fetchUsersByCapability(capability),
      "Could not load users.",
    );
  },

  /** Grants several capabilities in one call. */
  async grantCapabilities(
    uid: string,
    capabilities: readonly Capability[],
  ): Promise<RepositoryResult<void>> {
    return runRepository(async () => {
      for (const capability of capabilities) {
        await addUserCapability(uid, capability);
      }
    }, "Could not grant those capabilities.");
  },
};

export type { UserProfile };
