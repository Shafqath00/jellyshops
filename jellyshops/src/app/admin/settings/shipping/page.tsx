"use client";

import { useState } from "react";
import { AdminPage, Banner, Card, CardSkeleton, Field, ResourceForm, useToast } from "@/components/admin";
import { useStoreSettings } from "@/features/admin/settings/use-store-settings";

type Draft = { charge: string; info: string };

export default function ShippingSettingsPage() {
  const { settings, error, save, reload } = useStoreSettings();
  const toast = useToast();
  const [draft, setDraft] = useState<{ revision: number; value: Draft } | null>(null);
  const [problem, setProblem] = useState("");
  const base = settings ? { charge: (settings.shippingMinor / 100).toFixed(2), info: settings.shippingCopy } : null;
  const current = draft && settings && draft.revision === settings.revision ? draft.value : base;
  const dirty = Boolean(current && base && JSON.stringify(current) !== JSON.stringify(base));
  const set = (patch: Partial<Draft>) => { setProblem(""); if (settings && current) setDraft({ revision: settings.revision, value: { ...current, ...patch } }); };
  const money = (minor: number) => settings ? new Intl.NumberFormat("en-GB", { style: "currency", currency: settings.currency }).format(minor / 100) : "";

  return <AdminPage title="Shipping and delivery" width="narrow" back={{ href: "/admin/settings", label: "Settings" }} description="What customers pay for delivery and what they read about it at checkout.">
    {error && <Banner tone="critical" title="Could not load your settings" action={<button type="button" className="jk-button" onClick={reload}>Try again</button>}>{error}</Banner>}
    {!settings || !current ? !error && <CardSkeleton label="Loading shipping settings" /> :
      <ResourceForm dirty={dirty} onDiscard={() => { setDraft(null); setProblem(""); }} onSubmit={async () => {
        const amount = Number(current.charge);
        if (!/^\d+(\.\d{1,2})?$/.test(current.charge.trim()) || !Number.isFinite(amount)) { setProblem("Enter an amount such as 4.99, or 0 for free delivery."); throw new Error("Check the delivery charge."); }
        await save({ shippingMinor: Math.round(amount * 100), shippingCopy: current.info.trim() });
        setDraft(null); toast("Shipping saved");
      }}>
        <Card title="Delivery charge" description="Every order pays this one charge, whatever is in the basket.">
          <Field id="ship-charge" label={`Charge per order (${settings.currency})`} error={problem} help={Number(current.charge) === 0 ? "Delivery is free." : `Customers pay ${money(Math.round(Number(current.charge) * 100) || 0)} for delivery.`}>
            <input id="ship-charge" inputMode="decimal" aria-invalid={Boolean(problem)} value={current.charge} onChange={(event) => set({ charge: event.target.value })} />
          </Field>
        </Card>
        <Card title="Delivery information" description="Shown to customers on your store, for example delivery times or packaging.">
          <Field id="ship-info" label="Delivery details"><textarea id="ship-info" rows={4} maxLength={500} value={current.info} placeholder="For example: Delivered in 2 to 4 working days. Free returns within 30 days." onChange={(event) => set({ info: event.target.value })} /></Field>
        </Card>
        <Banner tone="info">Different prices by country, weight or order value, local delivery and collection in store are not available yet.</Banner>
      </ResourceForm>}
  </AdminPage>;
}
