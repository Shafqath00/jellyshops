import type { Metadata } from "next";
import { ContinueSignIn } from "@/features/auth/continue-sign-in";

export const metadata: Metadata = { title: "Opening your dashboard", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default function ContinueSignInPage() {
  return <ContinueSignIn />;
}
