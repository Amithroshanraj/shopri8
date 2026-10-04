/**
 * User repository — `users/{uid}` and the capability model.
 *
 * A user document holds every capability the account has been granted, so one
 * Firebase account can be a customer, a retailer and a delivery worker at once.
 * Nothing here assumes a single role.
 */

import {
  addUserCapability,
  createUserProfile,
  ensureUserProfile,
  fetchUser,
  fetchUsersByCapability,
  isFirebaseActive,
  removeUserCapability,
  setUserAccountStatus,
  updateUserProfile,
  type UserProfile,
} from "../firebase";
import type { AccountStatus, Capability } from "../types";
import { runWhenActive, type RepositoryResult } from "./types";

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

  getUserProfile(uid: string) {
    return userRepository.get(uid);
  },

  async createUserProfile(
    uid: string,
    profile: {
      displayName: string;
      email?: string | null;
      phoneNumber?: string | null;
      photoURL?: string | null;
    },
  ): Promise<RepositoryResult<void>> {
    return runWhenActive(
      isFirebaseActive,
      () => createUserProfile(uid, profile),
      "Could not create your profile.",
    );
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
      displayName?: string;
      email?: string | null;
      phoneNumber?: string | null;
      photoURL?: string | null;
      name?: string;
      phone?: string | null;
      profileImage?: string | null;
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
    patch: Parameters<typeof updateUserProfile>[1],
  ): Promise<RepositoryResult<void>> {
    return runWhenActive(
      isFirebaseActive,
      () => updateUserProfile(uid, patch),
      "Could not update your profile.",
    );
  },

  updateSafeUserProfile(uid: string, patch: Parameters<typeof updateUserProfile>[1]) {
    return userRepository.update(uid, patch);
  },

  async getCapabilities(uid: string): Promise<RepositoryResult<Capability[]>> {
    const result = await userRepository.get(uid);
    if (!result.ok) return result;
    return { ok: true, data: result.data?.capabilities ?? [] };
  },

  async hasCapability(uid: string, capability: Capability): Promise<RepositoryResult<boolean>> {
    const result = await userRepository.get(uid);
    if (!result.ok) return result;
    return {
      ok: true,
      data: result.data?.status === "active" && result.data.capabilities.includes(capability),
    };
  },

  async hasAnyCapability(
    uid: string,
    capabilities: readonly Capability[],
  ): Promise<RepositoryResult<boolean>> {
    const result = await userRepository.get(uid);
    if (!result.ok) return result;
    const profile = result.data;
    return {
      ok: true,
      data:
        profile?.status === "active" &&
        capabilities.some((capability) => profile.capabilities.includes(capability)),
    };
  },

  async hasAllCapabilities(
    uid: string,
    capabilities: readonly Capability[],
  ): Promise<RepositoryResult<boolean>> {
    const result = await userRepository.get(uid);
    if (!result.ok) return result;
    const profile = result.data;
    return {
      ok: true,
      data:
        profile?.status === "active" &&
        capabilities.every((capability) => profile.capabilities.includes(capability)),
    };
  },

  async getAccountStatus(uid: string): Promise<RepositoryResult<AccountStatus | null>> {
    const result = await userRepository.get(uid);
    if (!result.ok) return result;
    return { ok: true, data: result.data?.status ?? null };
  },

  async setAccountStatus(uid: string, status: AccountStatus): Promise<RepositoryResult<void>> {
    return runWhenActive(
      isFirebaseActive,
      () => setUserAccountStatus(uid, status),
      "Could not update account status.",
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
    return runWhenActive(
      isFirebaseActive,
      async () => {
        for (const capability of capabilities) {
          await addUserCapability(uid, capability);
        }
      },
      "Could not grant those capabilities.",
    );
  },
};

export type { UserProfile };
