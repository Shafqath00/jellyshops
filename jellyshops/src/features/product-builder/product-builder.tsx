"use client";

import { AnimatedDetails } from "./animated-details";
import Link from "next/link";
import { Banner, Card, StatusBadge } from "@/components/admin";
import { TemplatePicker } from "@/features/store-editor/components/template-picker";
import { Sheet, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { OrganizationSection } from "./sections/organization-section";
import { DigitalProductSettings } from "@/features/commerce/components/digital-product-settings";
import { isProductMediaEnabled, pruneMediaAssignments } from "@jelly/storefront-schema";
import { PhotosSection } from "./sections/photos-section";
import { productReadiness } from "./readiness";
import { ReadinessCard } from "./readiness-card";
import { ArrowLeft, Eye, Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useShop } from "@/contexts/shop-context";
import { useAuth } from "@/features/auth/providers/auth-provider";
import { catalogProductToStorefrontProduct } from "@/features/commerce/api/client";
import { createStoreEditorApi } from "@/features/store-editor/api/client";
import type { Product, ProductOption } from "@/lib/domain";
import type { DraftIssue } from "@/lib/product-builder";
import { BuyerPreview } from "./buyer-preview";
import { draftToPayload, emptyDraft, hasVariantAxes, productToDraft, validateBuilderDraft, withOptions, type DraftErrors, type PersistedState, type ProductDraft } from "./draft";
import { BasicsSection } from "./sections/basics-section";
import { CategorySection } from "./sections/category-section";
import { ChoicesSection } from "./sections/choices-section";
import { PersonalisationSection } from "./sections/personalisation-section";
import { QuantityRuleSection } from "./sections/quantity-rule-section";
import { InventorySection } from "./sections/inventory-section";
import { PricingSection } from "./sections/pricing-section";
import { ShippingSection } from "./sections/shipping-section";
import { VariantsSection } from "./sections/variants-section";
import { buildCategoryPaths, createTaxonomyClient, getCategoryTemplates, type Taxonomy } from "./taxonomy";
import { createMetafieldsApi } from "./metafields/api";
import { createLookups } from "./metafields/lookups";
import { useProductMetafields } from "./metafields/use-product-metafields";
import { MetafieldsSection } from "./sections/metafields-section";
import { SeoSection } from "./sections/seo-section";
import { createVariantCombinationKey } from "@/lib/product-variants";

import { ProductSurface } from "./product-surface";
import { ProductSheetContent } from "./product-sheet";
import { useProductConfirm } from "./use-product-confirm";

const API_URL = process.env.NEXT_PUBLIC_STORE_EDITOR_API_URL ?? "http://localhost:3001";
const FIELD_IDS: Record<keyof DraftErrors, string> = { title: "pb-title", description: "pb-description", imageUrl: "pb-title", categoryId: "pb-category-search", price: "pb-price", compareAtPrice: "pb-compare", cost: "pb-cost", unitPricing: "pb-unit-total", barcode: "pb-barcode", lowStockThreshold: "pb-low-stock", weight: "pb-weight", dimensions: "pb-length", hsCode: "pb-hs-code", handle: "pb-handle", sku: "pb-sku", stock: "pb-stock", published: "pb-published", personalisation: "pb-personalisation-missing", quantityRule: "pb-quantity-min" };
const NOTHING_SAVED: PersistedState = { variantIds: [], imageUrl: "" };

/**
 * Single-page product builder: basics, category, choices, combinations and price.
 * Pass `initial` to edit a saved product; otherwise it creates one.
 */
export function ProductBuilder({ initial }: { initial?: Product }) {
  const { repository } = useShop();
  const confirmation = useProductConfirm();
  const { session, activeStore } = useAuth();
  const token = session?.access_token;
  const storeId = activeStore?.id;
  const currency = activeStore?.currency ?? "INR";
  const api = useMemo(() => token ? createStoreEditorApi({ baseUrl: API_URL, token }) : null, [token]);
  const taxonomyClient = useMemo(() => token ? createTaxonomyClient({ baseUrl: API_URL, token }) : null, [token]);
  const metafieldsApi = useMemo(() => token ? createMetafieldsApi({ baseUrl: API_URL, token }) : null, [token]);
  const lookups = useMemo(() => token ? createLookups({ baseUrl: API_URL, token }) : null, [token]);
  const start = useMemo(() => initial ? productToDraft(initial) : { draft: { ...emptyDraft, published: false, media: [] }, persisted: { ...NOTHING_SAVED, media: [] } }, [initial]);

  const [draft, setDraft] = useState<ProductDraft>(start.draft);
  const [persisted, setPersisted] = useState<PersistedState>(start.persisted);
  const [productId, setProductId] = useState<string | null>(initial?.id ?? null);
  const [errors, setErrors] = useState<DraftErrors>({});
  const [problems, setProblems] = useState<DraftIssue[]>([]);
  const [limitError, setLimitError] = useState("");
  const [taxonomy, setTaxonomy] = useState<Taxonomy | null>(null);
  const [taxonomyLoading, setTaxonomyLoading] = useState(Boolean(token && storeId));
  const [taxonomyError, setTaxonomyError] = useState("");
  const taggingEnabled = isProductMediaEnabled(storeId ?? "", process.env.NEXT_PUBLIC_PRODUCT_MEDIA_STORE_IDS);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const previewTrigger = useRef<HTMLButtonElement>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [justSaved, setJustSaved] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [copy, setCopy] = useState<{ id: string; title: string } | null>(null);
  /** What Discard returns to: the product as opened, then as last saved. */
  const baseline = useRef({ draft: start.draft, persisted: start.persisted });
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!taxonomyClient || !storeId) return;
    let cancelled = false;
    taxonomyClient.load(storeId)
      .then((result) => { if (!cancelled) setTaxonomy(result); })
      .catch((caught: unknown) => { if (!cancelled) setTaxonomyError(caught instanceof Error ? caught.message : "Could not load categories."); })
      .finally(() => { if (!cancelled) setTaxonomyLoading(false); });
    return () => { cancelled = true; };
  }, [taxonomyClient, storeId]);

  // Warn before leaving with unsaved work.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const touch = () => { setDirty(true); setJustSaved(false); };

  const metafields = useProductMetafields({ api: metafieldsApi, storeId, productId, variantIds: persisted.variantIds, onChange: touch });
  const metafieldContext = useMemo(() => ({ storeId: storeId ?? "", currency, lookups }), [storeId, currency, lookups]);

  const change = useCallback(<K extends keyof ProductDraft>(field: K, value: ProductDraft[K]) => {
    setDraft((current) => ({ ...current, [field]: value }));
    setErrors((current) => (current[field as keyof DraftErrors] ? { ...current, [field]: undefined } : current));
    setDirty(true);
    setJustSaved(false);
  }, []);

  async function changeOptions(options: ProductOption[]) {
    const pruned = pruneMediaAssignments(draft.media ?? [], options);
    if (pruned.removedMediaIds.length && !(await confirmation.ask({ title: "Remove photo assignments?", description: `${pruned.removedMediaIds.length} photo(s) will be removed from this product because their last choice tag is being deleted. They stay in your library.`, confirmLabel: "Remove assignments" }))) return;
    const result = withOptions(draft, options);
    setDraft(result.draft);
    setLimitError(result.error ?? "");
    setProblems([]);
    touch();
  }

  const categoryPaths = useMemo(() => buildCategoryPaths(taxonomy?.categories ?? []), [taxonomy]);
  const category = categoryPaths.find((path) => path.id === draft.categoryId);
  const categoryName = category?.names[category.names.length - 1];
  const templates = useMemo(() => taxonomy && draft.categoryId ? getCategoryTemplates(draft.categoryId, taxonomy) : [], [taxonomy, draft.categoryId]);
  const combinations = hasVariantAxes(draft);
  const canPublish = !draft.archived && (!productId || !draft.published);

  function focusField(id: string) {
    const target = form.current?.querySelector<HTMLElement>(`#${id}`);
    for (let parent = target?.parentElement; parent; parent = parent.parentElement) {
      if (parent instanceof HTMLDetailsElement) parent.open = true;
    }
    target?.focus();
  }

  async function save(published = draft.published) {
    if (saving || uploading) return;
    const savingDraft = { ...draft, published, archived: published ? false : draft.archived };
    setSaveError("");
    const { fields, problems: found } = validateBuilderDraft(savingDraft);
    setErrors(fields);
    setProblems(found);
    const firstField = (Object.keys(fields) as Array<keyof DraftErrors>)[0];
    if (firstField) { focusField(FIELD_IDS[firstField]); return; }
    if (found.length > 0) { form.current?.querySelector<HTMLElement>("[data-problems]")?.focus(); return; }
    if (!api || !storeId) { setSaveError("Sign in to your store before saving."); return; }
    setSaving(true);
    try {
      const payload = draftToPayload(savingDraft, categoryName, persisted);
      const result = productId ? await api.updateProduct(storeId, productId, payload) : await api.createProduct(storeId, payload);
      const canonical = catalogProductToStorefrontProduct(result);
      repository.saveProduct(canonical);
      const saved = productToDraft(canonical).persisted;
      setPersisted({ ...saved, imageUrl: savingDraft.imageUrl, media: canonical.media ?? savingDraft.media });
      baseline.current = { draft: { ...savingDraft, media: canonical.media ?? savingDraft.media, ...(hasVariantAxes(savingDraft) ? { variants: canonical.variants } : {}) }, persisted: { ...saved, imageUrl: savingDraft.imageUrl, media: canonical.media ?? savingDraft.media } };
      // Adopt the server's variant ids so the next save updates these rows instead of adding new ones.
      setDraft((current) => ({ ...current, published: savingDraft.published, archived: savingDraft.archived, media: canonical.media ?? current.media, ...(hasVariantAxes(savingDraft) ? { variants: canonical.variants } : {}) }));
      // A new product gets its own address, so reloading the page edits it instead of creating another.
      if (!productId && typeof window !== "undefined" && window.location.pathname.startsWith("/admin/products")) window.history.replaceState(null, "", `/admin/products/${encodeURIComponent(result.id)}`);
      setProductId(result.id);
      // Custom data is stored apart from the product, so it is saved once the product and its combinations exist.
      const savedVariantIds: Record<string, string> = {};
      if (hasVariantAxes(savingDraft)) for (const entry of savingDraft.variants) {
        const match = canonical.variants.find((candidate) => createVariantCombinationKey(candidate.options ?? {}) === createVariantCombinationKey(entry.options ?? {}));
        if (match) savedVariantIds[entry.id] = match.id;
      }
      const custom = await metafields.saveAll({ productId: result.id, variantIds: savedVariantIds });
      if (custom.ok) { setDirty(false); setJustSaved(true); }
      else { setSaveError(`Your product was saved, but its custom data was not: ${custom.message}`); setDirty(true); setJustSaved(false); }
    } catch (caught) { setSaveError(caught instanceof Error ? caught.message : "Could not save this product."); }
    finally { setSaving(false); }
  }

  /** Brings an archived product back as a draft, so it can be checked before it goes live again. */
  async function restore() {
    if (!api || !storeId || !productId) return;
    setSaving(true); setSaveError("");
    try { await api.updateProduct(storeId, productId, { status: "DRAFT" }); setDraft(current => ({ ...current, archived: false, published: false })); setDirty(false); setJustSaved(true); }
    catch (caught) { setSaveError(caught instanceof Error ? caught.message : "Could not restore this product. Try again."); }
    finally { setSaving(false); }
  }
  async function archive() {
    if (!api || !storeId || !productId || !(await confirmation.ask({ title: "Archive this product?", description: "It will be hidden from your store. You can make it active again later.", confirmLabel: "Archive product", destructive: true }))) return;
    setSaving(true);
    try { await api.updateProduct(storeId, productId, { status: "ARCHIVED" }); setDraft(current => ({ ...current, archived: true, published: false })); repository.archiveProduct(productId); setDirty(false); setJustSaved(true); }
    catch (caught) { setSaveError(caught instanceof Error ? caught.message : "Could not archive product."); }
    finally { setSaving(false); }
  }

  /** Saves a draft copy of this product (photos, choices, prices and stock) under a new name and address. */
  async function duplicate() {
    if (!api || !storeId || !productId) return;
    setSaving(true); setSaveError(""); setCopy(null);
    try {
      const title = `${draft.title.trim()} (copy)`;
      const suffix = Math.random().toString(36).slice(2, 6);
      const payload = draftToPayload({ ...draft, title, handle: `${(draft.handle || "product").slice(0, 60)}-copy-${suffix}`, handleManual: true, published: false, archived: false }, categoryName, { ...NOTHING_SAVED, media: [] });
      const created = await api.createProduct(storeId, payload);
      setCopy({ id: created.id, title });
    } catch (caught) { setSaveError(caught instanceof Error ? caught.message : "Could not duplicate this product."); }
    finally { setSaving(false); }
  }

  async function discard() {
    if (!(await confirmation.ask({ title: "Discard unsaved changes?", description: "Your changes since the last save will be lost.", confirmLabel: "Discard changes", destructive: true }))) return;
    metafields.reset();
    setDraft(baseline.current.draft);
    setPersisted(baseline.current.persisted);
    setErrors({});
    setProblems([]);
    setLimitError("");
    setSaveError("");
    setDirty(false);
  }

  function startAnother() {
    setDraft({ ...emptyDraft, published: false, media: [] });
    setPersisted(NOTHING_SAVED);
    baseline.current = { draft: { ...emptyDraft, published: false, media: [] }, persisted: NOTHING_SAVED };
    metafields.clear();
    setProductId(null);
    setErrors({});
    setProblems([]);
    setLimitError("");
    setDirty(false);
    setJustSaved(false);
  }

  const upload = api && storeId ? async (file: File) => (await api.uploadMedia(storeId, file)).url : undefined;

  return (
    <ProductSurface>
    <form ref={form} aria-label="Product editor" noValidate onSubmit={(event) => { event.preventDefault(); void save(); }} className="jk-builder">
      <header className="jk-page-header jk-builder-header">
        <div className="jk-page-title">
          <Link href="/admin/products" className="jk-back" aria-label="Back to products"><ArrowLeft size={16} aria-hidden="true" /></Link>
          <div className="min-w-0"><div className="jk-title-row"><h1>{productId ? draft.title || "Edit product" : "Add product"}</h1>
            {productId && <StatusBadge kind="product" value={draft.archived ? "ARCHIVED" : draft.published ? "ACTIVE" : "DRAFT"} />}</div><p className="jk-builder-subtitle">{productId ? "Manage product details, media, and availability." : "Start with a name and price. Add optional details anytime."}</p></div>
        </div>
        <div className="jk-page-actions">
          <button type="button" className="jk-button" ref={previewTrigger} onClick={() => setPreviewOpen(true)}><Eye size={15} aria-hidden="true" />Preview</button>
          {productId && <button type="button" className="jk-button" disabled={saving || dirty} title={dirty ? "Save your changes first" : undefined} onClick={() => void duplicate()}>Duplicate</button>}
          {productId && !draft.archived && <button type="button" className="jk-button" disabled={saving} onClick={() => void archive()}>Archive</button>}
          {productId && draft.archived && <button type="button" className="jk-button" disabled={saving} onClick={() => void restore()}>Restore</button>}
        </div>
      </header>
      <nav className="jk-builder-nav" aria-label="Product sections">
        <a href="#pb-details">Details & photos</a><a href="#pb-selling">Pricing & inventory</a><a href="#pb-variants">Options & variants</a><a href="#pb-shipping">Shipping</a><a href="#pb-more">More details</a><a href="#pb-organization">Organization</a>
      </nav>
      <div className="jk-builder-main">
        {justSaved && (
          <Banner tone="success" title="Product saved successfully">
            <span className="jk-row" style={{ gap: 16 }}>
              <Link href="/admin/products" className="jk-link">Back to products</Link>
              <button type="button" onClick={startAnother} className="jk-link">Add another</button>
            </span>
          </Banner>
        )}
        {copy && <Banner tone="success" title="Copy saved as a draft."><Link href={`/admin/products/${copy.id}`} className="jk-link">Open {copy.title}</Link></Banner>}
        {saveError && <Banner tone="critical" title="Not saved">{saveError}</Banner>}
        {problems.length > 0 && (
          <div role="alert" tabIndex={-1} data-problems className="jk-banner jk-tone-critical jk-problems">
            <p className="jk-strong">Fix {problems.length === 1 ? "this" : "these"} before saving:</p>
            <ul className="jk-bullets" style={{ color: "inherit" }}>{problems.map((problem, index) => <li key={`${problem.code}-${index}`}>{problem.message}</li>)}</ul>
          </div>
        )}

        <div id="pb-details" className="jk-builder-group"><BasicsSection draft={draft} errors={errors} onChange={change} onUpload={upload} hidePhoto />

        <PhotosSection media={draft.media ?? []} options={draft.options} taggingEnabled={taggingEnabled} onChange={(media) => { setDraft((current) => ({ ...current, media, imageUrl: media[0]?.url ?? "", variants: current.variants.map((variant) => variant.mediaId && !media.some((photo) => photo.id === variant.mediaId) ? { ...variant, mediaId: undefined } : variant) })); touch(); }} onBusy={setUploading} onDelete={api && storeId ? (mediaId) => api.deleteMedia(storeId, mediaId) : undefined} onUpload={api && storeId ? (file, progress) => api.uploadMedia(storeId, file, progress) : undefined} onList={api?.listMedia && storeId ? () => api.listMedia!(storeId) : undefined} />
        </div>
        <div id="pb-selling" className="jk-builder-group">
          <PricingSection draft={draft} errors={errors} currency={currency} hasCombinations={combinations} onChange={change} />
          <InventorySection draft={draft} errors={errors} hasCombinations={combinations} onChange={change} />
        </div>
        <div id="pb-variants" className="jk-builder-group">
        <ChoicesSection options={draft.options} templates={templates} categoryName={categoryName} limitError={limitError} onChange={changeOptions} />
        {combinations && <div id="pb-variant-list"><VariantsSection photos={draft.media ?? []} physical={draft.physical} custom={metafields} customContext={metafieldContext} media={taggingEnabled ? draft.media : undefined} options={draft.options} variants={draft.variants} currency={currency} onChange={(variants) => { setDraft((current) => ({ ...current, variants })); touch(); }} /></div>}
        </div>
        <div id="pb-shipping"><ShippingSection draft={draft} errors={errors} hasCombinations={combinations} onChange={change} /></div>
        <div id="pb-more" className="jk-builder-group">
          <div className="jk-builder-group-heading"><h2>More details</h2><p>Only add what your product needs.</p></div>
        <AnimatedDetails className="jk-card jk-disclosure"><summary>Product specifications <span className="jk-muted">(optional)</span></summary><label className="jk-field mt-3">Specifications<textarea rows={4} maxLength={12000} value={draft.specificationsText??""} placeholder={"Material: Cotton\nCare: Machine wash cold"} onChange={event=>change("specificationsText",event.target.value)} /><small>One detail per line, for example Material: Cotton.</small></label></AnimatedDetails>
          <PersonalisationSection collapsible fields={draft.personalisation ?? []} onChange={(fields) => change("personalisation", fields)} />
          <QuantityRuleSection collapsible rule={draft.quantityRule ?? null} onChange={(rule) => change("quantityRule", rule)} />


        {api && <MetafieldsSection collapsible state={metafields} context={metafieldContext} />}
        <SeoSection draft={draft} errors={errors} storeName={activeStore?.name ?? ""} storeSlug={activeStore?.slug ?? ""} saved={Boolean(productId) && draft.published} onChange={change} />

        </div>
      </div>

      <OrganizationSection category={<><ReadinessCard readiness={productReadiness(draft)} /><CategorySection
          taxonomy={taxonomy}
          loading={taxonomyLoading}
          error={taxonomyError}
          selectedId={draft.categoryId}
          onSelect={(id) => change("categoryId", id)}
          onCreate={taxonomyClient && storeId ? async (input) => {
            const created = await taxonomyClient.createCategory(storeId, input);
            setTaxonomy((current) => current ? { ...current, categories: [...current.categories, created] } : current);
            return created;
          } : undefined}
        /></>} key={productId??"new"} draft={draft} onChange={change} categories={categoryPaths} brands={storeId ? repository.getBrands?.(storeId) ?? [] : []}
        extra={productId && api && storeId ? <Card title="Online store"><TemplatePicker api={api} storeId={storeId} resourceType="product" resourceId={productId} /></Card> : undefined} />
      <div className={`jk-builder-bar ${dirty ? "is-dirty" : ""}`}>
        <div className="jk-builder-save-state"><span role="status">{saving ? "Saving product…" : dirty ? "Unsaved changes" : justSaved ? "All changes saved" : productId ? "No unsaved changes" : "New product"}</span><small>{draft.archived ? "Archived · hidden from customers" : draft.published ? "Active · visible when saved" : "Draft · hidden from customers"}</small></div>
        <div className="jk-builder-save-actions">
          {dirty && <button type="button" className="jk-button" disabled={saving || uploading} onClick={discard}>Discard</button>}
          {!productId && <button type="button" className="jk-button" disabled={saving || uploading} onClick={() => void save(false)}>Save draft</button>}
          {productId && !draft.published && !draft.archived && <button type="submit" className="jk-button" disabled={saving || uploading}>Save changes</button>}
          <button type={canPublish ? "button" : "submit"} onClick={canPublish ? () => void save(true) : undefined} disabled={saving || uploading} className="jk-button jk-button-primary">
            {saving && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
            {canPublish ? "Publish product" : "Save changes"}
          </button>
        </div>
      </div>
      <Sheet open={previewOpen} onOpenChange={setPreviewOpen}><ProductSheetContent onCloseAutoFocus={event => { event.preventDefault(); previewTrigger.current?.focus(); }} className="jk-sheet overflow-y-auto">
        <SheetTitle>Shopper preview</SheetTitle><SheetDescription className="jk-muted">Try the options. Nothing is ordered.</SheetDescription>
        <BuyerPreview mediaEnabled={taggingEnabled} draft={draft} currency={currency} categoryLabel={category?.label} />
      </ProductSheetContent></Sheet>
    </form>
    {productId && <div className="mt-6"><DigitalProductSettings productId={productId} /></div>}
    {confirmation.dialog}
    </ProductSurface>
  );
}
