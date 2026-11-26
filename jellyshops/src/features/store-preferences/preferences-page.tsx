"use client";

import { useEffect } from "react";
import Link from "@/features/admin/admin-routing";
import { AdminPage, Banner, Button, CardSkeleton, SaveBar, useUnsavedChangesWarning } from "@/components/admin";
import { useAuth } from "@/features/auth/providers/auth-provider";
import { useStoreSettings } from "@/features/admin/settings/use-store-settings";
import { BusinessCard, SocialCard } from "./cards/business-card";
import { PoliciesCard } from "./cards/policies-card";
import { SearchVisibilityCard, SeoCard, TitleTemplatesCard } from "./cards/seo-card";
import { SharingCard } from "./cards/sharing-card";
import { HistoryCard, PasswordCard, PrivacyCard, SpamCard, TrackingCard } from "./cards/tracking-card";
import { usePreferencesForm } from "./use-preferences-form";

const SECTIONS = [
  ["search", "Search listing"], ["sharing", "Sharing and icon"], ["titles", "Page titles"], ["visibility", "Search visibility"],
  ["business", "Business details"], ["social", "Social media"], ["policies", "Policies"], ["tracking", "Tracking"],
  ["privacy", "Cookie banner"], ["spam", "Spam protection"], ["password", "Password"], ["history", "History"],
] as const;

/** Settings > Store preferences: site-wide choices on one page with one Save. */
export function StorePreferencesPage() {
  const form = usePreferencesForm();
  const { activeStore } = useAuth();
  const { settings } = useStoreSettings();
  useUnsavedChangesWarning(form.dirty);

  const storeName = settings?.name ?? activeStore?.name ?? "";
  const storeSlug = settings?.slug ?? activeStore?.slug ?? "";

  // Ctrl/Cmd+S saves, like elsewhere in the admin.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") { event.preventDefault(); if (form.dirty) void form.save(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [form]);

  return <AdminPage title="Store preferences" width="narrow"
    description="Site-wide settings: how your store appears in search and when shared, your business details, policies, tracking and privacy."
    secondaryActions={[{ label: "URL redirects", href: "/admin/settings/preferences/redirects" }]}>
    {form.loadError ? <Banner tone="critical" title="Preferences didn't load" action={<Button onClick={() => void form.reload()}>Try again</Button>}>{form.loadError}</Banner>
      : !form.draft || !form.stored ? <><CardSkeleton label="Loading preferences" /><CardSkeleton lines={4} label="Loading preferences" /></>
        : <div className="jk-form jk-pref">
          {!form.stored.available && <Banner tone="warning" title="Not ready yet">Store preferences are being set up for your store. You can look around, but saving won&apos;t work until this is finished.</Banner>}
          {form.conflict && <Banner tone="warning" title="Changed somewhere else" action={<Button onClick={() => void form.reload()}>Reload</Button>}>These preferences were saved in another window or by someone else. Reload to see the latest. Your unsaved edits on this page will be lost.</Banner>}
          <nav className="jk-pref-nav" aria-label="Sections on this page">
            {SECTIONS.map(([id, label]) => <a key={id} href={`#${id}`} className="jk-chip">{label}</a>)}
          </nav>
          <SeoCard form={form} storeName={storeName} storeSlug={storeSlug} />
          <SharingCard form={form} storeName={storeName} storeSlug={storeSlug} />
          <TitleTemplatesCard form={form} storeName={storeName} />
          <SearchVisibilityCard form={form} />
          <BusinessCard form={form} storeName={storeName} contactEmail={settings?.contactEmail ?? null} timezone={settings?.timezone ?? "UTC"} currency={settings?.currency ?? ""} />
          <SocialCard form={form} />
          <PoliciesCard form={form} details={{
            storeName, legalName: form.draft.business.legalName, email: settings?.contactEmail ?? "",
            address: [form.draft.business.address.line1, form.draft.business.address.line2, form.draft.business.address.city, form.draft.business.address.region, form.draft.business.address.postalCode].filter(Boolean).join(", "),
          }} />
          <TrackingCard form={form} />
          <PrivacyCard form={form} />
          <SpamCard form={form} />
          <PasswordCard />
          <HistoryCard form={form} />
          <p className="jk-muted">Moving pages around? Add <Link href="/admin/settings/preferences/redirects" className="jk-link">URL redirects</Link> so old links keep working.</p>
          <SaveBar dirty={form.dirty} saving={form.saving} onSave={() => void form.save()} onDiscard={form.discard} />
        </div>}
  </AdminPage>;
}
