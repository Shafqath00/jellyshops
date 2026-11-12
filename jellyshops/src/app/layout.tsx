import type { Metadata } from "next";
import { ShopProvider } from "@/contexts/shop-context";
import { AuthProvider } from "@/features/auth/providers/auth-provider";
import { storefrontFontVariables } from "./fonts";
import "./globals.css";
import "./themes/section-defaults.css";
import "./themes/storefront-base.css";
import "./themes/platform-base.css";
import "./themes/theme-kit.css";
import "./themes/jelly-minimal.css";
import "./themes/jelly-avenue.css";
import "./themes/jelly-resthaven.css";
import "./themes/jelly-forma.css";
import "./themes/jelly-halo.css";
import "./themes/jelly-diode.css";
import "./themes/theme-kit-late.css";
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
