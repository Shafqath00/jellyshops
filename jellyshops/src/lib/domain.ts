export type Currency = "INR" | "USD";
export type OrderStatus = "PENDING" | "CONFIRMED" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED";
export type PaymentStatus = "PENDING" | "PAID" | "FAILED" | "REFUNDED";

export interface StoreTheme {
  accent: string;
  accentSoft: string;
  background: string;
  surface: string;
  text: string;
  displayFont: "serif" | "rounded";
}

export interface Store {
  id: string;
  businessId: string;
  name: string;
  slug: string;
  tagline: string;
  description: string;
  currency: Currency;
  published: boolean;
  logoUrl?: string;
  bannerUrl: string;
  shippingMinor: number;
  theme: StoreTheme;
}

import type { StoreDesignDocument } from "@jelly/storefront-schema";

export interface StoreDesignPublication {
  id: string;
  revision: number;
  document: StoreDesignDocument;
  publishedAt: string;
}

export interface StoreDesignRecord {
  storeId: string;
  draftDocument: StoreDesignDocument;
  draftRevision: number;
  currentPublicationId?: string;
  publications: StoreDesignPublication[];
}

export interface ProductVariant {
  id: string;
  name: string;
  sku: string;
  priceMinor: number;
  stock: number;
  options?: Record<string, string>;
}

export type ProductOptionKind = "variant" | "configuration" | "addon";
export type ProductOptionDisplay = "buttons" | "dropdown" | "color" | "image";

export interface ProductOptionValue {
  id: string;
  label: string;
  priceAdjustmentMinor: number;
  color?: string;
  image?: string;
  isDefault?: boolean;
  position: number;
}

export interface ProductOption {
  id: string;
  name: string;
  type: ProductOptionKind;
  display: ProductOptionDisplay;
  required: boolean;
  position: number;
  values: ProductOptionValue[];
}

export interface Category {
  id: string;
  storeId: string;
  name: string;
  slug: string;
  parentId?: string;
}

export interface Brand { id: string; storeId: string; name: string; slug?: string; logo?: string; }
export interface Collection { id: string; storeId: string; name: string; slug: string; }
export interface CategoryOptionDefinition {
  id: string;
  storeId: string;
  categoryId: string;
  name: string;
  optionKind: ProductOptionKind;
  displayType: ProductOptionDisplay;
  required: boolean;
  position: number;
}

export interface Product {
  id: string;
  storeId: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  imageUrl: string;
  published: boolean;
  archived: boolean;
  featured: boolean;
  variants: ProductVariant[];
  brandId?: string;
  primaryCategoryId?: string;
  additionalCategoryIds?: string[];
  collectionIds?: string[];
  options?: ProductOption[];
  inventoryOptionIds?: string[];
  compareAtPriceMinor?: number;
}

export interface CustomerAddress {
  line1: string;
  line2?: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
}

export interface CustomerInput {
  name: string;
  email: string;
  phone: string;
  address: CustomerAddress;
}

export interface Customer extends CustomerInput {
  id: string;
  storeId: string;
  createdAt: string;
}

export interface CartItem {
  variantId: string;
  quantity: number;
  configurationSelections?: ConfiguredOptionSelection[];
  unitPriceMinor?: number;
}

export interface ConfiguredOptionSelection { optionId: string; valueId: string; }

export interface Cart {
  id: string;
  storeId: string;
  items: CartItem[];
  createdAt: string;
}

export interface OrderItem {
  productId: string;
  variantId: string;
  productName: string;
  variantName: string;
  sku: string;
  imageUrl: string;
  unitPriceMinor: number;
  quantity: number;
  configurationSelections?: OrderConfigurationSelection[];
}

export interface OrderConfigurationSelection { optionId: string; valueId: string; optionName: string; valueLabel: string; priceAdjustmentMinor: number; }

export interface Order {
  id: string;
  number: string;
  storeId: string;
  customerId: string;
  customerSnapshot: CustomerInput;
  items: OrderItem[];
  subtotalMinor: number;
  shippingMinor: number;
  totalMinor: number;
  currency: Currency;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentId: string;
  inventoryRestored: boolean;
  createdAt: string;
}

export interface ShopState {
  version: number;
  activeStoreId: string;
  stores: Store[];
  products: Product[];
  categories: Category[];
  brands: Brand[];
  collections: Collection[];
  categoryOptionDefinitions: CategoryOptionDefinition[];
  recentCategoryIdsByStore?: Record<string, string[]>;
  customers: Customer[];
  carts: Cart[];
  orders: Order[];
  storeDesigns: StoreDesignRecord[];
}

const allowedTransitions: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: []
};

export function canTransitionOrder(from: OrderStatus, to: OrderStatus): boolean {
  return allowedTransitions[from].includes(to);
}

export function nextOrderStatus(status: OrderStatus): OrderStatus | undefined {
  return allowedTransitions[status].find((next) => next !== "CANCELLED");
}

export function formatMoney(minor: number, currency: Currency): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(minor / 100);
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function majorToMinor(value: string | number): number {
  const text = String(value).trim();
  if (!/^-?\d+(?:\.\d{0,2})?$/.test(text)) return Number.NaN;
  const sign = text.startsWith("-") ? -1 : 1;
  const unsigned = text.replace(/^-/, "");
  const [whole, fraction = ""] = unsigned.split(".");
  return sign * (Number(whole) * 100 + Number(fraction.padEnd(2, "0")));
}

export function minorToMajor(minor: number): string {
  if (!Number.isFinite(minor)) return "0.00";
  return (minor / 100).toFixed(2);
}

export function getCategoryAncestors(categoryId: string, categories: Category[]): Category[] {
  const byId = new Map(categories.map((category) => [category.id, category]));
  const result: Category[] = [];
  const visited = new Set<string>();
  let current = byId.get(categoryId);
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    result.unshift(current);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return result;
}

export function getCategoryBreadcrumb(categoryId: string, categories: Category[], separator = " › "): string {
  return getCategoryAncestors(categoryId, categories).map((category) => category.name).join(separator);
}

export function getCategoryChildren(categoryId: string | undefined, categories: Category[]): Category[] {
  return categories.filter((category) => (category.parentId ?? undefined) === categoryId);
}

export function getEffectiveCategoryOptionDefinitions(categoryId: string, categories: Category[], definitions: CategoryOptionDefinition[]): CategoryOptionDefinition[] {
  const ancestry = getCategoryAncestors(categoryId, categories);
  const byName = new Map<string, CategoryOptionDefinition>();
  ancestry.forEach((category) => {
    definitions.filter((definition) => definition.categoryId === category.id).forEach((definition) => {
      byName.set(definition.name.trim().toLowerCase(), definition);
    });
  });
  return [...byName.values()].sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));
}
