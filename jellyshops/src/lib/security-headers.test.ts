import { describe, expect, it } from "vitest";
import { checkoutContentSecurityPolicy, contentSecurityPolicy, securityHeaderRules } from "./security-headers";

describe("security headers", () => {
  const production = { production: true, apiUrl: "https://api.example.test/base", supabaseUrl: "https://abc.supabase.co" };

  it("allows Stripe and our own API on checkout, nothing else that runs code", () => {
    const csp = checkoutContentSecurityPolicy(production);
    expect(csp).toContain("script-src 'self' 'unsafe-inline' https://js.stripe.com https://*.js.stripe.com;");
    expect(csp).toContain("frame-src https://js.stripe.com https://*.js.stripe.com https://hooks.stripe.com;");
    expect(csp).toContain("connect-src 'self' https://api.example.test https://abc.supabase.co https://api.stripe.com https://fonts.googleapis.com;");
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

  it("sends HSTS in production only; page policies come from the proxy", () => {
    const rules = securityHeaderRules(production);
    expect(rules.map((rule) => rule.source)).toEqual(["/:path*"]);
    expect(rules[0]!.headers.map((header) => header.key)).toEqual(expect.arrayContaining(["Strict-Transport-Security", "X-Frame-Options", "X-Content-Type-Options", "Referrer-Policy"]));
    expect(rules[0]!.headers.map((header) => header.key)).not.toContain("Content-Security-Policy");
    expect(securityHeaderRules({ production: false })[0]!.headers.map((header) => header.key)).not.toContain("Strict-Transport-Security");
  });

  it("lets shops show their embeds but no outside scripts, and keeps Stripe to checkout", () => {
    const shop = contentSecurityPolicy("shop", production);
    expect(shop).toContain("script-src 'self' 'unsafe-inline';");
    expect(shop).toContain("https://www.youtube-nocookie.com");
    expect(shop).toContain("https://calendly.com");
    expect(shop).not.toContain("stripe");
    expect(shop).toContain("frame-ancestors 'self'");
  });

  it("keeps the platform admin out of every frame and frames nothing itself", () => {
    const platform = contentSecurityPolicy("platform", production);
    expect(platform).toContain("frame-src 'none'");
    expect(platform).toContain("frame-ancestors 'none'");
    expect(platform).toContain("connect-src 'self' https://api.example.test https://abc.supabase.co;");
  });

  it("lets the admin's editor frame this site's previews", () => {
    expect(contentSecurityPolicy("admin", production)).toContain("frame-src 'self' https://www.google.com");
  });
});
