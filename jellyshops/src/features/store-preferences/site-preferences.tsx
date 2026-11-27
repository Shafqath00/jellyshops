"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from "react";
import Link, { useAdminPathname, useAdminRouter } from "@/features/admin/admin-routing";
import { AdminPage, Banner, Button, CardSkeleton, SaveBar, useUnsavedChangesWarning } from "@/components/admin";
import { useAuth } from "@/features/auth/providers/auth-provider";
import { useStoreSettings, type StoreSettings } from "@/features/admin/settings/use-store-settings";
import { usePreferencesForm, type PreferencesForm } from "./use-preferences-form";

/** The tabs of Settings > Store > Site preferences, each on its own address. */
export const PREFERENCE_TABS = [
  { id: "search", label: "Search", href: "/admin/settings/preferences" },
  { id: "branding", label: "Branding", href: "/admin/settings/preferences/branding" },
  { id: "policies", label: "Policies", href: "/admin/settings/preferences/policies" },
  { id: "tracking", label: "Tracking", href: "/admin/settings/preferences/tracking" },
  { id: "privacy", label: "Privacy and access", href: "/admin/settings/preferences/privacy" },
  { id: "advanced", label: "Advanced", href: "/admin/settings/preferences/advanced" },
] as const;
export type PreferenceTab = (typeof PREFERENCE_TABS)[number]["id"];

/** Which tab holds a setting, so Save can open the tab with the first problem. */
export function tabForPath(path: string): PreferenceTab {
  if (path === "seo.homeTitle" || path === "seo.homeDescription" || path === "seo.allowIndexing") return "search";
  if (path.startsWith("seo.socialImage") || path.startsWith("seo.favicon") || path.startsWith("social.")) return "branding";
  if (path.startsWith("policies.")) return "policies";
  if (path.startsWith("tracking.") || path === "seo.searchConsoleToken") return "tracking";
  if (path.startsWith("privacy.") || path.startsWith("spam.")) return "privacy";
  return "advanced";
}

interface SitePreferencesContext {
  form: PreferencesForm;
  storeName: string;
  storeSlug: string;
  settings: StoreSettings | null;
}
const Context = createContext<SitePreferencesContext | null>(null);

export function useSitePreferences(): SitePreferencesContext {
  const value = useContext(Context);
  if (!value) throw new Error("useSitePreferences is used outside Site preferences.");
  return value;
}

/**
 * Site preferences: a header, a row of tabs and the open tab. The edited settings live here, so switching tabs keeps
 * unsaved changes, and one save bar (only while something changed) saves them all. The store password saves on its
 * own, as before.
 */
export function SitePreferences({ children }: { children: ReactNode }) {
  const router = useAdminRouter();
  const pathname = useAdminPathname();
  const onProblem = useCallback((path: string) => {
    const tab = PREFERENCE_TABS.find((item) => item.id === tabForPath(path))!;
    if (pathname !== tab.href) router.push(tab.href);
  }, [pathname, router]);
  const form = usePreferencesForm({ onProblem });
  const { activeStore } = useAuth();
  const { settings } = useStoreSettings();
  useUnsavedChangesWarning(form.dirty);

  // Ctrl/Cmd+S saves, like elsewhere in the admin.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") { event.preventDefault(); if (form.dirty) void form.save(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [form]);

  // On narrow screens the tab row scrolls sideways: keep the open tab in view.
  const tabsRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const tabs = tabsRef.current;
      const current = tabs?.querySelector<HTMLElement>("[aria-current=page]");
      if (!tabs || !current) return;
      // Scroll only the tab row (scrollIntoView would also move the page).
      const overflowRight = current.offsetLeft + current.offsetWidth - (tabs.scrollLeft + tabs.clientWidth);
      if (overflowRight > 0) tabs.scrollLeft += overflowRight + 8;
      else if (current.offsetLeft < tabs.scrollLeft) tabs.scrollLeft = current.offsetLeft - 8;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [pathname]);

  const value = useMemo(() => ({
    form, settings: settings ?? null,
    storeName: settings?.name ?? activeStore?.name ?? "",
    storeSlug: settings?.slug ?? activeStore?.slug ?? "",
  }), [form, settings, activeStore]);

  return <AdminPage title="Site preferences" width="narrow" description="How your store looks in search and when shared, plus policies, tracking and privacy.">
    <nav ref={tabsRef} className="jk-pref-tabs" aria-label="Site preferences">
      {PREFERENCE_TABS.map((tab) => <Link key={tab.id} href={tab.href} className="jk-pref-tab-link" aria-current={pathname === tab.href ? "page" : undefined}>{tab.label}</Link>)}
    </nav>
    {form.loadError ? <Banner tone="critical" title="Preferences didn't load" action={<Button onClick={() => void form.reload()}>Try again</Button>}>{form.loadError}</Banner>
      : !form.draft || !form.stored ? <><CardSkeleton label="Loading preferences" /><CardSkeleton lines={3} label="Loading preferences" /></>
        : <div className="jk-pref-body">
          {!form.stored.available && <Banner tone="warning">Site preferences are still being set up for this store, so saving won&apos;t work yet.</Banner>}
          {form.conflict && <Banner tone="warning" action={<Button onClick={() => void form.reload()}>Reload</Button>}>Someone else saved these settings. Reload to see theirs; your unsaved edits will be lost.</Banner>}
          <Context.Provider value={value}>{children}</Context.Provider>
          <SaveBar dirty={form.dirty} saving={form.saving} onSave={() => void form.save()} onDiscard={form.discard} />
        </div>}
  </AdminPage>;
}
