import groceryImage from "@/assets/categories/grocery.webp";
import fruitsVegetablesImage from "@/assets/categories/fruits-vegetables.webp";
import flowersImage from "@/assets/categories/flowers.webp";
import pharmacyImage from "@/assets/categories/pharmacy.webp";
import bakeryImage from "@/assets/categories/bakery.webp";
import stationeryImage from "@/assets/categories/stationery.webp";
import hardwareImage from "@/assets/categories/hardware.webp";
import fashionImage from "@/assets/categories/fashion.webp";
import electronicsImage from "@/assets/categories/electronics.webp";
import householdImage from "@/assets/categories/household.webp";
import meatFishImage from "@/assets/categories/meat-fish.webp";
import otherImage from "@/assets/categories/other.webp";
import type { CategoryId } from "@/lib/types";

/**
 * The SHOPRi8 shared product-image catalogue.
 *
 * These are the existing local assets — no new image files and no duplicate
 * copies. Several entries deliberately point at the same asset, because a
 * catalogue image is shared: Rice, Wheat and Flour all reuse the grocery photo,
 * and every retailer referencing "Rice" references this one entry.
 */
export interface CatalogImage {
  id: string;
  name: string;
  category: CategoryId;
  ref: string;
  keywords: string;
}

export const PRODUCT_IMAGE_CATALOG: readonly CatalogImage[] = [
  {
    id: "rice",
    name: "Rice",
    category: "grocery",
    ref: groceryImage,
    keywords: "rice basmati grain cereal",
  },
  {
    id: "wheat",
    name: "Wheat",
    category: "grocery",
    ref: groceryImage,
    keywords: "wheat flour atta atta gehun",
  },
  {
    id: "flour",
    name: "Flour",
    category: "grocery",
    ref: groceryImage,
    keywords: "flour atta maida powder",
  },
  {
    id: "pulses",
    name: "Pulses & lentils",
    category: "grocery",
    ref: groceryImage,
    keywords: "dal pulses lentils beans",
  },
  {
    id: "milk",
    name: "Milk & dairy",
    category: "grocery",
    ref: groceryImage,
    keywords: "milk curd paneer butter dairy",
  },
  {
    id: "eggs",
    name: "Eggs",
    category: "grocery",
    ref: groceryImage,
    keywords: "egg eggs poultry",
  },
  {
    id: "cooking-oil",
    name: "Cooking oil",
    category: "grocery",
    ref: groceryImage,
    keywords: "oil cooking mustard groundnut ghee",
  },
  {
    id: "snacks",
    name: "Snacks & packaged",
    category: "grocery",
    ref: groceryImage,
    keywords: "snacks biscuits namkeen packaged",
  },
  {
    id: "fruits",
    name: "Fruits",
    category: "fruits-vegetables",
    ref: fruitsVegetablesImage,
    keywords: "fruit apple banana mango seasonal",
  },
  {
    id: "vegetables",
    name: "Vegetables",
    category: "fruits-vegetables",
    ref: fruitsVegetablesImage,
    keywords: "vegetable sabzi tomato onion leafy",
  },
  {
    id: "bread",
    name: "Bread",
    category: "bakery",
    ref: bakeryImage,
    keywords: "bread loaf toast baked",
  },
  {
    id: "bakery",
    name: "Bakery items",
    category: "bakery",
    ref: bakeryImage,
    keywords: "bakery cake pastry rusk bun",
  },
  {
    id: "flowers",
    name: "Flowers",
    category: "flowers",
    ref: flowersImage,
    keywords: "flowers rose bouquet gift",
  },
  {
    id: "pharmacy",
    name: "Pharmacy",
    category: "pharmacy",
    ref: pharmacyImage,
    keywords: "pharmacy medicine tablet prescription",
  },
  {
    id: "personal-care",
    name: "Personal care",
    category: "pharmacy",
    ref: pharmacyImage,
    keywords: "personal care soap shampoo skincare hygiene",
  },
  {
    id: "first-aid",
    name: "First aid",
    category: "pharmacy",
    ref: pharmacyImage,
    keywords: "first aid bandage antiseptic care",
  },
  {
    id: "stationery",
    name: "Stationery",
    category: "stationery",
    ref: stationeryImage,
    keywords: "stationery notebook pen pencil office",
  },
  {
    id: "hardware",
    name: "Hardware",
    category: "hardware",
    ref: hardwareImage,
    keywords: "hardware tools bolt screw repair",
  },
  {
    id: "household",
    name: "Household",
    category: "household",
    ref: householdImage,
    keywords: "household cleaning detergent utensil kitchen",
  },
  {
    id: "electronics",
    name: "Electronics",
    category: "electronics",
    ref: electronicsImage,
    keywords: "electronics mobile charger cable device",
  },
  {
    id: "meat-fish",
    name: "Meat & fish",
    category: "meat-fish",
    ref: meatFishImage,
    keywords: "meat fish chicken mutton seafood",
  },
  {
    id: "fashion",
    name: "Fashion",
    category: "fashion",
    ref: fashionImage,
    keywords: "fashion clothing apparel wear",
  },
  {
    id: "other",
    name: "Other",
    category: "other",
    ref: otherImage,
    keywords: "other misc general",
  },
];

export const CATALOG_IMAGE_BY_ID: Record<string, CatalogImage> = Object.fromEntries(
  PRODUCT_IMAGE_CATALOG.map((entry) => [entry.id, entry]),
);

/** Catalogue entries grouped by the category they suit best. */
export const CATALOG_CATEGORIES = Array.from(
  new Map(PRODUCT_IMAGE_CATALOG.map((entry) => [entry.category, entry.category])).values(),
);

export function searchCatalogImages(query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return PRODUCT_IMAGE_CATALOG;
  return PRODUCT_IMAGE_CATALOG.filter(
    (entry) => entry.name.toLowerCase().includes(q) || entry.keywords.toLowerCase().includes(q),
  );
}
