import { Fraunces, Inter } from "next/font/google";

/** Self-hosted storefront fonts. Theme settings refer to them by family name; see `fontStack` in @jelly/storefront-themes. */
export const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", display: "swap" });
export const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const storefrontFontVariables = `${fraunces.variable} ${inter.variable}`;
