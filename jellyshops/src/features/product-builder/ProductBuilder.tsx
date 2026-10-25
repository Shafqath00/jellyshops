"use client";

import Link from "next/link";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useShop } from "@/contexts/shop-context";
import { useAuth } from "@/features/auth/auth-provider";
import { catalogProductToStorefrontProduct } from "@/features/commerce/api/client";
import { createStoreEditorApi } from "@/features/store-editor/api/client";
import { BuyerPreview } from "./BuyerPreview";
import { draftToPayload, emptyDraft, validateSimpleDraft, type DraftErrors, type ProductDraft } from "./draft";
import { BasicsSection } from "./sections/BasicsSection";
import { CategorySection } from "./sections/CategorySection";
import { PricingSection } from "./sections/PricingSection";
import { buildCategoryPaths, createTaxonomyClient, type Taxonomy } from "./taxonomy";

const API_URL = process.env.NEXT_PUBLIC_STORE_EDITOR_API_URL ?? "http://localhost:3001";
const FIELD_IDS: Record<keyof ProductDraft, string> = { title: "pb-title", description: "pb-description", imageUrl: "pb-title", categoryId: "pb-category-search", price: "pb-price", compareAtPrice: "pb-compare", sku: "pb-sku", stock: "pb-stock", published: "pb-published" };

/** Single-page product builder. Phase 3: basics, category and price for simple products. */
export function ProductBuilder() {
  const { repository } = useShop();
  const { session, activeStore } = useAuth();
  const token = session?.access_token;
  const storeId = activeStore?.id;
  const currency = activeStore?.currency ?? "INR";
  const api = useMemo(() => token ? createStoreEditorApi({ baseUrl: API_URL, token }) : null, [token]);
  const taxonomyClient = useMemo(() => token ? createTaxonomyClient({ baseUrl: API_URL, token }) : null, [token]);

  const [draft, setDraft] = useState<ProductDraft>(emptyDraft);
  const [errors, setErrors] = useState<DraftErrors>({});
  const [taxonomy, setTaxonomy] = useState<Taxonomy | null>(null);
  const [taxonomyLoading, setTaxonomyLoading] = useState(Boolean(token && storeId));
  const [taxonomyError, setTaxonomyError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [savedId, setSavedId] = useState<string | null>(null);
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

  const change = useCallback(<K extends keyof ProductDraft>(field: K, value: ProductDraft[K]) => {
    setDraft((current) => ({ ...current, [field]: value }));
    setErrors((current) => (current[field] ? { ...current, [field]: undefined } : current));
    setDirty(true);
  }, []);

  const categoryPaths = useMemo(() => buildCategoryPaths(taxonomy?.categories ?? []), [taxonomy]);
  const category = categoryPaths.find((path) => path.id === draft.categoryId);

  async function save(status?: "ACTIVE" | "DRAFT") {
    setSaveError("");
    const found = validateSimpleDraft(draft);
    setErrors(found);
    const firstInvalid = (Object.keys(found) as Array<keyof ProductDraft>)[0];
    if (firstInvalid) { form.current?.querySelector<HTMLElement>(`#${FIELD_IDS[firstInvalid]}`)?.focus(); return; }
    if (!api || !storeId) { setSaveError("Sign in to your store before saving."); return; }
    const next = status ? { ...draft, published: status === "ACTIVE" } : draft;
    setSaving(true);
    try {
      const payload = draftToPayload(next, category?.names[category.names.length - 1]);
      const result = savedId ? await api.updateProduct(storeId, savedId, payload) : await api.createProduct(storeId, payload);
      repository.saveProduct(catalogProductToStorefrontProduct(result));
      setDraft(next);
      setSavedId(result.id);
      setDirty(false);
    } catch (caught) { setSaveError(caught instanceof Error ? caught.message : "Could not save this product."); }
    finally { setSaving(false); }
  }

  function startAnother() {
    setDraft(emptyDraft);
    setErrors({});
    setSavedId(null);
    setDirty(false);
  }

  const upload = api && storeId ? async (file: File) => (await api.uploadMedia(storeId, file)).url : undefined;

  return (
    <form ref={form} noValidate onSubmit={(event) => { event.preventDefault(); void save(); }} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-5">
        {savedId && !dirty && (
          <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-border bg-muted/50 px-4 py-3 text-[11px] font-black text-success">
            <span className="flex items-center gap-2.5"><CheckCircle2 size={16} />Product saved successfully</span>
            <span className="flex gap-4 text-foreground">
              <Link href="/admin/products" className="underline">Back to products</Link>
              <button type="button" onClick={startAnother} className="underline">Add another</button>
            </span>
          </div>
        )}
        {saveError && <div role="alert" className="rounded-[18px] border border-tint-border bg-muted/50 px-4 py-3 text-[11px] font-bold text-tint-foreground">{saveError}</div>}

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
        <PricingSection draft={draft} errors={errors} currency={currency} onChange={change} />

        <div className="sticky bottom-0 -mx-1 flex flex-wrap items-center justify-end gap-3 border-t border-border bg-background/95 px-1 py-4 backdrop-blur">
          <label className="mr-auto flex items-center gap-2 text-[11px] font-bold text-muted-foreground" htmlFor="pb-published">
            <input id="pb-published" type="checkbox" checked={draft.published} onChange={(event) => change("published", event.target.checked)} />
            Show in my store
          </label>
          <button type="submit" disabled={saving} className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-6 text-[12px] font-black text-primary-foreground disabled:opacity-60">
            {saving && <Loader2 size={14} className="animate-spin" />}
            {savedId ? "Save changes" : "Save product"}
          </button>
        </div>
      </div>

      <BuyerPreview draft={draft} currency={currency} categoryLabel={category?.label} />
    </form>
  );
}
