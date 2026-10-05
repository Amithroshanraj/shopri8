/**
 * Repository layer — the seam between the UI and Firebase.
 *
 * Application code should import repositories from `@/lib/repositories` rather
 * than importing `src/lib/firebase` directly. That keeps Firestore out of
 * components and makes each domain's migration independently reversible.
 *
 * Migration status — all of these are available but NOT yet wired into the UI,
 * which continues to use the local demo stores:
 *
 *   userRepository      users/{uid} + capabilities
 *   shopRepository      shops/{shopId}
 *   categoryRepository  categories/{categoryId}
 *   productRepository   products/{productId}
 *   addressRepository   addresses/{addressId}
 *   orderRepository     orders/{orderId}
 *   deliveryRepository  deliveryTasks/{taskId}
 *   paymentRepository   payments/{paymentId}
 *
 * Every call returns a `RepositoryResult`. `kind: "unavailable"` means Firebase
 * is switched off and the caller should use its demo data.
 */

export {
  repositoryFailed,
  repositoryOk,
  repositoryUnavailable,
  repositoryUnauthenticated,
  runRepository,
  runWhenActive,
  type RepositoryActor,
  type RepositoryFailureKind,
  type RepositoryResult,
} from "./types";

export { userRepository, type UserProfile } from "./userRepository";
export { retailerApplicationRepository } from "./retailerApplicationRepository";

export {
  catalogRepository,
  categoryRepository,
  productRepository,
  shopRepository,
} from "./catalogRepository";

export {
  DELIVERY_ORDER_TRANSITIONS,
  RETAILER_ORDER_TRANSITIONS,
  TERMINAL_ORDER_STATUSES,
  canTransitionOrder,
  isInOrderFlow,
  nextOrderStatuses,
  orderRepository,
} from "./orderRepository";

export {
  DELIVERY_TASK_TRANSITIONS,
  ORDER_STATUS_FROM_TASK,
  addressRepository,
  canTransitionTask,
  deliveryRepository,
  nextTaskStatuses,
  paymentRepository,
} from "./logisticsRepository";
