import { DEMO_CENTER, SHOP_BY_ID } from "./demo";
import type { Address, DeliveryTask, Order, OrderStatus } from "@/lib/types";

export const DEMO_WORKER_ID = "worker-demo-1";
const SHOP = SHOP_BY_ID["shop-green-basket"]!;

interface DemoDeliveryOrderInput {
  id: string;
  status: OrderStatus;
  recipientName: string;
  phone: string;
  address: string;
  houseNumber: string;
  landmark: string;
  distance: number;
  lifecycle: OrderStatus[];
  assigned: boolean;
  failureReason?: string;
  failureNotes?: string;
}

function createDeliveryOrder(input: DemoDeliveryOrderInput): Order {
  const createdAt = new Date("2026-10-01T08:00:00.000Z").toISOString();
  const deliveryAddress: Address = {
    id: `addr-${input.id}`,
    userId: `demo-${input.id}`,
    label: "Home",
    recipientName: input.recipientName,
    phone: input.phone,
    address: input.address,
    houseNumber: input.houseNumber,
    landmark: input.landmark,
    latitude: DEMO_CENTER.latitude + input.distance / 111,
    longitude: DEMO_CENTER.longitude + input.distance / 111,
    isDefault: true,
  };

  return {
    id: input.id,
    customerId: `demo-${input.id}`,
    shopId: SHOP.id,
    shopName: SHOP.name,
    items: [
      { productId: "p-rice-5", name: "Sona Masoori Rice", price: 340, quantity: 1 },
      { productId: "p-toor-dal", name: "Toor Dal", price: 155, quantity: 1 },
    ],
    subtotal: 495,
    deliveryFee: 35,
    totalAmount: 530,
    deliveryAddress,
    paymentMethod: "COD",
    paymentStatus: "COD_PENDING",
    orderStatus: input.status,
    statusHistory: input.lifecycle.map((status, index) => ({
      status,
      at: new Date(Date.parse(createdAt) + index * 15 * 60 * 1000).toISOString(),
    })),
    createdAt,
    updatedAt: new Date(
      Date.parse(createdAt) + (input.lifecycle.length - 1) * 15 * 60 * 1000,
    ).toISOString(),
  };
}

const demoDeliveryInputs: DemoDeliveryOrderInput[] = [
  {
    id: "SR8-ORD-201",
    status: "READY_FOR_PICKUP",
    recipientName: "Asha Menon",
    phone: "+91 90000 00001",
    address: "18, 2nd Main Road, Wilson Garden, Bengaluru",
    houseNumber: "Flat 3A",
    landmark: "Opposite the community park",
    distance: 1.8,
    lifecycle: ["PLACED", "ACCEPTED", "PREPARING", "READY_FOR_PICKUP"],
    assigned: false,
  },
  {
    id: "SR8-ORD-202",
    status: "OUT_FOR_DELIVERY",
    recipientName: "Ravi Nair",
    phone: "+91 90000 00002",
    address: "6, 5th Cross, Basavanagudi, Bengaluru",
    houseNumber: "House 6",
    landmark: "Near Bull Temple Road",
    distance: 2.4,
    lifecycle: [
      "PLACED",
      "ACCEPTED",
      "PREPARING",
      "READY_FOR_PICKUP",
      "DELIVERY_ASSIGNED",
      "PICKED_UP",
      "OUT_FOR_DELIVERY",
    ],
    assigned: true,
  },
  {
    id: "SR8-ORD-203",
    status: "DELIVERED",
    recipientName: "Meera Iyer",
    phone: "+91 90000 00003",
    address: "24, 1st Cross, Jayanagar, Bengaluru",
    houseNumber: "Flat 12",
    landmark: "Beside the library",
    distance: 1.2,
    lifecycle: [
      "PLACED",
      "ACCEPTED",
      "PREPARING",
      "READY_FOR_PICKUP",
      "DELIVERY_ASSIGNED",
      "PICKED_UP",
      "OUT_FOR_DELIVERY",
      "DELIVERED",
    ],
    assigned: true,
  },
  {
    id: "SR8-ORD-204",
    status: "DELIVERY_FAILED",
    recipientName: "Kiran Rao",
    phone: "+91 90000 00004",
    address: "3, Lake View Road, Ulsoor, Bengaluru",
    houseNumber: "Building B",
    landmark: "Across from the post office",
    distance: 3.1,
    lifecycle: [
      "PLACED",
      "ACCEPTED",
      "PREPARING",
      "READY_FOR_PICKUP",
      "DELIVERY_ASSIGNED",
      "PICKED_UP",
      "OUT_FOR_DELIVERY",
      "DELIVERY_FAILED",
    ],
    assigned: true,
    failureReason: "Customer unavailable",
    failureNotes: "Demo record; no live contact or delivery was attempted.",
  },
];

export const DEMO_DELIVERY_ORDERS: Order[] = demoDeliveryInputs.map(createDeliveryOrder);

function taskStatusForOrder(status: OrderStatus): DeliveryTask["status"] {
  if (status === "READY_FOR_PICKUP") return "AVAILABLE";
  if (
    status === "DELIVERY_ASSIGNED" ||
    status === "PICKED_UP" ||
    status === "OUT_FOR_DELIVERY" ||
    status === "DELIVERED" ||
    status === "DELIVERY_FAILED"
  ) {
    return status;
  }
  return "CANCELLED";
}

export const DEMO_DELIVERY_TASKS: DeliveryTask[] = demoDeliveryInputs.map((input) => ({
  id: `task-${input.id}`,
  orderId: input.id,
  shopId: SHOP.id,
  ...(input.assigned ? { deliveryWorkerId: DEMO_WORKER_ID } : {}),
  pickupLocation: { latitude: SHOP.latitude, longitude: SHOP.longitude },
  deliveryLocation: {
    latitude: DEMO_CENTER.latitude + input.distance / 111,
    longitude: DEMO_CENTER.longitude + input.distance / 111,
  },
  status: taskStatusForOrder(input.status),
  distance: input.distance,
  deliveryFee: 35,
  ...(input.failureReason
    ? {
        failureReason: input.failureReason,
        failureNotes: input.failureNotes,
        failureAt: new Date("2026-10-01T10:00:00.000Z").toISOString(),
      }
    : {}),
  createdAt: new Date("2026-10-01T08:00:00.000Z").toISOString(),
  updatedAt: new Date("2026-10-01T10:00:00.000Z").toISOString(),
}));
