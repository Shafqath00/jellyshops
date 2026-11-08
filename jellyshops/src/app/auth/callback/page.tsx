import type { Metadata } from "next";
import { MerchantAuthCallback } from "@/features/auth/merchant-auth-callback";

export const metadata: Metadata = { title: "Confirming your account", robots: { index: false, follow: false } };
export default async function CallbackPage({ searchParams }: { searchParams: Promise<{ code?: string; next?: string }> }) {
  const { code = "", next = "/admin" } = await searchParams;
  return <MerchantAuthCallback code={code} nextPath={next} />;
}
