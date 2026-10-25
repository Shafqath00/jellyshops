"use client";

import Link from "next/link";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useShop } from "@/contexts/shop-context";
import { useAuth } from "@/features/auth/auth-provider";
import { catalogProductToStorefrontProduct } from "@/features/commerce/api/client";
import { createStoreEditorApi } from "@/features/store-editor/api/client";
import type { Product, ProductOption } from "@/lib/domain";
import type { DraftIssue } from "@/lib/product-builder";
import { BuyerPreview } from "./BuyerPreview";
import { draftToPayload, emptyDraft, hasVariantAxes, productToDraft, validateBuilderDraft, withOptions, type DraftErrors, type PersistedState, type ProductDraft } from "./draft";
import { BasicsSection } from "./sections/BasicsSection";
import { CategorySection } from "./sections/CategorySection";
import { ChoicesSection } from "./sections/ChoicesSection";
import { PricingSection } from "./sections/PricingSection";
import { VariantsSection } from "./sections/VariantsSection";
import { buildCategoryPaths, createTaxonomyClient, getCategoryTemplates, type Taxonomy } from "./taxonomy";

const API_URL = process.env.NEXT_PUBLIC_STORE_EDITOR_API_URL ?? "http://localhost:3001";
const FIELD_IDS: Record<keyof DraftErrors, string> = { title: "pb-title", description: "pb-description", imageUrl: "pb-title", categoryId: "pb-category-search", price: "pb-price", compareAtPrice: "pb-compare", sku: "pb-sku", stock: "pb-stock", published: "pb-published" };
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
  const start = useMemo(() => initial ? productToDraft(initial) : { draft: emptyDraft, persisted: NOTHING_SAVED }, [initial]);

  const [draft, setDraft] = useState<ProductDraft>(start.draft);
  const [persisted, setPersisted] = useState<PersistedState>(start.persisted);
  const [productId, setProductId] = useState<string | null>(initial?.id ?? null);
  const [errors, setErrors] = useState<DraftErrors>({});
  const [problems, setProblems] = useState<DraftIssue[]>([]);
  const [limitError, setLimitError] = useState("");
  const [taxonomy, setTaxonomy] = useState<Taxonomy | null>(null);
  const [taxonomyLoading, setTaxonomyLoading] = useState(Boolean(token && storeId));
  const [taxonomyError, setTaxonomyError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [justSaved, setJustSaved] = useState(false);
  const [dirty, setDirty] = useState(false);
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

  const change = useCallback(<K extends keyof ProductDraft>(field: K, value: ProductDraft[K]) => {
    setDraft((current) => ({ ...current, [field]: value }));
    setErrors((current) => (current[field as keyof DraftErrors] ? { ...current, [field]: undefined } : current));
    setDirty(true);
    setJustSaved(false);
  }, []);

  function changeOptions(options: ProductOption[]) {
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
      setPersisted({ ...saved, imageUrl: draft.imageUrl });
      // Adopt the server's variant ids so the next save updates these rows instead of adding new ones.
      if (hasVariantAxes(draft)) setDraft((current) => ({ ...current, variants: canonical.variants }));
      setProductId(result.id);
      setDirty(false);
      setJustSaved(true);
    } catch (caught) { setSaveError(caught instanceof Error ? caught.message : "Could not save this product."); }
    finally { setSaving(false); }
  }

  function startAnother() {
    setDraft(emptyDraft);
    setPersisted(NOTHING_SAVED);
    setProductId(null);
    setErrors({});
    setProblems([]);
    setLimitError("");
    setDirty(false);
    setJustSaved(false);
  }

  const upload = api && storeId ? async (file: File) => (await api.uploadMedia(storeId, file)).url : undefined;

  return (
    <form ref={form} noValidate onSubmit={(event) => { event.preventDefault(); void save(); }} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-5">
        {justSaved && (
          <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-border bg-muted/50 px-4 py-3 text-[11px] font-black text-success">
            <span className="flex items-center gap-2.5"><CheckCircle2 size={16} />Product saved successfully</span>
            <span className="flex gap-4 text-foreground">
              <Link href="/admin/products" className="underline">Back to products</Link>
              <button type="button" onClick={startAnother} className="underline">Add another</button>
            </span>
          </div>
        )}
        {saveError && <div role="alert" className="rounded-[18px] border border-tint-border bg-muted/50 px-4 py-3 text-[11px] font-bold text-tint-foreground">{saveError}</div>}
        {problems.length > 0 && (
          <div role="alert" tabIndex={-1} data-problems className="rounded-[18px] border border-tint-border bg-muted/50 px-4 py-3 text-[11px] font-bold text-tint-foreground">
            <p>Fix {problems.length === 1 ? "this" : "these"} before saving:</p>
            <ul className="mt-1 list-disc pl-5">{problems.map((problem, index) => <li key={`${problem.code}-${index}`}>{problem.message}</li>)}</ul>
          </div>
        )}

        <BasicsSection draft={draft} errors={errors} onChange={change} onUpload={upload} />
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
        {combinations && <VariantsSection options={draft.options} variants={draft.variants} currency={currency} onChange={(variants) => { setDraft((current) => ({ ...current, variants })); touch(); }} />}

        <div className="sticky bottom-0 -mx-1 flex flex-wrap items-center justify-end gap-3 border-t border-border bg-background/95 px-1 py-4 backdrop-blur">
          <label className="mr-auto flex items-center gap-2 text-[11px] font-bold text-muted-foreground" htmlFor="pb-published">
            <input id="pb-published" type="checkbox" checked={draft.published} onChange={(event) => change("published", event.target.checked)} />
            Show in my store
          </label>
          <button type="submit" disabled={saving} className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-6 text-[12px] font-black text-primary-foreground disabled:opacity-60">
            {saving && <Loader2 size={14} className="animate-spin" />}
            {productId ? "Save changes" : "Save product"}
          </button>
        </div>
      </div>

      <BuyerPreview draft={draft} currency={currency} categoryLabel={category?.label} />
    </form>
  );
}
