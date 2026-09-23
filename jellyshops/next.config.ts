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
