import type { Metadata } from "next";
import Script from "next/script";
import { ShopProvider } from "@/contexts/shop-context";
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
    <html lang="en" data-scroll-behavior="smooth" className={storefrontFontVariables}>
      <body>
        {/* Home page light/dark choice, applied before paint so light mode doesn't flash dark. Only the home page reads it. */}
        <Script id="home-theme" strategy="beforeInteractive">
          {`try{if(localStorage.getItem("jellyshop-home-theme")==="light")document.documentElement.dataset.homeTheme="light"}catch(e){}`}
        </Script>
        <ShopProvider>{children}</ShopProvider>
      </body>
    </html>
  );
}
