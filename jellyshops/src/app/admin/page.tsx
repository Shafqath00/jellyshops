import { OpenLastShop } from "@/features/admin/shop-admin-gate";

/** `/admin` without a shop: open the shop the merchant last used. */
export default function AdminStartPage() {
  return <OpenLastShop path="/admin" />;
}
