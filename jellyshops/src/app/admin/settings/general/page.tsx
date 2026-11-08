"use client";

import { useState } from "react";
import { AdminPage, Banner, Card, CardSkeleton, Field, HelpTip, ResourceForm, useToast } from "@/components/admin";
import { useStoreSettings, type StoreSettings } from "@/features/admin/settings/use-store-settings";

type Draft = Pick<StoreSettings, "name" | "slug" | "timezone"> & { contactEmail: string };
const toDraft = (settings: StoreSettings): Draft => ({ name: settings.name, slug: settings.slug, timezone: settings.timezone, contactEmail: settings.contactEmail ?? "" });
const zones = (current: string) => { const list = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : []; return list.includes(current) ? list : [current, ...list]; };

export default function GeneralSettingsPage() {
  const { settings, error, save, reload } = useStoreSettings();
  const toast = useToast();
  const [draft, setDraft] = useState<{ revision: number; value: Draft } | null>(null);
  const base = settings ? toDraft(settings) : null;
  const current = draft && settings && draft.revision === settings.revision ? draft.value : base;
  const dirty = Boolean(current && base && JSON.stringify(current) !== JSON.stringify(base));
  const set = (patch: Partial<Draft>) => settings && current && setDraft({ revision: settings.revision, value: { ...current, ...patch } });

  return <AdminPage title="General" width="narrow" back={{ href: "/admin/settings", label: "Settings" }} description="Your store's name and how customers reach you.">
    {error && <Banner tone="critical" title="Could not load your settings" action={<button type="button" className="jk-button" onClick={reload}>Try again</button>}>{error}</Banner>}
    {!settings || !current ? !error && <CardSkeleton label="Loading settings" /> :
      <ResourceForm dirty={dirty} onDiscard={() => setDraft(null)} onSubmit={async () => {
        await save({ name: current.name.trim(), slug: current.slug.trim(), timezone: current.timezone, contactEmail: current.contactEmail.trim() || null });
        setDraft(null); toast("Settings saved");
      }}>
        <Card title="Store details">
          <div className="jk-stack-sm">
            <Field id="store-name" label="Store name" help="Shown in your store's header, emails and browser tab."><input id="store-name" required maxLength={120} value={current.name} onChange={(event) => set({ name: event.target.value })} /></Field>
            <Field id="store-email" label="Contact email" help="Customers' replies to order emails go here."><input id="store-email" type="email" value={current.contactEmail} onChange={(event) => set({ contactEmail: event.target.value })} /></Field>
            <Field id="store-slug" label={<>Store address <HelpTip>The part after the site name in your store&apos;s web address. It cannot change after your first order or publication.</HelpTip></>} help="Lowercase letters, numbers and hyphens.">
              <input id="store-slug" required minLength={3} maxLength={63} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value={current.slug} onChange={(event) => set({ slug: event.target.value })} />
            </Field>
          </div>
        </Card>
        <Card title="Time and money">
          <div className="jk-stack-sm">
            <Field id="store-zone" label="Time zone" help="Used for order dates and your daily sales figures."><select id="store-zone" value={current.timezone} onChange={(event) => set({ timezone: event.target.value })}>{zones(current.timezone).map((zone) => <option key={zone} value={zone}>{zone.replaceAll("_", " ")}</option>)}</select></Field>
            <p className="jk-muted">Country and currency: <strong>{settings.country} · {settings.currency}</strong>. These are set when the store is created.</p>
          </div>
        </Card>
      </ResourceForm>}
  </AdminPage>;
}
