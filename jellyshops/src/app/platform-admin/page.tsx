import type { Metadata } from "next";
import { PlatformConsole } from "@/features/platform/platform-console";

/** platform.jellyshop.io (the proxy rewrites that host here and refuses /platform-admin when typed elsewhere). */
export const metadata: Metadata = { title: "Jellyshop platform", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default function PlatformAdminPage() {
  return <PlatformConsole />;
}
