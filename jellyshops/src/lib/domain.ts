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
}

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
}

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
