import type { Metadata } from "next";
import Script from "next/script";
import { ShopProvider } from "@/contexts/shop-context";
import { storefrontFontVariables } from "./fonts";
import { HOME_THEME_SCRIPT } from "@/features/brand/theme";
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
  title: "Jellyshop",
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
    // suppressHydrationWarning: the home-theme script below sets data-home-theme on <html> before React loads.
    <html lang="en" data-scroll-behavior="smooth" className={storefrontFontVariables} suppressHydrationWarning>
      <body>
        {/* Brand pages' light/dark theme (saved choice, else the system), applied before paint and kept in step
            with system changes. Only pages with [data-brand] read it (features/brand/theme.ts). */}
        <Script id="home-theme" strategy="beforeInteractive">
          {HOME_THEME_SCRIPT}
        </Script>
        <ShopProvider>{children}</ShopProvider>
      </body>
    </html>
  );
}
