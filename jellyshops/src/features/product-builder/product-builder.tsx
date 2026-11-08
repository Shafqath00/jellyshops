"use client";

import Link from "next/link";
import { AdminCard, AdminPageHeader } from "@/components/admin-ui";
import { TemplatePicker } from "@/features/store-editor/components/template-picker";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { OrganizationSection } from "./sections/organization-section";
import { DigitalProductSettings } from "@/features/commerce/components/digital-product-settings";
import { isProductMediaEnabled, pruneMediaAssignments } from "@jelly/storefront-schema";
import { PhotosSection } from "./sections/photos-section";
import { CheckCircle2, Loader2 } from "lucide-react";
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

const API_URL = process.env.NEXT_PUBLIC_STORE_EDITOR_API_URL ?? "http://localhost:3001";
const FIELD_IDS: Record<keyof DraftErrors, string> = { title: "pb-title", description: "pb-description", imageUrl: "pb-title", categoryId: "pb-category-search", price: "pb-price", compareAtPrice: "pb-compare", cost: "pb-cost", unitPricing: "pb-unit-total", barcode: "pb-barcode", lowStockThreshold: "pb-low-stock", weight: "pb-weight", dimensions: "pb-length", hsCode: "pb-hs-code", handle: "pb-handle", sku: "pb-sku", stock: "pb-stock", published: "pb-published", personalisation: "pb-personalisation-missing" };
const NOTHING_SAVED: PersistedState = { variantIds: [], imageUrl: "" };

/**
 * Single-page product builder: basics, category, choices, combinations and price.
 * Pass `initial` to edit a saved product; otherwise it creates one.
 */
export function ProductBuilder({ initial }: { initial?: Product }) {
  const { repository } = useShop();
  const { session, activeStore } = useAuth();
  const token = session?.access_token;
  const storeId = activeStore?.id;
  const currency = activeStore?.currency ?? "INR";
  const api = useMemo(() => token ? createStoreEditorApi({ baseUrl: API_URL, token }) : null, [token]);
  const taxonomyClient = useMemo(() => token ? createTaxonomyClient({ baseUrl: API_URL, token }) : null, [token]);
  const metafieldsApi = useMemo(() => token ? createMetafieldsApi({ baseUrl: API_URL, token }) : null, [token]);
  const lookups = useMemo(() => token ? createLookups({ baseUrl: API_URL, token }) : null, [token]);
  const start = useMemo(() => initial ? productToDraft(initial) : { draft: { ...emptyDraft, media: [] }, persisted: { ...NOTHING_SAVED, media: [] } }, [initial]);

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

  function changeOptions(options: ProductOption[]) {
    const pruned = pruneMediaAssignments(draft.media ?? [], options);
    if (pruned.removedMediaIds.length && !window.confirm(`${pruned.removedMediaIds.length} photo(s) will be removed from this product because their last choice tag is being deleted. They stay in your library. Continue?`)) return;
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

  async function save() {
    setSaveError("");
    const { fields, problems: found } = validateBuilderDraft(draft);
    setErrors(fields);
    setProblems(found);
    const firstField = (Object.keys(fields) as Array<keyof DraftErrors>)[0];
    if (firstField) { form.current?.querySelector<HTMLElement>(`#${FIELD_IDS[firstField]}`)?.focus(); return; }
    if (found.length > 0) { form.current?.querySelector<HTMLElement>("[data-problems]")?.focus(); return; }
    if (!api || !storeId) { setSaveError("Sign in to your store before saving."); return; }
    setSaving(true);
    try {
      const payload = draftToPayload(draft, categoryName, persisted);
      const result = productId ? await api.updateProduct(storeId, productId, payload) : await api.createProduct(storeId, payload);
      const canonical = catalogProductToStorefrontProduct(result);
      repository.saveProduct(canonical);
      const saved = productToDraft(canonical).persisted;
      setPersisted({ ...saved, imageUrl: draft.imageUrl, media: canonical.media ?? draft.media });
      baseline.current = { draft: { ...draft, media: canonical.media ?? draft.media, ...(hasVariantAxes(draft) ? { variants: canonical.variants } : {}) }, persisted: { ...saved, imageUrl: draft.imageUrl, media: canonical.media ?? draft.media } };
      // Adopt the server's variant ids so the next save updates these rows instead of adding new ones.
      setDraft((current) => ({ ...current, media: canonical.media ?? current.media, ...(hasVariantAxes(draft) ? { variants: canonical.variants } : {}) }));
      // A new product gets its own address, so reloading the page edits it instead of creating another.
      if (!productId && typeof window !== "undefined" && window.location.pathname.startsWith("/admin/products")) window.history.replaceState(null, "", `/admin/products/${encodeURIComponent(result.id)}`);
      setProductId(result.id);
      // Custom data is stored apart from the product, so it is saved once the product and its combinations exist.
      const savedVariantIds: Record<string, string> = {};
      if (hasVariantAxes(draft)) for (const entry of draft.variants) {
        const match = canonical.variants.find((candidate) => createVariantCombinationKey(candidate.options ?? {}) === createVariantCombinationKey(entry.options ?? {}));
        if (match) savedVariantIds[entry.id] = match.id;
      }
      const custom = await metafields.saveAll({ productId: result.id, variantIds: savedVariantIds });
      if (custom.ok) { setDirty(false); setJustSaved(true); }
      else { setSaveError(`Your product was saved, but its custom data was not: ${custom.message}`); setDirty(true); setJustSaved(false); }
    } catch (caught) { setSaveError(caught instanceof Error ? caught.message : "Could not save this product."); }
    finally { setSaving(false); }
  }

  async function archive() {
    if (!api || !storeId || !productId || !window.confirm("Archive this product? It will be hidden from your store.")) return;
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

  function discard() {
    if (!window.confirm("Discard your unsaved changes?")) return;
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
    setDraft({ ...emptyDraft, media: [] });
    setPersisted(NOTHING_SAVED);
    baseline.current = { draft: { ...emptyDraft, media: [] }, persisted: NOTHING_SAVED };
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
    <>
    <form ref={form} aria-label="Product editor" noValidate onSubmit={(event) => { event.preventDefault(); void save(); }} className="admin-product-layout">
      <AdminPageHeader title={productId ? draft.title || "Edit product" : "Add product"} back="/admin/products" actions={<>
        <button type="button" className="admin-button" ref={previewTrigger} onClick={() => setPreviewOpen(true)}>Preview</button>
        {productId && <button type="button" className="admin-button" disabled={saving || dirty} title={dirty ? "Save your changes first" : undefined} onClick={() => void duplicate()}>Duplicate</button>}
        {productId && !draft.archived && <button type="button" className="admin-button" disabled={saving} onClick={() => void archive()}>Archive</button>}
      </>} />
      <div className="min-w-0 space-y-4">
        {justSaved && (
          <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-border bg-muted/50 px-4 py-3 text-[11px] font-black text-success">
            <span className="flex items-center gap-2.5"><CheckCircle2 size={16} />Product saved successfully</span>
            <span className="flex gap-4 text-foreground">
              <Link href="/admin/products" className="underline">Back to products</Link>
              <button type="button" onClick={startAnother} className="underline">Add another</button>
            </span>
          </div>
        )}
        {copy && <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-border bg-muted/50 px-4 py-3 text-[13px]">
          <span className="flex items-center gap-2.5"><CheckCircle2 size={16} className="text-success" />Copy saved as a draft.</span>
          <Link href={`/admin/products/${copy.id}`} className="underline">Open {copy.title}</Link>
        </div>}
        {saveError && <div role="alert" className="rounded-[18px] border border-tint-border bg-muted/50 px-4 py-3 text-[11px] font-bold text-tint-foreground">{saveError}</div>}
        {problems.length > 0 && (
          <div role="alert" tabIndex={-1} data-problems className="rounded-[18px] border border-tint-border bg-muted/50 px-4 py-3 text-[11px] font-bold text-tint-foreground">
            <p>Fix {problems.length === 1 ? "this" : "these"} before saving:</p>
            <ul className="mt-1 list-disc pl-5">{problems.map((problem, index) => <li key={`${problem.code}-${index}`}>{problem.message}</li>)}</ul>
          </div>
        )}

        <BasicsSection draft={draft} errors={errors} onChange={change} onUpload={upload} hidePhoto />
        <details className="admin-card"><summary className="cursor-pointer text-[13px]">Product specifications (optional)</summary><label className="admin-field mt-3">Specifications<textarea rows={4} maxLength={12000} value={draft.specificationsText??""} placeholder={"Material: Cotton\nCare: Machine wash cold"} onChange={event=>change("specificationsText",event.target.value)} /><small>One detail per line, for example Material: Cotton.</small></label></details>
        <PhotosSection media={draft.media ?? []} options={draft.options} taggingEnabled={taggingEnabled} onChange={(media) => { setDraft((current) => ({ ...current, media, imageUrl: media[0]?.url ?? "", variants: current.variants.map((variant) => variant.mediaId && !media.some((photo) => photo.id === variant.mediaId) ? { ...variant, mediaId: undefined } : variant) })); touch(); }} onBusy={setUploading} onDelete={api && storeId ? (mediaId) => api.deleteMedia(storeId, mediaId) : undefined} onUpload={api && storeId ? (file, progress) => api.uploadMedia(storeId, file, progress) : undefined} onList={api?.listMedia && storeId ? () => api.listMedia!(storeId) : undefined} />
        <CategorySection
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
        />
        <ChoicesSection options={draft.options} templates={templates} categoryName={categoryName} limitError={limitError} onChange={changeOptions} />
        <PricingSection draft={draft} errors={errors} currency={currency} hasCombinations={combinations} onChange={change} />
        <PersonalisationSection fields={draft.personalisation ?? []} onChange={(fields) => change("personalisation", fields)} />
        <ShippingSection draft={draft} errors={errors} hasCombinations={combinations} onChange={change} />
        {combinations && <VariantsSection photos={draft.media ?? []} physical={draft.physical} custom={metafields} customContext={metafieldContext} media={taggingEnabled ? draft.media : undefined} options={draft.options} variants={draft.variants} currency={currency} onChange={(variants) => { setDraft((current) => ({ ...current, variants })); touch(); }} />}

        {api && <MetafieldsSection state={metafields} context={metafieldContext} />}
        <SeoSection draft={draft} errors={errors} storeName={activeStore?.name ?? ""} storeSlug={activeStore?.slug ?? ""} saved={Boolean(productId) && draft.published} onChange={change} />

        <div className="admin-savebar">
          {dirty && <span role="status" className="mr-auto text-[13px] text-muted-foreground">Unsaved changes</span>}
          {dirty && <button type="button" className="admin-button" disabled={saving} onClick={discard}>Discard</button>}
          <button type="submit" disabled={saving || uploading} className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-4 text-[13px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-60">
            {saving && <Loader2 size={14} className="animate-spin" />}
            {productId ? "Save changes" : "Save product"}
          </button>
        </div>
      </div>

      <OrganizationSection key={productId??"new"} draft={draft} onChange={change} categories={categoryPaths} brands={storeId ? repository.getBrands?.(storeId) ?? [] : []}
        extra={productId && api && storeId ? <AdminCard title="Online store"><TemplatePicker api={api} storeId={storeId} resourceType="product" resourceId={productId} /></AdminCard> : undefined} />
      <Sheet open={previewOpen} onOpenChange={setPreviewOpen}><SheetContent onCloseAutoFocus={event => { event.preventDefault(); previewTrigger.current?.focus(); }} className="admin-shell admin-panel overflow-y-auto">
        <SheetTitle>Shopper preview</SheetTitle><SheetDescription>Try the options. Nothing is ordered.</SheetDescription>
        <BuyerPreview mediaEnabled={taggingEnabled} draft={draft} currency={currency} categoryLabel={category?.label} />
      </SheetContent></Sheet>
    </form>
    {productId && <div className="mt-6"><DigitalProductSettings productId={productId} /></div>}
    </>
  );
}
