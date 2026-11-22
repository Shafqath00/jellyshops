import type { NextConfig } from "next";
import { securityHeaderRules } from "./src/lib/security-headers";

const nextConfig: NextConfig = {
  distDir: process.env.JELLY_E2E_NEXT_DIST_DIR ?? ".next",
  transpilePackages: [
    "@jelly/storefront-schema",
    "@jelly/storefront-registry",
    "@jelly/storefront-themes",
    "@jelly/storefront-ui",
    "@jelly/storefront-renderer"
  ],
  // *.localhost: shop subdomains in development (myshop.localhost:3000, admin.localhost:3000).
  allowedDevOrigins: ["127.0.0.1", "*.localhost"],
  // HSTS, frame and sniffing protection everywhere; a Stripe-only Content Security Policy on checkout and order pages.
  async headers() {
    return securityHeaderRules({
      production: process.env.NODE_ENV === "production",
      apiUrl: process.env.NEXT_PUBLIC_STORE_EDITOR_API_URL,
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    });
  },
  // Admin pages that moved in the 2026-11 navigation regroup keep working from old links.
  async redirects() {
    return [
      { source: "/admin/products/stock", destination: "/admin/products/inventory", permanent: true },
      { source: "/admin/online-store/navigation", destination: "/admin/content/menus", permanent: true },
      { source: "/admin/engagement", destination: "/admin/customers/messages", permanent: true },
      { source: "/admin/store", destination: "/admin/online-store/preferences", permanent: true },
      { source: "/admin/settings/store-access", destination: "/admin/online-store/preferences", permanent: true },
      { source: "/admin/products/builder", destination: "/admin/products/new", permanent: true },
      { source: "/admin/products/builder/:id", destination: "/admin/products/:id", permanent: true },
    ];
  },
  turbopack: {
    root: process.cwd()
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "plus.unsplash.com" }
    ]
  }
};

export default nextConfig;
