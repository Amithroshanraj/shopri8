/**
 * Address, delivery-task and payment repositories.
 *
 * Addresses belong to the customer who saved them. Delivery tasks use the
 * SHOPRi8 task lifecycle from `src/lib/types.ts` (`DELIVERY_TASK_FLOW`), with the
 * same legal transitions the demo worker store enforces.
 */

import {
  createDeliveryTask,
  createPayment,
  claimDeliveryTask,
  fetchAddress,
  fetchAddresses,
  fetchAvailableTasks,
  fetchDeliveryTask,
  fetchPaymentsForOrder,
  fetchTasksForWorker,
  isFirebaseActive,
  removeAddress,
  saveAddress,
  updateAddress,
  updateDeliveryTask,
  updatePayment,
} from "../firebase";
import type { Address, DeliveryTask, DeliveryTaskStatus, OrderStatus, Payment } from "../types";
import { repositoryFailed, runWhenActive, type RepositoryResult } from "./types";

export const addressRepository = {
  async listForUser(userId: string): Promise<RepositoryResult<Address[]>> {
    return runWhenActive(
      isFirebaseActive,
      () => fetchAddresses(userId),
      "Could not load your addresses.",
    );
  },

  async get(addressId: string): Promise<RepositoryResult<Address | null>> {
    return runWhenActive(
      isFirebaseActive,
      () => fetchAddress(addressId),
      "Could not load that address.",
    );
  },

  async save(address: Omit<Address, "id"> & { id?: string }): Promise<RepositoryResult<string>> {
    return runWhenActive(
      isFirebaseActive,
      () => saveAddress(address),
      "Could not save that address.",
    );
  },

  async update(addressId: string, patch: Partial<Address>): Promise<RepositoryResult<void>> {
    return runWhenActive(
      isFirebaseActive,
      () => updateAddress(addressId, patch),
      "Could not update that address.",
    );
  },

  async remove(addressId: string): Promise<RepositoryResult<void>> {
    return runWhenActive(
      isFirebaseActive,
      () => removeAddress(addressId),
      "Could not delete that address.",
    );
  },
};

/**
 * Task transitions, mirrored from `src/lib/workerStore.tsx`.
 * `DELIVERY_FAILED` and `CANCELLED` are terminal.
 */
export const DELIVERY_TASK_TRANSITIONS: Partial<Record<DeliveryTaskStatus, DeliveryTaskStatus[]>> =
  {
    AVAILABLE: ["DELIVERY_ASSIGNED"],
    DELIVERY_ASSIGNED: ["PICKED_UP", "DELIVERY_FAILED"],
    PICKED_UP: ["OUT_FOR_DELIVERY", "DELIVERY_FAILED"],
    OUT_FOR_DELIVERY: ["DELIVERED", "DELIVERY_FAILED"],
  };

export function nextTaskStatuses(current: DeliveryTaskStatus): DeliveryTaskStatus[] {
  if (current === "DELIVERY_FAILED" || current === "CANCELLED") return [];
  return DELIVERY_TASK_TRANSITIONS[current] ?? [];
}

export function canTransitionTask(from: DeliveryTaskStatus, to: DeliveryTaskStatus): boolean {
  return nextTaskStatuses(from).includes(to);
}

/** Order status each task status implies, mirrored from `src/lib/workerStore.tsx`. */
export const ORDER_STATUS_FROM_TASK: Partial<Record<DeliveryTaskStatus, OrderStatus>> = {
  AVAILABLE: "READY_FOR_PICKUP",
  DELIVERY_ASSIGNED: "DELIVERY_ASSIGNED",
  PICKED_UP: "PICKED_UP",
  OUT_FOR_DELIVERY: "OUT_FOR_DELIVERY",
  DELIVERED: "DELIVERED",
  DELIVERY_FAILED: "DELIVERY_FAILED",
};

export const deliveryRepository = {
  /** The open task board any worker may claim from. */
  async listAvailable(): Promise<RepositoryResult<DeliveryTask[]>> {
    return runWhenActive(
      isFirebaseActive,
      () => fetchAvailableTasks(),
      "Could not load available tasks.",
    );
  },

  async listForWorker(deliveryWorkerId: string): Promise<RepositoryResult<DeliveryTask[]>> {
    return runWhenActive(
      isFirebaseActive,
      () => fetchTasksForWorker(deliveryWorkerId),
      "Could not load your tasks.",
    );
  },

  async get(taskId: string): Promise<RepositoryResult<DeliveryTask | null>> {
    return runWhenActive(
      isFirebaseActive,
      () => fetchDeliveryTask(taskId),
      "Could not load that task.",
    );
  },

  /**
   * Claims an AVAILABLE task for a worker.
   *
   * Implemented as a guarded batch so two workers cannot both claim it. The
   * Firestore rules additionally require the caller to hold the
   * `deliveryWorker` capability.
   */
  async claim(taskId: string, deliveryWorkerId: string): Promise<RepositoryResult<void>> {
    return runWhenActive(
      isFirebaseActive,
      () => claimDeliveryTask(taskId, deliveryWorkerId),
      "Could not claim that task.",
    );
  },

  /** Guarded transition, mirroring the demo worker store's rules. */
  async advance(
    task: DeliveryTask,
    nextStatus: DeliveryTaskStatus,
    patch: Partial<DeliveryTask> = {},
  ): Promise<RepositoryResult<void>> {
    if (!canTransitionTask(task.status, nextStatus)) {
      return repositoryFailed(
        new Error(`Cannot move a task from ${task.status} to ${nextStatus}.`),
        "That task cannot move to that status.",
      );
    }
    return runWhenActive(
      isFirebaseActive,
      () => updateDeliveryTask(task.id, { ...patch, status: nextStatus }),
      "Could not update that task.",
    );
  },

  async create(
    task: Omit<DeliveryTask, "id" | "createdAt" | "updatedAt"> & { id?: string },
  ): Promise<RepositoryResult<string>> {
    return runWhenActive(
      isFirebaseActive,
      () => createDeliveryTask(task),
      "Could not create that task.",
    );
  },
};

export const paymentRepository = {
  async listForOrder(orderId: string): Promise<RepositoryResult<Payment[]>> {
    return runWhenActive(
      isFirebaseActive,
      () => fetchPaymentsForOrder(orderId),
      "Could not load payments for that order.",
    );
  },

  /**
   * Records a payment attempt.
   *
   * Only gateway identifiers are stored. Cashfree secret keys must never be
   * passed here — signature generation belongs in Cloud Functions.
   */
  async record(
    payment: Omit<Payment, "id" | "createdAt" | "updatedAt"> & { id?: string },
  ): Promise<RepositoryResult<string>> {
    return runWhenActive(
      isFirebaseActive,
      () => createPayment(payment),
      "Could not record that payment.",
    );
  },

  async update(paymentId: string, patch: Partial<Payment>): Promise<RepositoryResult<void>> {
    return runWhenActive(
      isFirebaseActive,
      () => updatePayment(paymentId, patch),
      "Could not update that payment.",
    );
  },
};
