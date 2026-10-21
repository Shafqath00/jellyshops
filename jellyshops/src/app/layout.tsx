import type { Metadata } from "next";
import { ShopProvider } from "@/contexts/shop-context";
import { AuthProvider } from "@/features/auth/auth-provider";
import { storefrontFontVariables } from "./fonts";
import "./globals.css";
import "./themes/jelly-minimal.css";
import "./shadcn-theme.css";

export const metadata: Metadata = {
  title: "Jelly Shop",
  description:
    "A simple storefront and merchant workspace for small businesses.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth" className={storefrontFontVariables}>
      <body>
        <AuthProvider>
          <ShopProvider>{children}</ShopProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
