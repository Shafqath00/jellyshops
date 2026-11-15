import type { Metadata } from "next";
import { MerchantAuthCallback } from "@/features/auth/merchant-auth-callback";

export const metadata: Metadata = { title: "Confirming your account", robots: { index: false, follow: false } };
export default async function CallbackPage({ searchParams }: {
  searchParams: Promise<{ code?: string | string[]; next?: string | string[]; flow?: string | string[]; error?: string | string[] }>;
}) {
  const { code, next, flow, error } = await searchParams;
  return <MerchantAuthCallback
    code={typeof code === "string" ? code : ""}
    nextPath={typeof next === "string" ? next : "/admin"}
    recovery={flow === "recovery"}
    providerError={typeof error === "string" ? error : undefined}
  />;
}
