"use client";

import { useState } from "react";
import { storeUrl } from "@jelly/storefront-schema";
import { AdminPage, Banner, Card, CardSkeleton, ConfirmDialog, Field, HelpTip, ResourceForm, useToast } from "@/components/admin";
import { toShopAdmin, useAdminRouter } from "@/features/admin/admin-routing";
import { useStoreSettings, type StoreSettings } from "@/features/admin/settings/use-store-settings";
import { useAuth } from "@/features/auth/providers/auth-provider";

type Draft = Pick<StoreSettings, "name" | "slug" | "timezone"> & {
  contactEmail: string;
  description: string;
  category: string;
  businessType: string;
};
const toDraft = (settings: StoreSettings): Draft => ({
  name: settings.name, slug: settings.slug, timezone: settings.timezone, contactEmail: settings.contactEmail ?? "",
  description: settings.description ?? "", category: settings.category ?? "", businessType: settings.businessType ?? "",
});
const zones = (current: string) => { const list = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : []; return list.includes(current) ? list : [current, ...list]; };

export default function GeneralSettingsPage() {
  const { settings, error, save, reload } = useStoreSettings();
  const toast = useToast();
  const [draft, setDraft] = useState<{ revision: number; value: Draft } | null>(null);
  const base = settings ? toDraft(settings) : null;
  const current = draft && settings && draft.revision === settings.revision ? draft.value : base;
  const dirty = Boolean(current && base && JSON.stringify(current) !== JSON.stringify(base));
  const set = (patch: Partial<Draft>) => settings && current && setDraft({ revision: settings.revision, value: { ...current, ...patch } });
  const { refreshMerchant } = useAuth();
  const router = useAdminRouter();
  // Changing the address moves the store: ask first, and say what happens to old links.
  const [confirmMove, setConfirmMove] = useState(false);
  const newSlug = current?.slug.trim() ?? "";
  const moving = Boolean(settings && newSlug && newSlug !== settings.slug);

  async function persist() {
    if (!current) return;
    await save({
      name: current.name.trim(), slug: newSlug, timezone: current.timezone, contactEmail: current.contactEmail.trim() || null,
      description: current.description.trim(), category: current.category.trim(), businessType: current.businessType.trim(),
    });
    setDraft(null);
    if (moving) {
      // This admin page's own address names the shop: reload the shop list and open the same page under the new name.
      // Start reloading first (the page then waits instead of showing "no access"), then move.
      const reloading = refreshMerchant();
      router.replace(toShopAdmin(newSlug, "/admin/settings/general"));
      await reloading;
      toast("Store address changed");
      return;
    }
    toast("Settings saved");
  }

  return <AdminPage title="General" width="narrow" back={{ href: "/admin/settings", label: "Settings" }} description="Your store's name and how customers reach you.">
    {error && <Banner tone="critical" title="Could not load your settings" action={<button type="button" className="jk-button" onClick={reload}>Try again</button>}>{error}</Banner>}
    {!settings || !current ? !error && <CardSkeleton label="Loading settings" /> :
      <ResourceForm dirty={dirty} onDiscard={() => setDraft(null)} onSubmit={async () => {
        if (moving) { setConfirmMove(true); return; }
        await persist();
      }}>
        <Card title="Store details">
          <div className="jk-stack-sm">
            <Field id="store-name" label="Store name" help="Shown in your store's header, emails and browser tab."><input id="store-name" required maxLength={120} value={current.name} onChange={(event) => set({ name: event.target.value })} /></Field>
            <Field id="store-email" label="Contact email" help="Customers' replies to order emails go here."><input id="store-email" type="email" value={current.contactEmail} onChange={(event) => set({ contactEmail: event.target.value })} /></Field>
            <Field id="store-slug" label={<>Store address <HelpTip>Your store&apos;s web address. If you change it, old links keep working and lead to the new address, and no other store can take the old one. You can change it 3 times in 30 days.</HelpTip></>} help={<>Lowercase letters, numbers and hyphens. Your store: <span className="jk-code">{storeUrl(newSlug || settings.slug)}</span></>}>
              <input id="store-slug" required minLength={3} maxLength={63} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value={current.slug} onChange={(event) => set({ slug: event.target.value })} />
            </Field>
            <Field id="store-description" label="Store description"><textarea id="store-description" rows={3} maxLength={500} value={current.description} onChange={(event) => set({ description: event.target.value })} /></Field>
            <Field id="store-category" label="Store category"><input id="store-category" maxLength={80} value={current.category} onChange={(event) => set({ category: event.target.value })} /></Field>
            <Field id="store-business-type" label="Business type"><input id="store-business-type" maxLength={80} value={current.businessType} onChange={(event) => set({ businessType: event.target.value })} /></Field>
          </div>
        </Card>
        <Card title="Time and money">
          <div className="jk-stack-sm">
            <Field id="store-zone" label="Time zone" help="Used for order dates and your daily sales figures."><select id="store-zone" value={current.timezone} onChange={(event) => set({ timezone: event.target.value })}>{zones(current.timezone).map((zone) => <option key={zone} value={zone}>{zone.replaceAll("_", " ")}</option>)}</select></Field>
            <p className="jk-muted">Country and currency: <strong>{settings.country} · {settings.currency}</strong>. These are set when the store is created.</p>
          </div>
        </Card>
      </ResourceForm>}
    <ConfirmDialog open={confirmMove} onOpenChange={setConfirmMove} title="Change your store's address?"
      description={<>Your store moves to <strong>{storeUrl(newSlug)}</strong>. Old links, bookmarks and emails lead to the new address, and no other store can use the old one. Shoppers&apos; bags don&apos;t move with it.</>}
      confirmLabel="Change address" onConfirm={persist} />
  </AdminPage>;
}
