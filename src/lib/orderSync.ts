export const ORDERS_STORAGE_KEY = "shopri8.orders.v1";
export const ORDERS_UPDATED_EVENT = "shopri8:orders-updated";

export function announceOrdersUpdated() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(ORDERS_UPDATED_EVENT));
  }
}
