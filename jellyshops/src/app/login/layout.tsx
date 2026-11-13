import { AuthProvider } from "@/features/auth/providers/auth-provider";

/** Merchant sign-in is only provided where it is used, so store pages never download it. */
export default function Layout({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
