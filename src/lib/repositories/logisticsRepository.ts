/**
 * Address, delivery-task and payment repositories.
 *
 * Addresses belong to the customer who saved them. Delivery tasks use the
 * SHOPRi8 task lifecycle from `src/lib/types.ts` (`DELIVERY_TASK_FLOW`), with the
 * same legal transitions the demo worker store enforces.
 */

import {
  assignDeliveryTask,
  claimDeliveryTask,
  fetchAddress,
  fetchAddresses,
  fetchAvailableTasks,
  fetchAllDeliveryTasks,
  fetchDeliveryTask,
  fetchPaymentsForOrder,
  fetchTasksForWorker,
  isFirebaseActive,
  subscribeToAllDeliveryTasks,
  subscribeToAvailableTasks,
  subscribeToTasksForWorker,
  removeAddress,
  saveAddress,
  updateAddress,
  updateDeliveryTask,
} from "../firebase";
import type { Address, DeliveryTask, DeliveryTaskStatus, OrderStatus, Payment } from "../types";
import type { Unsubscribe } from "firebase/firestore";
import { repositoryFailed, runWhenActive, type RepositoryResult } from "./types";

function safeDeliveryResult<T>(result: RepositoryResult<T>, fallback: string): RepositoryResult<T> {
  if (result.ok) return result;
  if (/permission|unauthenticated|not authorized/i.test(result.message)) {
    return { ...result, message: "You are not authorized to perform this delivery action." };
  }
  if (/unavailable|network|deadline-exceeded/i.test(result.message)) {
    return { ...result, message: "Could not reach the delivery service. Check your connection." };
  }
  if (/already been claimed|no longer available|aborted/i.test(result.message)) {
    return { ...result, message: "Task is no longer available." };
  }
  return { ...result, message: result.message || fallback };
}

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
    DELIVERY_ASSIGNED: ["PICKED_UP"],
    PICKED_UP: ["OUT_FOR_DELIVERY"],
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
  async listAll(): Promise<RepositoryResult<DeliveryTask[]>> {
    return runWhenActive(
      isFirebaseActive,
      () => fetchAllDeliveryTasks(),
      "Could not load delivery tasks.",
    );
  },
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

  subscribeAll(
    onNext: (tasks: DeliveryTask[]) => void,
    onError: (error: Error) => void,
  ): Unsubscribe {
    return subscribeToAllDeliveryTasks(onNext, onError);
  },

  subscribeAvailable(
    onNext: (tasks: DeliveryTask[]) => void,
    onError: (error: Error) => void,
  ): Unsubscribe {
    return subscribeToAvailableTasks(onNext, onError);
  },

  subscribeForWorker(
    workerId: string,
    onNext: (tasks: DeliveryTask[]) => void,
    onError: (error: Error) => void,
  ): Unsubscribe {
    return subscribeToTasksForWorker(workerId, onNext, onError);
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
    return safeDeliveryResult(
      await runWhenActive(
        isFirebaseActive,
        () => claimDeliveryTask(taskId, deliveryWorkerId),
        "Could not claim that task.",
      ),
      "Could not claim that task.",
    );
  },

  async assign(taskId: string, deliveryWorkerId: string): Promise<RepositoryResult<void>> {
    return safeDeliveryResult(
      await runWhenActive(
        isFirebaseActive,
        () => assignDeliveryTask(taskId, deliveryWorkerId),
        "Could not assign that delivery task.",
      ),
      "Could not assign that delivery task.",
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
    return safeDeliveryResult(
      await runWhenActive(
        isFirebaseActive,
        () => updateDeliveryTask(task.id, { ...patch, status: nextStatus }),
        "Could not update that task.",
      ),
      "Could not update that task.",
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
};
