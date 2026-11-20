/**
 * Security headers for the web app, used by `next.config.ts`.
 *
 * Every page gets the basic headers. Checkout and order pages, where Stripe's
 * Payment Element runs, also get a Content Security Policy that allows scripts
 * and frames from Stripe only. Next.js needs inline scripts for hydration, so
 * the policy allows 'unsafe-inline' scripts (see Next's CSP guide, "Without Nonces").
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

export function checkoutContentSecurityPolicy(options: SecurityHeaderOptions): string {
  const api = origin(options.apiUrl);
  const supabase = origin(options.supabaseUrl);
  const dev = !options.production;
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", "'unsafe-inline'", ...(dev ? ["'unsafe-eval'"] : []), ...STRIPE_SCRIPTS],
    "style-src": ["'self'", "'unsafe-inline'"],
    // Product photos may come from the media API, Supabase storage or another https host.
    "img-src": ["'self'", "data:", "blob:", "https:", ...(dev && api ? [api] : [])],
    "font-src": ["'self'", "data:"],
    "connect-src": [
      "'self'",
      ...(api ? [api] : []),
      ...(supabase ? [supabase] : []),
      ...STRIPE_CONNECT,
      // Stripe.js fetches the font stylesheet for its card form (STRIPE_FONTS in checkout-tokens.ts) from here.
      "https://fonts.googleapis.com",
      ...(dev ? ["ws:", "http://localhost:*", "http://127.0.0.1:*"] : []),
    ],
    "frame-src": STRIPE_FRAMES,
    "frame-ancestors": ["'self'"],
    "form-action": ["'self'"],
    "base-uri": ["'self'"],
    "object-src": ["'none'"],
  };
  const policy = Object.entries(directives).map(([name, values]) => `${name} ${[...new Set(values)].join(" ")}`);
  if (!dev) policy.push("upgrade-insecure-requests");
  return policy.join("; ");
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
  const csp = [{ key: "Content-Security-Policy", value: checkoutContentSecurityPolicy(options) }];
  return [
    { source: "/:path*", headers: base },
    { source: "/:storeSlug/checkout", headers: csp },
    { source: "/:storeSlug/order/:path*", headers: csp },
  ];
}
