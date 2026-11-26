"use client";

import { Card } from "@/components/admin";
import { DEFAULT_TITLE_TEMPLATES, PREFERENCE_LIMITS, TITLE_TEMPLATE_KINDS, TITLE_TEMPLATE_TOKENS, fillTitleTemplate, storeUrl, type TitleTemplateKind } from "@jelly/storefront-schema";
import { PrefCheck, PrefText, valueAt } from "../fields";
import type { PreferencesForm } from "../use-preferences-form";

const KIND_LABEL: Record<TitleTemplateKind, string> = { product: "Products", collection: "Collections", article: "Blog posts", page: "Pages" };
const SAMPLE: Record<TitleTemplateKind, Record<string, string>> = {
  product: { "product name": "Oak bed frame", brand: "Harbour Home" },
  collection: { "collection name": "Beds" },
  article: { "post title": "How to choose a mattress", "blog name": "Journal" },
  page: { "page title": "About us" },
};

/** How a result may look on Google: title, address, description, cut where Google usually cuts them. */
export function SearchPreview({ title, address, description }: { title: string; address: string; description: string }) {
  return <div className="jk-search-preview" role="group" aria-label="Search result preview">
    <p className="jk-cell-sub">How it may look on Google</p>
    <p className="jk-search-preview-title">{title}</p>
    <p className="jk-search-preview-address">{address}</p>
    <p className="jk-search-preview-text">{description.length > 160 ? `${description.slice(0, 157)}…` : description}</p>
  </div>;
}

export function SeoCard({ form, storeName, storeSlug }: { form: PreferencesForm; storeName: string; storeSlug: string }) {
  const title = valueAt<string>(form, "seo.homeTitle") || storeName || "Your store";
  const description = valueAt<string>(form, "seo.homeDescription") || "Add a description so shoppers know what you sell before they click.";
  return <Card title="Search engine listing" description="How your homepage shows up on Google and other search engines.">
    <div className="jk-stack-sm" id="search">
      <SearchPreview title={title} address={storeSlug ? storeUrl(storeSlug) : "your-store.jellyshop.io"} description={description} />
      <PrefText form={form} path="seo.homeTitle" label="Homepage title" max={PREFERENCE_LIMITS.homeTitle} placeholder={storeName}
        tip="The blue headline in search results and the name in the browser tab. Leave it empty to use your store name."
        help="Put what you sell first." example="Handmade oak beds | Harbour Home" />
      <PrefText form={form} path="seo.homeDescription" label="Homepage description" max={PREFERENCE_LIMITS.homeDescription} multiline
        tip="The short text under the headline. Search engines may show their own text instead, but a clear description helps."
        help="One or two sentences about your shop and why to buy from you." example="Solid oak beds made in Devon. Free delivery on orders over £50." />
    </div>
  </Card>;
}

export function TitleTemplatesCard({ form, storeName }: { form: PreferencesForm; storeName: string }) {
  return <Card title="Page titles" description="Default search titles for every product, collection, blog post and page. A page's own SEO title always wins.">
    <div className="jk-stack-sm" id="titles">
      {TITLE_TEMPLATE_KINDS.map((kind) => {
        const template = valueAt<string>(form, `seo.titleTemplates.${kind}`) ?? "";
        const example = fillTitleTemplate(template || DEFAULT_TITLE_TEMPLATES[kind], { ...SAMPLE[kind], "store name": storeName || "Your store" });
        return <div key={kind} className="jk-stack-sm">
          <PrefText form={form} path={`seo.titleTemplates.${kind}`} label={KIND_LABEL[kind]} max={PREFERENCE_LIMITS.titleTemplate}
            tip={<>Words in curly brackets are filled in for each page. You can use: {TITLE_TEMPLATE_TOKENS[kind].map((token) => `{${token}}`).join(", ")}.</>}
            help={<>Words you can use: {TITLE_TEMPLATE_TOKENS[kind].map((token, index) => <span key={token}>{index ? ", " : ""}<span className="jk-code">{`{${token}}`}</span></span>)}. Shows as: <span className="jk-strong">{example}</span></>} />
          {template !== DEFAULT_TITLE_TEMPLATES[kind] && <button type="button" className="jk-link" onClick={() => form.set(`seo.titleTemplates.${kind}`, DEFAULT_TITLE_TEMPLATES[kind])}>Use the default ({DEFAULT_TITLE_TEMPLATES[kind]})</button>}
        </div>;
      })}
    </div>
  </Card>;
}

export function SearchVisibilityCard({ form }: { form: PreferencesForm }) {
  const indexing = valueAt<boolean>(form, "seo.allowIndexing");
  return <Card title="Search visibility" description="Whether search engines may list your store, and the extra details that help them understand it.">
    <div className="jk-stack-sm" id="visibility">
      <PrefCheck form={form} path="seo.allowIndexing" label="Let search engines list my store"
        help={indexing ? "Your store's pages, sitemap.xml and robots.txt invite search engines in. Each page can still be hidden on its own." : "Every page asks search engines not to list it. Use this only while you get ready; it can take weeks to appear again after you turn it back on."} />
      <fieldset className="jk-stack-sm">
        <legend className="jk-subheading">Extra details for search engines (structured data)</legend>
        <PrefCheck form={form} path="seo.structuredData.products" label="Product details" help="Price, stock and photos, so results can show them. Recommended." />
        <PrefCheck form={form} path="seo.structuredData.breadcrumbs" label="Breadcrumbs" help="Shows where a page sits in your store, for example Home › Beds › Oak bed." />
        <PrefCheck form={form} path="seo.structuredData.organization" label="Business details" help="Your store name, logo, contact details and social links." />
      </fieldset>
      <PrefText form={form} path="seo.searchConsoleToken" label="Google Search Console code" max={PREFERENCE_LIMITS.searchConsoleToken}
        tip="In Google Search Console, add your store as a URL-prefix property, choose “HTML tag”, and copy only the code inside content=“…”."
        help="Proves to Google that this store is yours, so you can see search reports." example="r4nd0mL0ngC0de_from-Google" />
    </div>
  </Card>;
}
