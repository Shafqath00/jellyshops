const routeOrigin = "https://jellyshop.invalid";

/** Never allow a sign-in link to redirect outside the merchant app. */
export function merchantReturnPath(value?: string | null): string {
  if (!value?.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(value)) {
    return "/admin";
  }

  try {
    const url = new URL(value, routeOrigin);
    const pathname = decodeURIComponent(url.pathname);
    if (url.origin !== routeOrigin || /[\\\u0000-\u001f\u007f]/.test(pathname)) return "/admin";
    // /s/<shop>/... is a shop's admin on the admin host (shop subdomains, see features/admin/admin-routing.tsx).
    if (pathname === "/onboarding" || pathname === "/admin" || pathname.startsWith("/admin/") || pathname.startsWith("/s/")) {
      return pathname === "/onboarding" ? "/onboarding" : url.pathname + url.search + url.hash;
    }
  } catch {
    return "/admin";
  }

  return "/admin";
}

export function merchantCallbackUrl(next: string, recovery = false): string {
  const url = new URL("/auth/callback", window.location.origin);
  if (recovery) url.searchParams.set("flow", "recovery");
  else url.searchParams.set("next", merchantReturnPath(next));
  return url.toString();
}
