"use client";

import { Button, Card, CardSkeleton } from "@/components/admin";
import { PREFERENCE_LIMITS as L } from "@jelly/storefront-schema";
import { BUSINESS_COUNTRIES, BUSINESS_LANGUAGES } from "./cards/business-card";
import { PrefSelect, PrefText } from "./fields";
import { usePreferencesForm } from "./use-preferences-form";

/**
 * Settings > General > Business details: legal name, phone, address, language and units. They live with the site
 * preferences (policy templates and the business details given to search engines use them) but belong with the
 * store's other details. This card saves on its own, apart from the General form above it.
 */
export function BusinessDetailsSection() {
  const form = usePreferencesForm();
  if (form.loadError) return null;
  if (!form.draft || !form.stored) return <CardSkeleton lines={3} label="Loading business details" />;
  const country = form.draft.business.address.country;
  const countries = BUSINESS_COUNTRIES.some((option) => option.value === country) ? BUSINESS_COUNTRIES : [...BUSINESS_COUNTRIES, { value: country, label: country }];
  return <Card title="Business details" description="Used on your policies and shown to search engines.">
    <div className="jk-stack-sm">
      <PrefText form={form} path="business.legalName" label="Legal business name" max={L.legalName} help="If different from the store name." autoComplete="organization" />
      <PrefText form={form} path="business.phone" label="Phone number" type="tel" inputMode="tel" max={L.phone} help="Include the country code if you sell abroad." autoComplete="tel" />
      <PrefText form={form} path="business.address.line1" label="Address" max={L.addressLine} autoComplete="address-line1" />
      <PrefText form={form} path="business.address.line2" label="Address line 2" max={L.addressLine} autoComplete="address-line2" />
      <div className="jk-grid-2">
        <PrefText form={form} path="business.address.city" label="Town or city" max={L.city} autoComplete="address-level2" />
        <PrefText form={form} path="business.address.region" label="County, state or region" max={L.region} autoComplete="address-level1" />
        <PrefText form={form} path="business.address.postalCode" label="Postcode" max={L.postalCode} autoComplete="postal-code" />
        <PrefSelect form={form} path="business.address.country" label="Country" options={countries} />
        <PrefSelect form={form} path="business.language" label="Store language" options={BUSINESS_LANGUAGES} />
        <PrefSelect form={form} path="business.units" label="Units" options={[{ value: "metric", label: "Metric (cm, kg)" }, { value: "imperial", label: "Imperial (in, lb)" }]} />
      </div>
      {form.dirty && <div className="jk-row">
        <Button variant="primary" loading={form.saving} loadingLabel="Saving…" onClick={() => void form.save()}>Save business details</Button>
        <Button variant="quiet" onClick={form.discard} disabled={form.saving}>Discard</Button>
      </div>}
    </div>
  </Card>;
}
