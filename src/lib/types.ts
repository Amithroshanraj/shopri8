/**
 * SHOPRi8 domain model.
 * Mirrors the planned Firestore collections: users, shops, categories,
 * products, addresses, orders, payments, deliveryTasks.
 */

import type { ProductImageSource } from "./productImage";

export type Capability = "customer" | "retailer" | "delivery_worker" | "admin";
export type AccountStatus = "active" | "suspended";

export interface AppUser {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  capabilities: Capability[];
  profileImage?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type ShopStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED";

export interface Shop {
  id: string;
  ownerId: string;
  name: string;
  category: CategoryId;
  description: string;
  image?: string | undefined;
  phone?: string | undefined;
  latitude?: number | undefined;
  longitude?: number | undefined;
  address: string;
  openingTime?: string;
  closingTime?: string;
  status: ShopStatus;
  createdAt?: string;
  updatedAt?: string;
}

export type RetailerApplicationStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface RetailerApplication {
  id: string;
  applicantUid: string;
  applicantName: string;
  applicantEmail: string;
  applicantPhone: string;
  shopName: string;
  category: CategoryId;
  description: string;
  shopPhone: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  openingTime: string;
  closingTime: string;
  status: RetailerApplicationStatus;
  createdAt: string;
  updatedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  rejectionReason?: string;
  shopId?: string;
}

export type RetailerApplicationInput = Omit<
  RetailerApplication,
  | "id"
  | "applicantUid"
  | "status"
  | "createdAt"
  | "updatedAt"
  | "reviewedAt"
  | "reviewedBy"
  | "rejectionReason"
  | "shopId"
>;

export type CategoryId =
  | "grocery"
  | "fruits-vegetables"
  | "flowers"
  | "pharmacy"
  | "bakery"
  | "stationery"
  | "hardware"
  | "fashion"
  | "electronics"
  | "household"
  | "meat-fish"
  | "other";

export interface Category {
  id: CategoryId;
  name: string;
  description: string;
  icon: string;
  image: string;
  status: "ACTIVE" | "INACTIVE";
}

export interface Product {
  id: string;
  shopId: string;
  name: string;
  description: string;
  price: number;
  /** Legacy image field, still honoured for products saved before imageSource. */
  image?: string | null | undefined;
  /**
   * Typed image ownership: a shared SHOPRi8 catalogue image or a retailer-specific
   * upload. Takes priority over `image` when present.
   */
  imageSource?: ProductImageSource | null | undefined;
  stock: number;
  availability: boolean;
  category: CategoryId;
  unit?: string | undefined;
  createdAt?: string;
  updatedAt?: string;
}

export interface Address {
  id: string;
  userId: string;
  label: string;
  recipientName: string;
  phone: string;
  address: string;
  houseNumber?: string;
  landmark?: string;
  latitude: number;
  longitude: number;
  isDefault: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export const ORDER_STATUS_FLOW = [
  "PLACED",
  "RETAILER_REVIEW",
  "ACCEPTED",
  "PREPARING",
  "READY_FOR_PICKUP",
  "DELIVERY_ASSIGNED",
  "PICKED_UP",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
] as const;

export type OrderStatusFlow = (typeof ORDER_STATUS_FLOW)[number];

export type OrderStatus =
  | OrderStatusFlow
  | "REJECTED"
  | "CANCELLED"
  | "PAYMENT_FAILED"
  | "DELIVERY_FAILED"
  | "REFUND_PENDING"
  | "REFUNDED";

export type PaymentStatus =
  | "CREATED"
  | "PENDING"
  | "PAID"
  | "FAILED"
  | "EXPIRED"
  | "CANCELLED"
  | "REFUNDED"
  | "PARTIALLY_REFUNDED"
  | "COD_PENDING"
  | "COD_COLLECTED";

export type PaymentMethod = "DEMO_UPI" | "COD";

export interface OrderItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
}

export interface Order {
  id: string;
  customerId: string;
  shopId: string;
  shopName: string;
  items: OrderItem[];
  subtotal: number;
  deliveryFee: number;
  totalAmount: number;
  deliveryAddress: Address;
  deliveryAddressId?: string | undefined;
  /**
   * Document ID of the delivery task fulfilling this order.
   *
   * Stored on the order rather than derived, because the security rules cannot
   * query `deliveryTasks` by `orderId`. A worker may only advance an order whose
   * task names them as `deliveryWorkerId`.
   */
  deliveryTaskId?: string | undefined;
  paymentMethod: PaymentMethod;
  paymentId?: string | undefined;
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  statusHistory: { status: OrderStatus; at: string }[];
  createdAt: string;
  updatedAt: string;
  rejectionReason?: string | undefined;
}

export const STANDARD_DELIVERY_FEE = 29;

export interface Payment {
  id: string;
  orderId: string;
  customerId?: string;
  shopId?: string;
  gateway: "SHOPRI8_DEMO";
  method?: "DEMO_UPI";
  amount: number;
  currency?: string;
  status: PaymentStatus;
  paymentMethod: PaymentMethod;
  inputFingerprint?: string;
  createdAt?: string;
  updatedAt?: string;
  paidAt?: string;
  failureReason?: string;
}

export const DELIVERY_TASK_FLOW = [
  "AVAILABLE",
  "DELIVERY_ASSIGNED",
  "PICKED_UP",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
] as const;

export type DeliveryTaskStatus =
  (typeof DELIVERY_TASK_FLOW)[number] | "DELIVERY_FAILED" | "CANCELLED";

export interface DeliveryTask {
  id: string;
  orderId: string;
  shopId: string;
  pickupLocation: { latitude: number; longitude: number };
  deliveryLocation: { latitude: number; longitude: number };
  /** Firebase UID of the worker assigned to this task. */
  deliveryWorkerId?: string;
  status: DeliveryTaskStatus;
  distance: number;
  deliveryFee: number;
  failureReason?: string;
  failureNotes?: string;
  /** Legacy demo timestamp; Firebase writes `failedAt`. */
  failureAt?: string;
  failedAt?: string;
  assignedAt?: string;
  pickedUpAt?: string;
  outForDeliveryAt?: string;
  deliveredAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  PLACED: "Placed",
  RETAILER_REVIEW: "With retailer",
  ACCEPTED: "Accepted",
  PREPARING: "Preparing",
  READY_FOR_PICKUP: "Ready for pickup",
  DELIVERY_ASSIGNED: "Delivery assigned",
  PICKED_UP: "Picked up",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
  PAYMENT_FAILED: "Payment failed",
  DELIVERY_FAILED: "Delivery failed",
  REFUND_PENDING: "Refund pending",
  REFUNDED: "Refunded",
};
