"use client";

import { useEffect, useState } from "react";
import Link from "@/features/admin/admin-routing";
import { AdminPage, Banner, Button, CardSkeleton, SaveBar, useToast, useUnsavedChangesWarning } from "@/components/admin";
import { useAuth } from "@/features/auth/providers/auth-provider";
import { useStoreSettings } from "@/features/admin/settings/use-store-settings";
import { BusinessCard, SocialCard } from "./cards/business-card";
import { PoliciesCard } from "./cards/policies-card";
import { SearchVisibilityCard, SeoCard, TitleTemplatesCard } from "./cards/seo-card";
import { SharingCard } from "./cards/sharing-card";
import { HistoryCard, PasswordCard, PrivacyCard, SpamCard, TrackingCard } from "./cards/tracking-card";
import { HealthCard, SetupCard, useSeoHealth } from "./cards/health-card";
import { exportFile, exportFileName } from "./settings-transfer";
import { ImportDialog } from "./transfer-dialog";
import { usePreferencesForm } from "./use-preferences-form";

const SECTIONS = [
  ["setup", "Setup"], ["health", "SEO health"], ["search", "Search listing"], ["sharing", "Sharing and icon"], ["titles", "Page titles"], ["visibility", "Search visibility"],
  ["business", "Business details"], ["social", "Social media"], ["policies", "Policies"], ["tracking", "Tracking"],
  ["privacy", "Cookie banner"], ["spam", "Spam protection"], ["password", "Password"], ["history", "History"],
] as const;

/** Settings > Store preferences: site-wide choices on one page with one Save. */
export function StorePreferencesPage() {
  const form = usePreferencesForm();
  const { activeStore } = useAuth();
  const { settings } = useStoreSettings();
  useUnsavedChangesWarning(form.dirty);
  const toast = useToast();
  const health = useSeoHealth(form);
  const [importing, setImporting] = useState(false);

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

  /** Saves the saved (not the edited) settings as a file, so an export always matches what shoppers see. */
  function downloadExport() {
    if (!form.stored) return;
    const blob = new Blob([exportFile(form.stored.preferences)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = exportFileName(storeSlug);
    document.body.appendChild(link); link.click(); link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast("Settings exported. Photos aren't included.");
  }

  return <AdminPage title="Store preferences" width="narrow"
    description="Site-wide settings: how your store appears in search and when shared, your business details, policies, tracking and privacy."
    secondaryActions={[{ label: "Bulk SEO editor", href: "/admin/settings/preferences/seo" }, { label: "URL redirects", href: "/admin/settings/preferences/redirects" }]}
    moreActions={form.stored ? [
      { label: "Export settings", onAction: () => downloadExport() },
      { label: "Import settings", onAction: () => setImporting(true), disabled: !form.stored.available },
    ] : []}>
    {form.loadError ? <Banner tone="critical" title="Preferences didn't load" action={<Button onClick={() => void form.reload()}>Try again</Button>}>{form.loadError}</Banner>
      : !form.draft || !form.stored ? <><CardSkeleton label="Loading preferences" /><CardSkeleton lines={4} label="Loading preferences" /></>
        : <div className="jk-form jk-pref">
          {!form.stored.available && <Banner tone="warning" title="Not ready yet">Store preferences are being set up for your store. You can look around, but saving won&apos;t work until this is finished.</Banner>}
          {form.conflict && <Banner tone="warning" title="Changed somewhere else" action={<Button onClick={() => void form.reload()}>Reload</Button>}>These preferences were saved in another window or by someone else. Reload to see the latest. Your unsaved edits on this page will be lost.</Banner>}
          <nav className="jk-pref-nav" aria-label="Sections on this page">
            {SECTIONS.map(([id, label]) => <a key={id} href={`#${id}`} className="jk-chip">{label}</a>)}
          </nav>
          <SetupCard form={form} report={health.report} contactEmail={settings?.contactEmail ?? null} />
          <HealthCard form={form} report={health.report} error={health.error} loading={health.loading} onRerun={health.rerun} />
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
          <ImportDialog open={importing} onOpenChange={setImporting} current={form.draft}
            onApply={(next, sections) => { form.replaceDraft(next); toast(`Copied ${sections.length} ${sections.length === 1 ? "section" : "sections"}. Check them, then save.`); }} />
          <SaveBar dirty={form.dirty} saving={form.saving} onSave={() => void form.save()} onDiscard={form.discard} />
        </div>}
  </AdminPage>;
}
