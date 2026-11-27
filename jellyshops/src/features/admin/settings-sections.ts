import { Bell, Braces, CreditCard, KeyRound, ReceiptText, SlidersHorizontal, Store, Truck, UserRound, type LucideIcon } from "lucide-react";

export type SettingsLink = { label: string; href: string; description: string; icon: LucideIcon };
export type SettingsGroup = { label: string; items: SettingsLink[] };

/** Settings pages, grouped the way the settings index and its side list show them. */
export const SETTINGS_GROUPS: SettingsGroup[] = [
  { label: "Account", items: [
    { label: "Account profile", href: "/admin/settings/profile", description: "Your name, bio and private profile photo.", icon: UserRound },
  ] },
  { label: "Store", items: [
    { label: "General", href: "/admin/settings/general", description: "Store name, contact email, store address and time zone.", icon: Store },
    { label: "Site preferences", href: "/admin/settings/preferences", description: "Search listing, branding, policies, tracking and privacy.", icon: SlidersHorizontal },
    { label: "Plan and billing", href: "/admin/settings/billing", description: "Your plan, your free trial and how much of it this shop uses.", icon: ReceiptText },
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
