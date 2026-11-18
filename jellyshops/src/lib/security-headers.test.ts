import { describe, expect, it } from "vitest";
import { checkoutContentSecurityPolicy, securityHeaderRules } from "./security-headers";

describe("security headers", () => {
  const production = { production: true, apiUrl: "https://api.example.test/base", supabaseUrl: "https://abc.supabase.co" };

  it("allows Stripe and our own API on checkout, nothing else that runs code", () => {
    const csp = checkoutContentSecurityPolicy(production);
    expect(csp).toContain("script-src 'self' 'unsafe-inline' https://js.stripe.com https://*.js.stripe.com;");
    expect(csp).toContain("frame-src https://js.stripe.com https://*.js.stripe.com https://hooks.stripe.com;");
    expect(csp).toContain("connect-src 'self' https://api.example.test https://abc.supabase.co https://api.stripe.com;");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'self'");
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).toContain("upgrade-insecure-requests");
  });

  it("allows the dev server's needs only outside production", () => {
    const csp = checkoutContentSecurityPolicy({ production: false, apiUrl: "http://127.0.0.1:3001" });
    expect(csp).toContain("'unsafe-eval'");
    expect(csp).toContain("http://127.0.0.1:3001");
    expect(csp).not.toContain("upgrade-insecure-requests");
  });

  it("sends HSTS in production only, and the policy on checkout and order pages", () => {
    const rules = securityHeaderRules(production);
    const keys = (source: string) => rules.find((rule) => rule.source === source)!.headers.map((header) => header.key);
    expect(keys("/:path*")).toEqual(expect.arrayContaining(["Strict-Transport-Security", "X-Frame-Options", "X-Content-Type-Options", "Referrer-Policy"]));
    expect(keys("/:storeSlug/checkout")).toEqual(["Content-Security-Policy"]);
    expect(keys("/:storeSlug/order/:path*")).toEqual(["Content-Security-Policy"]);
    expect(securityHeaderRules({ production: false })[0]!.headers.map((header) => header.key)).not.toContain("Strict-Transport-Security");
  });
});
