import { ShopNotFound } from "@/features/storefront/components/shop-not-found";

/** A shop address with no shop behind it (the store layout calls notFound()). Next sends status 404. */
export default function UnknownShop() {
  return <ShopNotFound />;
}
