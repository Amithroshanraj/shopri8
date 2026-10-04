/**
 * SHOPRi8 domain model.
 * Mirrors the planned Firestore collections: users, shops, categories,
 * products, addresses, orders, payments, deliveryTasks.
 */

import type { ProductImageSource } from "./productImage";

export type Capability = "customer" | "retailer" | "deliveryWorker" | "admin";

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
  latitude: number;
  longitude: number;
  address: string;
  openingTime: string;
  closingTime: string;
  status: ShopStatus;
  createdAt?: string;
  updatedAt?: string;
}

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
  image?: string | undefined;
  /**
   * Typed image ownership: a shared SHOPRi8 catalogue image or a retailer-specific
   * upload. Takes priority over `image` when present.
   */
  imageSource?: ProductImageSource | undefined;
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
  | "PENDING"
  | "PAID"
  | "FAILED"
  | "CANCELLED"
  | "REFUNDED"
  | "PARTIALLY_REFUNDED"
  | "COD_PENDING"
  | "COD_COLLECTED";

export type PaymentMethod = "CASHFREE" | "COD";

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
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  statusHistory: { status: OrderStatus; at: string }[];
  createdAt: string;
  updatedAt: string;
  rejectionReason?: string | undefined;
}

export interface Payment {
  id: string;
  orderId: string;
  gateway: "CASHFREE";
  gatewayOrderId?: string;
  paymentSessionId?: string;
  amount: number;
  status: PaymentStatus;
  transactionId?: string;
  paymentMethod: PaymentMethod;
  createdAt?: string;
  updatedAt?: string;
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
  deliveryWorkerId?: string;
  pickupLocation: { latitude: number; longitude: number };
  deliveryLocation: { latitude: number; longitude: number };
  status: DeliveryTaskStatus;
  distance: number;
  deliveryFee: number;
  failureReason?: string;
  failureNotes?: string;
  failureAt?: string;
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
