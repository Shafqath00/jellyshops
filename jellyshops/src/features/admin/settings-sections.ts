import { Bell, Braces, CreditCard, KeyRound, Lock, Store, Truck, type LucideIcon } from "lucide-react";

export type SettingsLink = { label: string; href: string; description: string; icon: LucideIcon };
export type SettingsGroup = { label: string; items: SettingsLink[] };

/** Settings pages, grouped the way the settings index and its side list show them. */
export const SETTINGS_GROUPS: SettingsGroup[] = [
  { label: "Store", items: [
    { label: "General", href: "/admin/settings/general", description: "Store name, contact email, store address and time zone.", icon: Store },
    { label: "Password page", href: "/admin/online-store/preferences", description: "Keep your store private while you get it ready.", icon: Lock },
  ] },
  { label: "Selling", items: [
    { label: "Payments", href: "/admin/payments", description: "How customers pay you and when you get paid.", icon: CreditCard },
    { label: "Shipping and delivery", href: "/admin/settings/shipping", description: "What customers pay for delivery and what they read about it.", icon: Truck },
  ] },
  { label: "Customers", items: [
    { label: "Notifications", href: "/admin/settings/notifications", description: "The emails customers get about their orders.", icon: Bell },
  ] },
  { label: "Store data", items: [
    { label: "Extra fields", href: "/admin/settings/custom-data", description: "Add your own fields to products, collections and pages.", icon: Braces },
    { label: "Developer access", href: "/admin/settings/developers", description: "Tokens that let a developer upload themes for this store.", icon: KeyRound },
  ] },
];
