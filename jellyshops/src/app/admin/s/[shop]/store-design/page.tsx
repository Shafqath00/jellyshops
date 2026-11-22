import { redirect } from "next/navigation";
import { toShopAdmin } from "@/features/admin/admin-paths";

export default async function StoreDesignPage({ params }: { params: Promise<{ shop: string }> }) {
  const { shop } = await params;
  redirect(toShopAdmin(decodeURIComponent(shop), "/admin/online-store/editor"));
}
