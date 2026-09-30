import {
  Carrot,
  Croissant,
  Fish,
  Flower2,
  Hammer,
  Home,
  PenLine,
  Pill,
  Shirt,
  ShoppingBasket,
  Smartphone,
  Store,
  type LucideIcon,
} from "lucide-react";
import type { CategoryId } from "@/lib/types";

const ICONS: Record<CategoryId, LucideIcon> = {
  grocery: ShoppingBasket,
  "fruits-vegetables": Carrot,
  flowers: Flower2,
  pharmacy: Pill,
  bakery: Croissant,
  stationery: PenLine,
  hardware: Hammer,
  fashion: Shirt,
  electronics: Smartphone,
  household: Home,
  "meat-fish": Fish,
  other: Store,
};

export function CategoryIcon({ id, className }: { id: CategoryId; className?: string }) {
  const Icon = ICONS[id] ?? Store;
  return <Icon className={className} strokeWidth={1.6} />;
}
