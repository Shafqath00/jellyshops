import type { Metadata } from "next";
import { MerchantResetPasswordForm } from "@/features/auth/components/reset-password-form";

export const metadata: Metadata = { title: "Reset your password", robots: { index: false, follow: false } };

export default function ResetPasswordPage() {
  return <MerchantResetPasswordForm />;
}
