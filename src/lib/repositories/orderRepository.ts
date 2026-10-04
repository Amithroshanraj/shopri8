/**
 * Order repository.
 *
 * The order lifecycle is SHOPRi8's own and is defined once in
 * `src/lib/types.ts`. This repository reuses those constants verbatim and adds
 * the same legal-transition guards the demo stores already enforce, so moving an
 * order to Firestore cannot introduce a second state machine.
 *
 * Allowed transitions, mirrored from `src/lib/retailerStore.tsx`:
 *
 *   PLACED -> RETAILER_REVIEW
 *   RETAILER_REVIEW -> ACCEPTED | REJECTED
 *   ACCEPTED -> PREPARING
 *   PREPARING -> READY_FOR_PICKUP
 *
 * and from `src/lib/workerStore.tsx`:
 *
 *   READY_FOR_PICKUP -> DELIVERY_ASSIGNED
 *   DELIVERY_ASSIGNED -> PICKED_UP | DELIVERY_FAILED
 *   PICKED_UP -> OUT_FOR_DELIVERY | DELIVERY_FAILED
 *   OUT_FOR_DELIVERY -> DELIVERED | DELIVERY_FAILED
 */

import { ORDER_STATUS_FLOW, type Order, type OrderStatus } from "../types";
import {
  createOrder,
  fetchOrder,
  fetchOrdersForCustomer,
  fetchOrdersForShop,
  isFirebaseActive,
  transitionOrder,
  updateOrder,
} from "../firebase";
import { repositoryFailed, repositoryOk, runWhenActive, type RepositoryResult } from "./types";

export const RETAILER_ORDER_TRANSITIONS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  PLACED: ["RETAILER_REVIEW"],
  RETAILER_REVIEW: ["ACCEPTED", "REJECTED"],
  ACCEPTED: ["PREPARING"],
  PREPARING: ["READY_FOR_PICKUP"],
};

export const DELIVERY_ORDER_TRANSITIONS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  READY_FOR_PICKUP: ["DELIVERY_ASSIGNED"],
  DELIVERY_ASSIGNED: ["PICKED_UP", "DELIVERY_FAILED"],
  PICKED_UP: ["OUT_FOR_DELIVERY", "DELIVERY_FAILED"],
  OUT_FOR_DELIVERY: ["DELIVERED", "DELIVERY_FAILED"],
};

/** Statuses that end an order and accept no further transition. */
export const TERMINAL_ORDER_STATUSES: readonly OrderStatus[] = [
  "DELIVERED",
  "REJECTED",
  "CANCELLED",
  "PAYMENT_FAILED",
  "DELIVERY_FAILED",
  "REFUNDED",
];

/** Next statuses reachable from `current`, or an empty list when it is terminal. */
export function nextOrderStatuses(current: OrderStatus): OrderStatus[] {
  if (TERMINAL_ORDER_STATUSES.includes(current)) return [];
  return [
    ...(RETAILER_ORDER_TRANSITIONS[current] ?? []),
    ...(DELIVERY_ORDER_TRANSITIONS[current] ?? []),
  ];
}

export function canTransitionOrder(from: OrderStatus, to: OrderStatus): boolean {
  return nextOrderStatuses(from).includes(to);
}

/** True for statuses that appear in the happy-path flow, in order. */
export function isInOrderFlow(status: OrderStatus): boolean {
  return (ORDER_STATUS_FLOW as readonly string[]).includes(status);
}

export const orderRepository = {
  async listForCustomer(customerId: string): Promise<RepositoryResult<Order[]>> {
    return runWhenActive(
      isFirebaseActive,
      () => fetchOrdersForCustomer(customerId),
      "Could not load your orders.",
    );
  },

  async listForShop(shopId: string, status?: OrderStatus): Promise<RepositoryResult<Order[]>> {
    return runWhenActive(
      isFirebaseActive,
      () => fetchOrdersForShop(shopId, status),
      "Could not load orders for your shop.",
    );
  },

  async get(orderId: string): Promise<RepositoryResult<Order | null>> {
    return runWhenActive(isFirebaseActive, () => fetchOrder(orderId), "Could not load that order.");
  },

  /**
   * Places an order, seeding `statusHistory` with its first entry.
   *
   * Rejects a caller-supplied status that is not in the flow, so a new order can
   * only ever start at a real lifecycle state.
   */
  async place(
    order: Omit<Order, "id" | "createdAt" | "updatedAt" | "statusHistory"> & { id?: string },
  ): Promise<RepositoryResult<string>> {
    if (!isInOrderFlow(order.orderStatus)) {
      return repositoryFailed(
        new Error(`"${order.orderStatus}" is not a valid starting order status.`),
        "Invalid order status.",
      );
    }
    return runWhenActive(isFirebaseActive, () => createOrder(order), "Could not place your order.");
  },

  /**
   * Advances an order after checking the transition locally.
   *
   * The local check is a guard against UI mistakes, not a security boundary —
   * `firestore.rules` independently enforces the same transitions server-side.
   */
  async advance(order: Order, nextStatus: OrderStatus): Promise<RepositoryResult<void>> {
    if (!canTransitionOrder(order.orderStatus, nextStatus)) {
      return repositoryFailed(
        new Error(`Cannot move an order from ${order.orderStatus} to ${nextStatus}.`),
        "That order cannot move to that status.",
      );
    }
    return runWhenActive(
      isFirebaseActive,
      () => transitionOrder(order.id, nextStatus),
      "Could not update that order.",
    );
  },

  /** Unconstrained patch, for annotations such as `rejectionReason`. */
  async patch(orderId: string, patch: Partial<Order>): Promise<RepositoryResult<void>> {
    return runWhenActive(
      isFirebaseActive,
      () => updateOrder(orderId, patch),
      "Could not update that order.",
    );
  },

  /** Guarded transition helper for callers that only have a status. */
  async transitionFrom(
    orderId: string,
    current: OrderStatus,
    nextStatus: OrderStatus,
  ): Promise<RepositoryResult<void>> {
    if (!canTransitionOrder(current, nextStatus)) {
      return repositoryFailed(
        new Error(`Cannot move an order from ${current} to ${nextStatus}.`),
        "That order cannot move to that status.",
      );
    }
    return runWhenActive(
      isFirebaseActive,
      () => transitionOrder(orderId, nextStatus),
      "Could not update that order.",
    );
  },
};

export { repositoryOk };
