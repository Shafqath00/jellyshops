import { ShopAdminGate } from "@/features/admin/shop-admin-gate";

/** Admin pages for one shop: the shop comes from the address (see features/admin/admin-routing.tsx). */
export default function ShopAdminLayout({ children }: { children: React.ReactNode }) {
  return <ShopAdminGate>{children}</ShopAdminGate>;
}
