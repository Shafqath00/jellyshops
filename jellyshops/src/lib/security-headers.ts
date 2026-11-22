/**
 * Security headers for the web app.
 *
 * `next.config.ts` sends the basic headers on every response (`securityHeaderRules`). Each page also gets a Content
 * Security Policy from `src/proxy.ts`, chosen by what the page is (`contentSecurityPolicy(kind)`): the proxy knows
 * whether a request is a shop, its checkout, the merchant admin, the platform admin or the marketing site, whatever
 * the address looks like (shop subdomains, /<slug>, /_shop/<slug>).
 *
 * Every policy allows scripts from this site only (plus Stripe on checkout and order pages). Next.js needs inline
 * scripts for hydration, so the policies allow 'unsafe-inline' scripts (Next's CSP guide, "Without Nonces"): store pages
 * are cached and shared, so a per-request nonce isn't possible there. Frames are limited to the embeds shops can add
 * (app blocks and videos). Design: docs/plans/2026-11-22-subdomain-tenancy-plan.md §8.
 */
export interface SecurityHeaderOptions {
  production: boolean;
  /** The backend API address (NEXT_PUBLIC_STORE_EDITOR_API_URL). */
  apiUrl?: string;
  /** The Supabase address, for the optional shopper sign-in. */
  supabaseUrl?: string;
}

export interface HeaderRule {
  source: string;
  headers: Array<{ key: string; value: string }>;
}

function origin(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).origin;
  } catch {
    return undefined;
  }
}

// Stripe's published CSP list for Stripe.js and the Payment Element.
const STRIPE_SCRIPTS = ["https://js.stripe.com", "https://*.js.stripe.com"];
const STRIPE_FRAMES = ["https://js.stripe.com", "https://*.js.stripe.com", "https://hooks.stripe.com"];
const STRIPE_CONNECT = ["https://api.stripe.com"];

/** Sites shops may embed: app blocks (storefront-schema `app-blocks.ts`) and videos (renderer `block-content.tsx`). */
export const EMBED_FRAMES = [
  "https://www.google.com", "https://calendly.com", "https://*.typeform.com", "https://docs.google.com", "https://open.spotify.com",
  "https://w.soundcloud.com", "https://airtable.com", "https://www.youtube-nocookie.com", "https://player.vimeo.com",
];

/** What a page is, for its policy. */
export type PageKind = "shop" | "checkout" | "admin" | "platform" | "marketing";

export function contentSecurityPolicy(kind: PageKind, options: SecurityHeaderOptions): string {
  const api = origin(options.apiUrl);
  const supabase = origin(options.supabaseUrl);
  const dev = !options.production;
  const stripe = kind === "checkout";
  const frames: Record<PageKind, string[]> = {
    checkout: STRIPE_FRAMES,
    // The theme editor and the theme previews draw pages in frames of this site.
    admin: ["'self'", ...EMBED_FRAMES],
    marketing: ["'self'", ...EMBED_FRAMES],
    shop: ["'self'", ...EMBED_FRAMES],
    platform: ["'none'"],
  };
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", "'unsafe-inline'", ...(dev ? ["'unsafe-eval'"] : []), ...(stripe ? STRIPE_SCRIPTS : [])],
    "style-src": ["'self'", "'unsafe-inline'"],
    // Product photos may come from the media API, Supabase storage or another https host.
    "img-src": ["'self'", "data:", "blob:", "https:", ...(dev && api ? [api] : [])],
    "media-src": ["'self'", "blob:", "https:", ...(dev && api ? [api] : [])],
    "font-src": ["'self'", "data:"],
    "connect-src": [
      "'self'",
      ...(api ? [api] : []),
      ...(supabase ? [supabase] : []),
      ...(stripe ? [...STRIPE_CONNECT, "https://fonts.googleapis.com"] : []),
      ...(dev ? ["ws:", "http://localhost:*", "http://127.0.0.1:*", "http://*.localhost:*"] : []),
    ],
    "frame-src": frames[kind],
    // Nobody frames the platform admin; the rest only by this site (the editor previews).
    "frame-ancestors": [kind === "platform" ? "'none'" : "'self'"],
    "form-action": ["'self'"],
    "base-uri": ["'self'"],
    "object-src": ["'none'"],
  };
  const policy = Object.entries(directives).map(([name, values]) => `${name} ${[...new Set(values)].join(" ")}`);
  if (!dev) policy.push("upgrade-insecure-requests");
  return policy.join("; ");
}

/** The checkout and order pages' policy (Stripe's Payment Element). */
export function checkoutContentSecurityPolicy(options: SecurityHeaderOptions): string {
  return contentSecurityPolicy("checkout", options);
}

/** Options from this deployment's settings, for the proxy. */
export function securityHeaderOptionsFromEnv(): SecurityHeaderOptions {
  return {
    production: process.env.NODE_ENV === "production",
    apiUrl: process.env.NEXT_PUBLIC_STORE_EDITOR_API_URL,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  };
}

export function securityHeaderRules(options: SecurityHeaderOptions): HeaderRule[] {
  const base = [
    { key: "X-Content-Type-Options", value: "nosniff" },
    // The theme editor previews pages of this site in a frame, so same-origin framing stays allowed.
    { key: "X-Frame-Options", value: "SAMEORIGIN" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: 'camera=(), microphone=(), geolocation=(), payment=(self "https://js.stripe.com")' },
    ...(options.production ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }] : []),
  ];
  // Content Security Policies are set per page by src/proxy.ts (contentSecurityPolicy).
  return [{ source: "/:path*", headers: base }];
}
