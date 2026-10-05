import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Product } from "./types";
import { STANDARD_DELIVERY_FEE } from "./types";

export interface CartLine {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  stock: number;
  unit?: string | undefined;
  shopId: string;
}

interface CartState {
  shopId: string | null;
  shopName: string | null;
  lines: CartLine[];
}

const EMPTY: CartState = { shopId: null, shopName: null, lines: [] };
const STORAGE_KEY = "shopri8.cart.v1";

export const DELIVERY_FEE = STANDARD_DELIVERY_FEE;

interface CartContextValue extends CartState {
  itemCount: number;
  subtotal: number;
  deliveryFee: number;
  total: number;
  /** Returns "added" or "other-shop" when the item belongs to a different shop. */
  add: (product: Product, shopName: string, quantity?: number) => "added" | "other-shop";
  forceAdd: (product: Product, shopName: string, quantity?: number) => void;
  setQuantity: (productId: string, quantity: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CartState>(EMPTY);

  // Restore after hydration only — localStorage is not available during SSR.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setState(JSON.parse(raw) as CartState);
    } catch {
      /* ignore malformed cart */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* storage unavailable */
    }
  }, [state]);

  const putLine = useCallback((product: Product, shopName: string, quantity: number) => {
    setState((prev) => {
      const base: CartState =
        prev.shopId === product.shopId ? prev : { shopId: product.shopId, shopName, lines: [] };
      const existing = base.lines.find((l) => l.productId === product.id);
      const nextQty = Math.min((existing?.quantity ?? 0) + quantity, product.stock);
      const lines = existing
        ? base.lines.map((l) => (l.productId === product.id ? { ...l, quantity: nextQty } : l))
        : [
            ...base.lines,
            {
              productId: product.id,
              name: product.name,
              price: product.price,
              quantity: Math.min(quantity, product.stock),
              stock: product.stock,
              unit: product.unit,
              shopId: product.shopId,
            },
          ];
      return { shopId: product.shopId, shopName, lines };
    });
  }, []);

  const add = useCallback<CartContextValue["add"]>(
    (product, shopName, quantity = 1) => {
      if (state.shopId && state.shopId !== product.shopId && state.lines.length > 0) {
        return "other-shop";
      }
      putLine(product, shopName, quantity);
      return "added";
    },
    [state.shopId, state.lines.length, putLine],
  );

  const forceAdd = useCallback<CartContextValue["forceAdd"]>(
    (product, shopName, quantity = 1) => {
      setState({ shopId: product.shopId, shopName, lines: [] });
      putLine(product, shopName, quantity);
    },
    [putLine],
  );

  const setQuantity = useCallback((productId: string, quantity: number) => {
    setState((prev) => {
      const lines = prev.lines
        .map((l) =>
          l.productId === productId
            ? { ...l, quantity: Math.max(0, Math.min(quantity, l.stock)) }
            : l,
        )
        .filter((l) => l.quantity > 0);
      return lines.length ? { ...prev, lines } : EMPTY;
    });
  }, []);

  const remove = useCallback((productId: string) => {
    setState((prev) => {
      const lines = prev.lines.filter((l) => l.productId !== productId);
      return lines.length ? { ...prev, lines } : EMPTY;
    });
  }, []);

  const clear = useCallback(() => setState(EMPTY), []);

  const value = useMemo<CartContextValue>(() => {
    const subtotal = state.lines.reduce((sum, l) => sum + l.price * l.quantity, 0);
    const itemCount = state.lines.reduce((sum, l) => sum + l.quantity, 0);
    const deliveryFee = itemCount > 0 ? DELIVERY_FEE : 0;
    return {
      ...state,
      itemCount,
      subtotal,
      deliveryFee,
      total: subtotal + deliveryFee,
      add,
      forceAdd,
      setQuantity,
      remove,
      clear,
    };
  }, [state, add, forceAdd, setQuantity, remove, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
