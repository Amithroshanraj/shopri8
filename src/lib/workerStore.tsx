import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DEMO_DELIVERY_ORDERS, DEMO_DELIVERY_TASKS, DEMO_WORKER_ID } from "@/data/worker";
import { SHOP_BY_ID } from "@/data/demo";
import { announceOrdersUpdated, ORDERS_STORAGE_KEY, ORDERS_UPDATED_EVENT } from "./orderSync";
import type { DeliveryTask, DeliveryTaskStatus, Order, OrderStatus } from "./types";
import { isBrowser, isFirebaseActive } from "./firebase";
import { deliveryRepository, orderRepository } from "./repositories";
import { useWorkerAuth } from "./workerAuth";

const DELIVERY_TASKS_STORAGE_KEY = "shopri8.delivery.tasks.v1";
const DELIVERY_TASKS_UPDATED_EVENT = "shopri8:delivery-tasks-updated";

const STATUS_FROM_TASK: Partial<Record<DeliveryTaskStatus, OrderStatus>> = {
  AVAILABLE: "READY_FOR_PICKUP",
  DELIVERY_ASSIGNED: "DELIVERY_ASSIGNED",
  PICKED_UP: "PICKED_UP",
  OUT_FOR_DELIVERY: "OUT_FOR_DELIVERY",
  DELIVERED: "DELIVERED",
  DELIVERY_FAILED: "DELIVERY_FAILED",
};

const ALLOWED_TASK_TRANSITIONS: Partial<Record<DeliveryTaskStatus, DeliveryTaskStatus[]>> = {
  AVAILABLE: ["DELIVERY_ASSIGNED"],
  DELIVERY_ASSIGNED: ["PICKED_UP"],
  PICKED_UP: ["OUT_FOR_DELIVERY"],
  OUT_FOR_DELIVERY: ["DELIVERED", "DELIVERY_FAILED"],
};

interface WorkerStoreState {
  orders: Order[];
  tasks: DeliveryTask[];
  loading: boolean;
  error: string | null;
}

const INITIAL_ORDERS = DEMO_DELIVERY_ORDERS;

let storeState: WorkerStoreState = {
  orders: INITIAL_ORDERS,
  tasks: DEMO_DELIVERY_TASKS,
  loading: true,
  error: null,
};
const listeners = new Set<(state: WorkerStoreState) => void>();
let hasHydrated = false;

function notifyListeners() {
  listeners.forEach((listener) => listener(storeState));
}

function readStoredArray<T>(key: string): T[] | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : null;
  } catch {
    return null;
  }
}

function taskStatusForOrder(order: Order): DeliveryTaskStatus | null {
  switch (order.orderStatus) {
    case "READY_FOR_PICKUP":
      return "AVAILABLE";
    case "DELIVERY_ASSIGNED":
    case "PICKED_UP":
    case "OUT_FOR_DELIVERY":
    case "DELIVERED":
    case "DELIVERY_FAILED":
      return order.orderStatus;
    default:
      return null;
  }
}

function makeTaskFromOrder(order: Order, current?: DeliveryTask): DeliveryTask | null {
  const status = taskStatusForOrder(order);
  if (!status) return null;
  const shop = SHOP_BY_ID[order.shopId];
  const isWorkerOwned = status !== "AVAILABLE";
  const latitudeDelta = order.deliveryAddress.latitude - (shop?.latitude ?? 12.9716);
  const longitudeDelta = order.deliveryAddress.longitude - (shop?.longitude ?? 77.5946);

  return {
    id: current?.id ?? `task-${order.id}`,
    orderId: order.id,
    shopId: order.shopId,
    ...(current?.deliveryWorkerId
      ? { deliveryWorkerId: current.deliveryWorkerId }
      : isWorkerOwned
        ? { deliveryWorkerId: DEMO_WORKER_ID }
        : {}),
    pickupLocation: {
      latitude: shop?.latitude ?? 12.9716,
      longitude: shop?.longitude ?? 77.5946,
    },
    deliveryLocation: {
      latitude: order.deliveryAddress.latitude,
      longitude: order.deliveryAddress.longitude,
    },
    status,
    distance: current?.distance ?? Math.max(0.5, Math.hypot(latitudeDelta, longitudeDelta) * 111),
    deliveryFee: order.deliveryFee,
    ...(current?.failureReason ? { failureReason: current.failureReason } : {}),
    ...(current?.failureNotes ? { failureNotes: current.failureNotes } : {}),
    ...(current?.failureAt ? { failureAt: current.failureAt } : {}),
    createdAt: current?.createdAt ?? order.createdAt,
    updatedAt: current?.updatedAt ?? order.updatedAt,
  };
}

function syncTasksWithOrders(orders: Order[], tasks: DeliveryTask[]) {
  const byOrderId = new Map(tasks.map((task) => [task.orderId, task]));
  let changed = false;
  for (const order of orders) {
    if (byOrderId.has(order.id)) continue;
    const task = makeTaskFromOrder(order);
    if (task) {
      byOrderId.set(order.id, task);
      changed = true;
    }
  }
  return { tasks: [...byOrderId.values()], changed };
}

function persistState(orders: Order[], tasks: DeliveryTask[]) {
  const previousOrders = localStorage.getItem(ORDERS_STORAGE_KEY);
  const previousTasks = localStorage.getItem(DELIVERY_TASKS_STORAGE_KEY);
  try {
    localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(orders));
    localStorage.setItem(DELIVERY_TASKS_STORAGE_KEY, JSON.stringify(tasks));
  } catch {
    try {
      if (previousOrders === null) localStorage.removeItem(ORDERS_STORAGE_KEY);
      else localStorage.setItem(ORDERS_STORAGE_KEY, previousOrders);
      if (previousTasks === null) localStorage.removeItem(DELIVERY_TASKS_STORAGE_KEY);
      else localStorage.setItem(DELIVERY_TASKS_STORAGE_KEY, previousTasks);
    } catch {
      // Keep the original storage error as the visible task failure.
    }
    return false;
  }
  announceOrdersUpdated();
  window.dispatchEvent(new Event(DELIVERY_TASKS_UPDATED_EVENT));
  return true;
}

function refreshWorkerData(seedDemoOrders: boolean) {
  if (typeof window === "undefined") return;
  const storedOrders = readStoredArray<Order>(ORDERS_STORAGE_KEY);
  const knownOrderIds = new Set((storedOrders ?? []).map((order) => order.id));
  const nextOrders = storedOrders ? [...storedOrders] : [];
  const seedOrders = seedDemoOrders ? INITIAL_ORDERS : DEMO_DELIVERY_ORDERS;

  for (const demoOrder of seedOrders) {
    if (!knownOrderIds.has(demoOrder.id)) {
      nextOrders.push(demoOrder);
      knownOrderIds.add(demoOrder.id);
    }
  }

  const storedTasks = readStoredArray<DeliveryTask>(DELIVERY_TASKS_STORAGE_KEY);
  const nextTasks = storedTasks ? [...storedTasks] : [];
  const knownTaskOrders = new Set(nextTasks.map((task) => task.orderId));
  for (const demoTask of DEMO_DELIVERY_TASKS) {
    const order = nextOrders.find((item) => item.id === demoTask.orderId);
    const originalStatus = DEMO_DELIVERY_ORDERS.find(
      (item) => item.id === demoTask.orderId,
    )?.orderStatus;
    if (!knownTaskOrders.has(demoTask.orderId) && order?.orderStatus === originalStatus) {
      nextTasks.push(demoTask);
      knownTaskOrders.add(demoTask.orderId);
    }
  }

  const synced = syncTasksWithOrders(nextOrders, nextTasks);
  storeState = { orders: nextOrders, tasks: synced.tasks, loading: false, error: null };
  if (
    !storedOrders ||
    nextOrders.length !== storedOrders.length ||
    !storedTasks ||
    synced.changed
  ) {
    try {
      localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(nextOrders));
      localStorage.setItem(DELIVERY_TASKS_STORAGE_KEY, JSON.stringify(synced.tasks));
      if (!storedOrders || nextOrders.length !== storedOrders.length) announceOrdersUpdated();
    } catch {
      storeState = { ...storeState, error: "Some demo delivery data could not be saved." };
    }
  }
  notifyListeners();
}

function hydrateWorkerStore() {
  if (hasHydrated || typeof window === "undefined") return;
  hasHydrated = true;
  refreshWorkerData(true);
}

export function useWorkerStore() {
  const [state, setState] = useState(storeState);
  const auth = useWorkerAuth();
  const queryClient = useQueryClient();
  const firebaseEnabled = isFirebaseActive && isBrowser && !!auth.user;
  const workerId = auth.user?.workerId;
  const availableTasksQueryKey = useMemo(() => ["delivery-tasks", "available"] as const, []);
  const assignedTasksQueryKey = useMemo(
    () => ["delivery-tasks", "worker", workerId ?? ""] as const,
    [workerId],
  );
  const [availableTasksLiveError, setAvailableTasksLiveError] = useState<string | null>(null);
  const [assignedTasksLiveError, setAssignedTasksLiveError] = useState<string | null>(null);
  const availableTasks = useQuery({
    queryKey: availableTasksQueryKey,
    queryFn: async () => {
      const result = await deliveryRepository.listAvailable();
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
    enabled: firebaseEnabled,
  });
  const assignedTasks = useQuery({
    queryKey: assignedTasksQueryKey,
    queryFn: async () => {
      const result = await deliveryRepository.listForWorker(auth.user!.workerId);
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
    enabled: firebaseEnabled,
  });
  useEffect(() => {
    setAvailableTasksLiveError(null);
    setAssignedTasksLiveError(null);
    if (!firebaseEnabled || !workerId) return;
    const unsubscribeAvailable = deliveryRepository.subscribeAvailable(
      (tasks) => {
        setAvailableTasksLiveError(null);
        void queryClient.cancelQueries({ queryKey: availableTasksQueryKey, exact: true });
        queryClient.setQueryData(availableTasksQueryKey, tasks);
      },
      (error) => setAvailableTasksLiveError(error.message),
    );
    const unsubscribeAssigned = deliveryRepository.subscribeForWorker(
      workerId,
      (tasks) => {
        setAssignedTasksLiveError(null);
        void queryClient.cancelQueries({ queryKey: assignedTasksQueryKey, exact: true });
        queryClient.setQueryData(assignedTasksQueryKey, tasks);
      },
      (error) => setAssignedTasksLiveError(error.message),
    );
    return () => {
      unsubscribeAvailable();
      unsubscribeAssigned();
    };
  }, [assignedTasksQueryKey, availableTasksQueryKey, firebaseEnabled, queryClient, workerId]);
  const firebaseTasks = [
    ...(auth.user?.available ? (availableTasks.data ?? []) : []),
    ...(assignedTasks.data ?? []),
  ].filter((task, index, tasks) => tasks.findIndex((entry) => entry.id === task.id) === index);
  const taskIdsKey = firebaseTasks
    .map((task) => task.orderId)
    .sort()
    .join(",");
  const taskRevision = firebaseTasks
    .map((task) => `${task.id}:${task.status}:${task.updatedAt}`)
    .sort()
    .join("|");
  const firebaseOrdersQueryKey = useMemo(
    () => ["orders", "delivery-tasks", taskIdsKey] as const,
    [taskIdsKey],
  );
  const firebaseOrders = useQuery({
    queryKey: firebaseOrdersQueryKey,
    queryFn: async () => {
      const results = await Promise.all(
        firebaseTasks.map((task) => orderRepository.get(task.orderId)),
      );
      const failure = results.find((result) => !result.ok);
      if (failure && !failure.ok) throw new Error(failure.message);
      return results.flatMap((result) => (result.ok && result.data ? [result.data] : []));
    },
    enabled: firebaseEnabled && firebaseTasks.length > 0,
  });
  useEffect(() => {
    if (firebaseEnabled && firebaseTasks.length > 0) {
      void queryClient.invalidateQueries({ queryKey: ["orders", "delivery-tasks"] });
    }
  }, [firebaseEnabled, queryClient, taskRevision, firebaseTasks.length]);

  useEffect(() => {
    if (isFirebaseActive) return;
    const listener = (next: WorkerStoreState) => setState(next);
    listeners.add(listener);
    setState(storeState);
    hydrateWorkerStore();

    const onOrdersUpdated = () => refreshWorkerData(false);
    const onStorage = (event: StorageEvent) => {
      if (event.key === ORDERS_STORAGE_KEY || event.key === DELIVERY_TASKS_STORAGE_KEY) {
        refreshWorkerData(false);
      }
    };
    window.addEventListener(ORDERS_UPDATED_EVENT, onOrdersUpdated);
    window.addEventListener(DELIVERY_TASKS_UPDATED_EVENT, onOrdersUpdated);
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener(ORDERS_UPDATED_EVENT, onOrdersUpdated);
      window.removeEventListener(DELIVERY_TASKS_UPDATED_EVENT, onOrdersUpdated);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const transitionTask = useCallback(
    async (
      taskId: string,
      newStatus: DeliveryTaskStatus,
      workerId: string,
      failure?: { reason: string; notes: string },
    ): Promise<boolean> => {
      if (isFirebaseActive) {
        const task = firebaseTasks.find((entry) => entry.id === taskId);
        if (!task || workerId !== auth.user?.workerId) return false;
        if (task.status === "AVAILABLE" && newStatus === "DELIVERY_ASSIGNED") {
          const result = await deliveryRepository.claim(taskId, workerId);
          if (!result.ok) throw new Error(result.message);
        } else {
          const result = await deliveryRepository.advance(
            task,
            newStatus,
            newStatus === "DELIVERY_FAILED" && failure
              ? {
                  failureReason: failure.reason,
                  failureNotes: failure.notes,
                  failedAt: new Date().toISOString(),
                }
              : {},
          );
          if (!result.ok) throw new Error(result.message);
        }
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["delivery-tasks"] }),
          queryClient.invalidateQueries({ queryKey: ["orders"] }),
        ]);
        return true;
      }
      const task = storeState.tasks.find((item) => item.id === taskId);
      const order = task && storeState.orders.find((item) => item.id === task.orderId);
      if (!task || !order || !ALLOWED_TASK_TRANSITIONS[task.status]?.includes(newStatus))
        return false;
      if (workerId !== DEMO_WORKER_ID) return false;
      if (order.orderStatus !== STATUS_FROM_TASK[task.status]) return false;
      if (task.status === "AVAILABLE") {
        if (
          !auth.user?.available ||
          task.deliveryWorkerId ||
          order.orderStatus !== "READY_FOR_PICKUP"
        )
          return false;
      } else if (task.deliveryWorkerId !== workerId) {
        return false;
      }
      if (newStatus === "DELIVERY_FAILED" && !failure?.reason.trim()) return false;

      const now = new Date().toISOString();
      const nextStatus = STATUS_FROM_TASK[newStatus];
      if (!nextStatus) return false;
      const failureUpdates =
        newStatus === "DELIVERY_FAILED" && failure
          ? {
              failureReason: failure.reason.trim(),
              ...(failure.notes.trim() ? { failureNotes: failure.notes.trim() } : {}),
              failureAt: now,
            }
          : {};
      const nextTasks = storeState.tasks.map((item) =>
        item.id === taskId
          ? {
              ...item,
              status: newStatus,
              ...(newStatus === "DELIVERY_ASSIGNED" ? { deliveryWorkerId: workerId } : {}),
              ...failureUpdates,
              updatedAt: now,
            }
          : item,
      );
      const nextOrders = storeState.orders.map((item) =>
        item.id === order.id
          ? {
              ...item,
              orderStatus: nextStatus,
              statusHistory: [...item.statusHistory, { status: nextStatus, at: now }],
              updatedAt: now,
            }
          : item,
      );
      if (!persistState(nextOrders, nextTasks)) {
        storeState = {
          ...storeState,
          error: "Unable to save delivery changes in this browser.",
        };
        notifyListeners();
        return false;
      }
      storeState = { orders: nextOrders, tasks: nextTasks, loading: false, error: null };
      notifyListeners();
      return true;
    },
    [auth.user?.available, auth.user?.workerId, firebaseTasks, queryClient],
  );

  if (isFirebaseActive) {
    return {
      orders: firebaseOrders.data ?? [],
      tasks: firebaseTasks,
      loading:
        !auth.user ||
        availableTasks.isPending ||
        assignedTasks.isPending ||
        (firebaseTasks.length > 0 && firebaseOrders.isPending),
      error:
        availableTasks.error?.message ??
        availableTasksLiveError ??
        assignedTasks.error?.message ??
        assignedTasksLiveError ??
        firebaseOrders.error?.message ??
        null,
      transitionTask,
    };
  }
  return {
    ...state,
    tasks: state.tasks.filter((task) => task.status !== "AVAILABLE" || auth.user?.available),
    transitionTask,
  };
}
