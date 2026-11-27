"use client";

import { ChevronDown } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import Link from "@/features/admin/admin-routing";
import { Banner, Button, Card, StatusBadge, useToast } from "@/components/admin";
import {
  DEFAULT_TITLE_TEMPLATES, PREFERENCE_LIMITS as L, SOCIAL_PLATFORMS, TITLE_TEMPLATE_KINDS, TITLE_TEMPLATE_TOKENS,
  buildSeoChecks, fillTitleTemplate, seoGrade, seoScore, sortSeoChecks, storeSeoChecks, storeUrl, type TitleTemplateKind,
} from "@jelly/storefront-schema";
import { PrefCheck, PrefSelect, PrefText, valueAt } from "./fields";
import { useSeoHealth } from "./cards/health-card";
import { PoliciesCard } from "./cards/policies-card";
import { SearchPreview } from "./cards/seo-card";
import { ImageSetting, SharePreview, TabPreview } from "./cards/sharing-card";
import { HistoryCard, PasswordCard, extractTrackingId } from "./cards/tracking-card";
import { SOCIAL_LABEL } from "./cards/business-card";
import { exportFile, exportFileName } from "./settings-transfer";
import { ImportDialog } from "./transfer-dialog";
import { useSitePreferences } from "./site-preferences";
import type { PreferencesForm } from "./use-preferences-form";

/** A collapsed group: "Show more options" inside a card, or one section of the Advanced tab. */
function More({ summary, children, open }: { summary: ReactNode; children: ReactNode; open?: boolean }) {
  return <details className="jk-pref-more" open={open}>
    <summary><span>{summary}</span><ChevronDown size={16} aria-hidden="true" /></summary>
    <div className="jk-pref-more-body">{children}</div>
  </details>;
}

// --- Search --------------------------------------------------------------------------------------------------------

export function SearchTab() {
  const { form, storeName, storeSlug } = useSitePreferences();
  const title = valueAt<string>(form, "seo.homeTitle") || storeName || "Your store";
  const description = valueAt<string>(form, "seo.homeDescription") || "Add a description so shoppers know what you sell before they click.";
  const indexing = valueAt<boolean>(form, "seo.allowIndexing");
  return <>
    <Card title="Search engine listing" description="How your homepage appears on Google.">
      <SearchPreview title={title} address={storeSlug ? storeUrl(storeSlug) : "your-store.jellyshop.io"} description={description} />
      <PrefText form={form} path="seo.homeTitle" label="Homepage title" max={L.homeTitle} placeholder={storeName} help="Put what you sell first." />
      <PrefText form={form} path="seo.homeDescription" label="Description" max={L.homeDescription} multiline help="One or two sentences about your shop." />
    </Card>
    <Card title="Visibility">
      <PrefCheck form={form} path="seo.allowIndexing" label="Show my store in search engines"
        help={indexing ? undefined : "Your store is hidden from search engines. Turn this back on when you're ready."} />
    </Card>
    <SeoScoreLine form={form} />
  </>;
}

/** A one-line SEO score with a link to fix product and page listings in bulk. */
function SeoScoreLine({ form }: { form: PreferencesForm }) {
  const health = useSeoHealth(form);
  const saved = form.stored?.preferences;
  const checks = useMemo(() => saved && health.report ? sortSeoChecks(buildSeoChecks([...storeSeoChecks(saved), ...health.report.checks])) : null, [saved, health.report]);
  if (!checks) return null;
  const score = seoScore(checks);
  const grade = seoGrade(score);
  const fixes = checks.filter((check) => check.count > 0).length;
  return <p className="jk-pref-score-line">
    <span>SEO score <strong>{score}</strong></span><StatusBadge tone={grade.tone}>{grade.label}</StatusBadge>
    <span className="jk-muted">{fixes ? `${fixes} ${fixes === 1 ? "thing" : "things"} to improve` : "Nothing to fix"}</span>
    <Link href="/admin/settings/preferences/seo" className="jk-link">Edit product and page listings</Link>
  </p>;
}

// --- Branding ------------------------------------------------------------------------------------------------------

export function BrandingTab() {
  const { form, storeName, storeSlug } = useSitePreferences();
  const title = valueAt<string>(form, "seo.homeTitle") || storeName || "Your store";
  const description = valueAt<string>(form, "seo.homeDescription") || "Your homepage description appears here.";
  return <>
    <Card title="Sharing image" description="Shown when your store is shared in messages and on social media.">
      <SharePreview image={valueAt(form, "seo.socialImage")} title={title} description={description} address={storeSlug ? storeUrl(storeSlug) : ""} />
      <ImageSetting form={form} kind="social" label="Image" help="1200 × 630 pixels works best. PNG, JPEG or WebP, up to 5 MB." />
    </Card>
    <Card title="Browser tab icon" description="The small icon next to your store's name in browser tabs.">
      <TabPreview image={valueAt(form, "seo.favicon")} title={title} />
      <ImageSetting form={form} kind="favicon" label="Icon" help="A square image, at least 192 × 192 pixels. PNG, WebP or GIF." />
    </Card>
    <Card title="Social media links" description="Shown in your store's footer.">
      <More summary="Show social media links" open={SOCIAL_PLATFORMS.some((platform) => valueAt<string>(form, `social.${platform}`))}>
        <div className="jk-grid-2">
          {SOCIAL_PLATFORMS.map((platform) => <PrefText key={platform} form={form} path={`social.${platform}`} label={SOCIAL_LABEL[platform].label}
            type="url" inputMode="url" placeholder={SOCIAL_LABEL[platform].example} max={L.socialUrl} />)}
        </div>
      </More>
    </Card>
  </>;
}

// --- Policies ------------------------------------------------------------------------------------------------------

export function PoliciesTab() {
  const { form, storeName, settings } = useSitePreferences();
  return <Card title="Store policies" description="Published policies are linked from your store footer and checkout.">
    <PoliciesCard form={form} bare details={{
      storeName, legalName: form.draft?.business.legalName ?? "", email: settings?.contactEmail ?? "",
      address: (() => { const address = form.draft?.business.address; return address ? [address.line1, address.line2, address.city, address.region, address.postalCode].filter(Boolean).join(", ") : ""; })(),
    }} />
  </Card>;
}

// --- Tracking ------------------------------------------------------------------------------------------------------

function TrackingField({ form, path, kind, label, help, placeholder }: { form: PreferencesForm; path: string; kind: "ga" | "gtm" | "pixel"; label: string; help: string; placeholder: string }) {
  return <div onPaste={(event) => {
    const target = event.target as HTMLInputElement;
    if (target.tagName !== "INPUT") return;
    const pasted = event.clipboardData.getData("text");
    const id = extractTrackingId(kind, pasted);
    if (id !== pasted.trim()) { event.preventDefault(); form.set(path, id); }
  }}>
    <PrefText form={form} path={path} label={label} help={help} placeholder={placeholder} />
  </div>;
}

export function TrackingTab() {
  const { form } = useSitePreferences();
  const any = ["googleAnalyticsId", "googleTagManagerId", "metaPixelId"].some((key) => valueAt<string>(form, `tracking.${key}`));
  const banner = valueAt<string>(form, "privacy.cookieBanner");
  return <>
    <Card title="Analytics and ads" description="Paste an ID and we add the code for you.">
      <TrackingField form={form} path="tracking.googleAnalyticsId" kind="ga" label="Google Analytics 4" placeholder="G-AB12CD34EF" help="Measurement ID, starts with G-." />
      <TrackingField form={form} path="tracking.metaPixelId" kind="pixel" label="Meta Pixel" placeholder="123456789012345" help="Pixel ID from Meta Events Manager." />
      <More summary="Show more options" open={Boolean(valueAt<string>(form, "tracking.googleTagManagerId"))}>
        <TrackingField form={form} path="tracking.googleTagManagerId" kind="gtm" label="Google Tag Manager" placeholder="GTM-AB12CD3" help="Container ID, starts with GTM-." />
      </More>
      {any && banner === "off" && <Banner tone="warning">These tools set cookies. Turn on the cookie banner in Privacy and access if you sell in the UK or EU.</Banner>}
    </Card>
    <Card title="Google Search Console" description="Proves to Google that this store is yours.">
      <PrefText form={form} path="seo.searchConsoleToken" label="Verification code" max={L.searchConsoleToken} placeholder="Code from Google's HTML tag"
        help={<>Choose &ldquo;HTML tag&rdquo; in Search Console and paste only the code inside content=&ldquo;…&rdquo;.</>} />
    </Card>
  </>;
}

// --- Privacy and access --------------------------------------------------------------------------------------------

export function PrivacyTab() {
  const { form } = useSitePreferences();
  return <>
    <Card title="Cookie banner" description="Asks shoppers before analytics and ad cookies are used.">
      <PrefSelect form={form} path="privacy.cookieBanner" label="Show the banner" options={[
        { value: "required-regions", label: "Where the law requires it (recommended)" },
        { value: "everywhere", label: "To every shopper" },
        { value: "off", label: "Never" },
      ]} />
      <More summary="Show more options" open={Boolean(valueAt<string>(form, "privacy.cookieMessage"))}>
        <PrefText form={form} path="privacy.cookieMessage" label="Banner message" multiline max={L.cookieMessage}
          placeholder="We use cookies to improve your experience and measure our marketing." help="Leave empty to use the standard message." />
      </More>
    </Card>
    <Card title="Spam protection" description="Extra checks against bots. Shoppers don't see puzzles.">
      <PrefCheck form={form} path="spam.contactForm" label="Contact form" />
      <PrefCheck form={form} path="spam.newsletter" label="Email sign-up forms" />
      <PrefCheck form={form} path="spam.accountForms" label="Sign-in and account forms" />
    </Card>
    <PasswordCard />
  </>;
}

// --- Advanced ------------------------------------------------------------------------------------------------------

const KIND_LABEL: Record<TitleTemplateKind, string> = { product: "Products", collection: "Collections", article: "Blog posts", page: "Pages" };
const SAMPLE: Record<TitleTemplateKind, Record<string, string>> = {
  product: { "product name": "Oak bed frame", brand: "Harbour Home" },
  collection: { "collection name": "Beds" },
  article: { "post title": "How to choose a mattress", "blog name": "Journal" },
  page: { "page title": "About us" },
};

export function AdvancedTab() {
  const { form, storeName, storeSlug } = useSitePreferences();
  const toast = useToast();
  const [importing, setImporting] = useState(false);
  const site = storeSlug ? storeUrl(storeSlug).replace(/\/$/, "") : "";

  /** Saves the saved (not the edited) settings as a file, so an export always matches what shoppers see. */
  function downloadExport() {
    if (!form.stored) return;
    const blob = new Blob([exportFile(form.stored.preferences)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = Object.assign(document.createElement("a"), { href: url, download: exportFileName(storeSlug) });
    document.body.appendChild(link); link.click(); link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast("Settings exported. Photos aren't included.");
  }

  return <Card title="Advanced" description="Settings most stores never need to change.">
    <div className="jk-pref-advanced">
      <More summary="URL redirects">
        <p className="jk-muted">Send old links to new pages so nothing breaks when you move things around.</p>
        <Link href="/admin/settings/preferences/redirects" className="jk-button">Manage redirects</Link>
      </More>
      <More summary="Search engine files">
        <p className="jk-muted">Made for you and kept up to date. {valueAt<boolean>(form, "seo.allowIndexing") ? "" : "While your store is hidden from search engines, they ask search engines to stay away."}</p>
        {site && <p className="jk-pref-links"><a href={`${site}/sitemap.xml`} className="jk-link" target="_blank" rel="noreferrer">sitemap.xml</a><a href={`${site}/robots.txt`} className="jk-link" target="_blank" rel="noreferrer">robots.txt</a></p>}
      </More>
      <More summary="Structured data">
        <p className="jk-muted">Extra details that help search results show prices, ratings and your business.</p>
        <PrefCheck form={form} path="seo.structuredData.products" label="Product details" />
        <PrefCheck form={form} path="seo.structuredData.breadcrumbs" label="Breadcrumbs" />
        <PrefCheck form={form} path="seo.structuredData.organization" label="Business details" />
      </More>
      <More summary="Page title templates">
        <p className="jk-muted">Default search titles. A page&apos;s own SEO title always wins.</p>
        {TITLE_TEMPLATE_KINDS.map((kind) => {
          const template = valueAt<string>(form, `seo.titleTemplates.${kind}`) ?? "";
          const example = fillTitleTemplate(template || DEFAULT_TITLE_TEMPLATES[kind], { ...SAMPLE[kind], "store name": storeName || "Your store" });
          return <div key={kind}>
            <PrefText form={form} path={`seo.titleTemplates.${kind}`} label={KIND_LABEL[kind]} max={L.titleTemplate}
              help={<>Use {TITLE_TEMPLATE_TOKENS[kind].map((token) => `{${token}}`).join(", ")}. Shows as: <span className="jk-strong">{example}</span></>} />
            {template !== DEFAULT_TITLE_TEMPLATES[kind] && <button type="button" className="jk-link" onClick={() => form.set(`seo.titleTemplates.${kind}`, DEFAULT_TITLE_TEMPLATES[kind])}>Use the default</button>}
          </div>;
        })}
      </More>
      <More summary="Product and page listings">
        <p className="jk-muted">Edit the search titles and descriptions of many products and pages at once.</p>
        <Link href="/admin/settings/preferences/seo" className="jk-button">Open bulk SEO editor</Link>
      </More>
      <More summary="Export or import settings">
        <p className="jk-muted">Copy these settings to another store. Photos aren&apos;t included.</p>
        <div className="jk-row">
          <Button onClick={downloadExport}>Export</Button>
          <Button onClick={() => setImporting(true)} disabled={!form.stored?.available}>Import</Button>
        </div>
      </More>
      <More summary="Change history">
        <HistoryCard form={form} bare />
      </More>
    </div>
    {form.draft && <ImportDialog open={importing} onOpenChange={setImporting} current={form.draft}
      onApply={(next, sections) => { form.replaceDraft(next); toast(`Copied ${sections.length} ${sections.length === 1 ? "section" : "sections"}. Check them, then save.`); }} />}
  </Card>;
}
