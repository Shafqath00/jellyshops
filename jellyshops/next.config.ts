import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.JELLY_E2E_NEXT_DIST_DIR ?? ".next",
  transpilePackages: [
    "@jelly/storefront-schema",
    "@jelly/storefront-registry",
    "@jelly/storefront-themes",
    "@jelly/storefront-ui",
    "@jelly/storefront-renderer"
  ],
  allowedDevOrigins: ["127.0.0.1"],
  // Admin pages that moved in the 2026-11 navigation regroup keep working from old links.
  async redirects() {
    return [
      { source: "/admin/products/stock", destination: "/admin/products/inventory", permanent: true },
      { source: "/admin/online-store/navigation", destination: "/admin/content/menus", permanent: true },
      { source: "/admin/engagement", destination: "/admin/customers/messages", permanent: true },
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
