import type { Metadata } from "next";
import { geist, geistMono } from "@/features/brand/fonts";
import { Hero } from "./_home/hero";
import { MotionProvider, SmoothScroll } from "@/features/brand/motion";
import { Faq, FinalCta, Integrations, Pricing, SellEverywhere, SiteFooter, Stories, Trust } from "./_home/sections-bottom";
import { Bento, HowItWorks, ProofBand, Templates } from "./_home/sections-top";
import { SiteHeader } from "./_home/site-header";
import { navigation } from "./home-content";
import "@/features/brand/brand.css";
import styles from "./home.module.css";

const description = "Jelly Shop is the all-in-one platform for independent brands to design an online store, take payments and manage orders, with no code.";

export const metadata: Metadata = {
  title: "Jelly Shop | Launch your online store. Sell from day one.",
  description,
  openGraph: {
    title: "Jelly Shop | Launch your store. Sell from day one.",
    description,
    images: [{ url: "/assets/og-image.jpg", width: 1200, height: 630, alt: "Jelly Shop: launch your store, sell from day one" }],
    type: "website",
  },
  twitter: { card: "summary_large_image", images: ["/assets/og-image.jpg"] },
};


export default function HomePage() {
  return (
    <MotionProvider>
    <div data-brand className={`${styles.home} ${geist.variable} ${geistMono.variable}`}>
      <SmoothScroll />
      <a className={styles.skip} href="#main">Skip to content</a>
      <SiteHeader items={navigation} />
      <main id="main" tabIndex={-1}>
        <Hero />
        <ProofBand />
        <HowItWorks />
        <Bento />
        <Templates />
        <SellEverywhere />
        <Integrations />
        <Stories />
        <Pricing />
        <Trust />
        <Faq />
        <FinalCta />
      </main>
      <SiteFooter />
    </div>
    </MotionProvider>
  );
}
