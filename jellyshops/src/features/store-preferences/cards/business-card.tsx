"use client";

import Link from "@/features/admin/admin-routing";
import { Card } from "@/components/admin";
import { PREFERENCE_LIMITS as L, SOCIAL_PLATFORMS, type SocialPlatform } from "@jelly/storefront-schema";
import { PrefSelect, PrefText } from "../fields";
import type { PreferencesForm } from "../use-preferences-form";

const LANGUAGES = [
  { value: "en", label: "English" }, { value: "en-GB", label: "English (UK)" }, { value: "en-US", label: "English (US)" },
  { value: "fr", label: "French" }, { value: "de", label: "German" }, { value: "es", label: "Spanish" }, { value: "it", label: "Italian" },
  { value: "nl", label: "Dutch" }, { value: "pt", label: "Portuguese" }, { value: "hi", label: "Hindi" },
];
const COUNTRIES = [
  ["", "Choose a country"], ["GB", "United Kingdom"], ["IE", "Ireland"], ["US", "United States"], ["CA", "Canada"], ["AU", "Australia"], ["NZ", "New Zealand"],
  ["IN", "India"], ["FR", "France"], ["DE", "Germany"], ["ES", "Spain"], ["IT", "Italy"], ["NL", "Netherlands"], ["BE", "Belgium"], ["PT", "Portugal"],
  ["SE", "Sweden"], ["DK", "Denmark"], ["NO", "Norway"], ["CH", "Switzerland"], ["AT", "Austria"], ["PL", "Poland"], ["AE", "United Arab Emirates"], ["SG", "Singapore"],
].map(([value, label]) => ({ value, label }));

export function BusinessCard({ form, storeName, contactEmail, timezone, currency }: { form: PreferencesForm; storeName: string; contactEmail: string | null; timezone: string; currency: string }) {
  const country = form.draft?.business.address.country ?? "";
  const countries = COUNTRIES.some((option) => option.value === country) ? COUNTRIES : [...COUNTRIES, { value: country, label: country }];
  return <Card title="Business details" description="Who is behind the store. Shown on policies, invoices and to search engines.">
    <div className="jk-stack-sm" id="business">
      <div className="jk-rows">
        <div className="jk-rows-item"><span className="jk-muted">Store name</span><span className="jk-strong">{storeName || "Not set"}</span></div>
        <div className="jk-rows-item"><span className="jk-muted">Contact email</span><span className="jk-strong">{contactEmail || "Not set"}</span></div>
        <div className="jk-rows-item"><span className="jk-muted">Time zone</span><span className="jk-strong">{timezone.replaceAll("_", " ")}</span></div>
        <div className="jk-rows-item"><span className="jk-muted">Currency</span><span className="jk-strong">{currency}</span></div>
      </div>
      <p className="jk-muted">Change these in <Link href="/admin/settings/general" className="jk-link">General settings</Link>. Currency is set when the store is created.</p>
      <PrefText form={form} path="business.legalName" label="Legal business name" max={L.legalName}
        tip="The name your business is registered under, if different from the store name. Used on policies and invoices."
        example="Harbour Home Ltd" autoComplete="organization" />
      <PrefText form={form} path="business.phone" label="Phone number" type="tel" inputMode="tel" max={L.phone}
        tip="Shown on your contact page and to search engines. Leave empty to keep it private."
        help="Include the country code if you sell abroad." example="+44 20 7946 0000" autoComplete="tel" />
      <fieldset className="jk-stack-sm">
        <legend className="jk-subheading">Business address</legend>
        <p className="jk-muted">Many countries require an address on your store&apos;s legal pages. It is shown only where you choose to show it.</p>
        <PrefText form={form} path="business.address.line1" label="Address line 1" max={L.addressLine} autoComplete="address-line1" />
        <PrefText form={form} path="business.address.line2" label="Address line 2" max={L.addressLine} autoComplete="address-line2" />
        <div className="jk-grid-2">
          <PrefText form={form} path="business.address.city" label="Town or city" max={L.city} autoComplete="address-level2" />
          <PrefText form={form} path="business.address.region" label="County, state or region" max={L.region} autoComplete="address-level1" />
          <PrefText form={form} path="business.address.postalCode" label="Postcode" max={L.postalCode} autoComplete="postal-code" />
          <PrefSelect form={form} path="business.address.country" label="Country" options={countries} />
        </div>
      </fieldset>
      <div className="jk-grid-2">
        <PrefSelect form={form} path="business.language" label="Store language" options={LANGUAGES}
          tip="The main language of your store. Tells browsers and search engines which language your pages are in." />
        <PrefSelect form={form} path="business.units" label="Units" options={[{ value: "metric", label: "Metric (cm, kg)" }, { value: "imperial", label: "Imperial (in, lb)" }]}
          tip="Used where your store shows sizes and weights." />
      </div>
    </div>
  </Card>;
}

const SOCIAL_LABEL: Record<SocialPlatform, { label: string; example: string }> = {
  instagram: { label: "Instagram", example: "https://instagram.com/yourshop" },
  facebook: { label: "Facebook", example: "https://facebook.com/yourshop" },
  x: { label: "X (Twitter)", example: "https://x.com/yourshop" },
  youtube: { label: "YouTube", example: "https://youtube.com/@yourshop" },
  tiktok: { label: "TikTok", example: "https://tiktok.com/@yourshop" },
  pinterest: { label: "Pinterest", example: "https://pinterest.com/yourshop" },
  linkedin: { label: "LinkedIn", example: "https://linkedin.com/company/yourshop" },
  threads: { label: "Threads", example: "https://threads.net/@yourshop" },
};

export function SocialCard({ form }: { form: PreferencesForm }) {
  return <Card title="Social media" description="Links to your social pages. Your store's footer shows them, and search engines link them to your business.">
    <div className="jk-grid-2" id="social">
      {SOCIAL_PLATFORMS.map((platform) => <PrefText key={platform} form={form} path={`social.${platform}`} label={SOCIAL_LABEL[platform].label}
        type="url" inputMode="url" placeholder={SOCIAL_LABEL[platform].example} max={L.socialUrl} />)}
    </div>
    <p className="jk-muted">Paste the full address of your page, starting with https://. Leave a box empty to hide that link.</p>
  </Card>;
}
