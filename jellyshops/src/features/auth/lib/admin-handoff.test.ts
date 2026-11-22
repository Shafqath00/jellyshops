import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const supabase = vi.hoisted(() => ({ session: { access_token: "apex-token" } as null | { access_token: string } }));
vi.mock("./supabase-clients", () => ({
  merchantSupabase: async () => ({ auth: { getSession: async () => ({ data: { session: supabase.session } }) } }),
}));
vi.mock("@/features/auth/providers/auth-provider", () => ({ authApiOrigin: () => "https://api.test" }));

import { adminHostOrigin, handoffUrl, needsHandoff, openAdmin } from "./admin-handoff";

const subdomain = { mode: "subdomain" as const, rootDomain: "jellyshop.io" };
const path = { mode: "path" as const, rootDomain: "jellyshop.io" };

describe("admin hand-off rules", () => {
  it("knows the admin host only when shops have subdomains", () => {
    expect(adminHostOrigin(path)).toBeNull();
    expect(adminHostOrigin(subdomain)).toBe("https://admin.jellyshop.io");
    expect(adminHostOrigin({ mode: "subdomain", rootDomain: "localhost:3230" })).toBe("http://admin.localhost:3230");
  });

  it("hands off only admin pages, only from another host", () => {
    expect(needsHandoff("/admin", "https://jellyshop.io", subdomain)).toBe(true);
    expect(needsHandoff("/s/myshop?welcome=1", "https://jellyshop.io", subdomain)).toBe(true);
    expect(needsHandoff("/admin", "https://admin.jellyshop.io", subdomain)).toBe(false);
    expect(needsHandoff("/onboarding", "https://jellyshop.io", subdomain)).toBe(false);
    expect(needsHandoff("/administrator", "https://jellyshop.io", subdomain)).toBe(false);
    expect(needsHandoff("/admin", "https://jellyshop.io", path)).toBe(false);
  });

  it("puts the token in the address's hash, never its query", () => {
    const url = new URL(handoffUrl("https://admin.jellyshop.io", "abc/+=", "/s/myshop?welcome=1"));
    expect(url.pathname).toBe("/auth/continue");
    expect(url.search).toBe("");
    const hash = new URLSearchParams(url.hash.slice(1));
    expect(hash.get("token_hash")).toBe("abc/+=");
    expect(hash.get("next")).toBe("/s/myshop?welcome=1");
  });
});

describe("openAdmin", () => {
  const assign = vi.fn();
  beforeEach(() => {
    supabase.session = { access_token: "apex-token" };
    assign.mockClear();
    vi.stubGlobal("location", { ...window.location, origin: "https://jellyshop.io", assign });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("just navigates while the admin shares this site", async () => {
    const navigate = vi.fn();
    await openAdmin("/admin", navigate);
    expect(navigate).toHaveBeenCalledWith("/admin");
    expect(assign).not.toHaveBeenCalled();
  });

  it("signs in on the admin host with a one-time token when shops have subdomains", async () => {
    vi.stubEnv("NEXT_PUBLIC_STORE_LINKS", "subdomain");
    vi.stubEnv("NEXT_PUBLIC_ROOT_DOMAIN", "jellyshop.io");
    const fetch = vi.fn(async () => Response.json({ tokenHash: "one-time" }));
    vi.stubGlobal("fetch", fetch);
    const navigate = vi.fn();
    await openAdmin("/s/myshop?welcome=1", navigate);
    expect(navigate).not.toHaveBeenCalled();
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.test/api/auth/handoff");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer apex-token");
    expect(assign).toHaveBeenCalledWith("https://admin.jellyshop.io/auth/continue#token_hash=one-time&next=%2Fs%2Fmyshop%3Fwelcome%3D1");
  });

  it("falls back to signing in on the admin host when the hand-off fails", async () => {
    vi.stubEnv("NEXT_PUBLIC_STORE_LINKS", "subdomain");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("no", { status: 503 })));
    await openAdmin("/admin", vi.fn());
    expect(assign).toHaveBeenCalledWith("https://admin.jellyshop.io/login?next=%2Fadmin");
  });
});
