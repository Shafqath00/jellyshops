import type { Metadata } from "next";
import { ShopProvider } from "@/contexts/shop-context";
import "./globals.css";

export const metadata: Metadata = {
  title: "Jelly Shop",
  description:
    "A simple storefront and merchant workspace for small businesses.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
    >
      <body>
        <ShopProvider>
          {children}
        </ShopProvider>
      </body>
    </html>
  );
}