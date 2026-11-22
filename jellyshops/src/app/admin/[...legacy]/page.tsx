import { notFound } from "next/navigation";
import { SHOP_ADMIN_SECTIONS } from "@/features/admin/admin-paths";
import { OpenLastShop } from "@/features/admin/shop-admin-gate";

/**
 * Old admin addresses without a shop (`/admin/orders/123` from a bookmark or an email): open the same page in the
 * shop the merchant last used. Anything that was never an admin page is a plain 404.
 */
export default async function LegacyAdminPage({ params }: { params: Promise<{ legacy: string[] }> }) {
  const { legacy } = await params;
  if (!SHOP_ADMIN_SECTIONS.has(legacy[0] ?? "")) notFound();
  return <OpenLastShop path={`/admin/${legacy.map(encodeURIComponent).join("/")}`} />;
}
