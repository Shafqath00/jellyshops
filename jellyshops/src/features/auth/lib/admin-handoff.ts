import { storeLinkSettings, type StoreLinkSettings } from "@jelly/storefront-schema";
import { authApiOrigin } from "@/features/auth/providers/auth-provider";
import { merchantSupabase } from "./supabase-clients";

/**
 * Opening the merchant admin after signing in, finishing onboarding or setting a new password.
 *
 * Until shop subdomains are on (NEXT_PUBLIC_STORE_LINKS), the admin is on this site: just go there. With subdomains
 * the admin lives on admin.<root>, where this browser has no session yet (sessions are kept per site). Then the
 * backend gives a one-time sign-in token (`POST /api/auth/handoff`) and admin.<root>/auth/continue turns it into a
 * session of its own. If that fails, the merchant signs in on the admin host instead.
 */
export const HANDOFF_PATH = "/auth/continue";

/** The admin host's address (`https://admin.jellyshop.io`), or null while the admin shares this site. */
export function adminHostOrigin(settings: StoreLinkSettings = storeLinkSettings()): string | null {
  if (settings.mode !== "subdomain") return null;
  const local = /^(localhost|127\.0\.0\.1)(:|$)/.test(settings.rootDomain);
  return `${local ? "http" : "https"}://admin.${settings.rootDomain}`;
}

/** Admin addresses as the admin host spells them: `/admin...` and `/s/<shop>...` both work there. */
function isAdminTarget(target: string): boolean {
  return target === "/admin" || /^\/admin[/?#]/.test(target) || target.startsWith("/s/");
}

/** True when `target` is the admin and the admin is on another host than this page. */
export function needsHandoff(target: string, here: string = typeof window === "undefined" ? "" : window.location.origin, settings: StoreLinkSettings = storeLinkSettings()): boolean {
  const admin = adminHostOrigin(settings);
  return Boolean(admin) && isAdminTarget(target) && here !== admin;
}

/** Where the admin host should finish signing in: the token in the hash (never sent to a server or kept in logs). */
export function handoffUrl(admin: string, tokenHash: string, target: string): string {
  const hash = new URLSearchParams({ token_hash: tokenHash, next: target });
  return `${admin}${HANDOFF_PATH}#${hash.toString()}`;
}

async function requestHandoffToken(): Promise<string> {
  const client = await merchantSupabase();
  const token = client ? (await client.auth.getSession()).data.session?.access_token : undefined;
  if (!token) throw new Error("not signed in");
  const response = await fetch(`${authApiOrigin()}/api/auth/handoff`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: "{}",
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`handoff ${response.status}`);
  const body = await response.json() as { tokenHash?: string };
  if (!body.tokenHash) throw new Error("no token");
  return body.tokenHash;
}

/** Go to an admin page, signing in on the admin host first when it is a different site. */
export async function openAdmin(target: string, navigate: (target: string) => void): Promise<void> {
  const admin = adminHostOrigin();
  if (!admin || !needsHandoff(target)) { navigate(target); return; }
  try {
    window.location.assign(handoffUrl(admin, await requestHandoffToken(), target));
  } catch {
    window.location.assign(`${admin}/login?next=${encodeURIComponent(target)}`);
  }
}
