"use client";

import Image from "next/image";
import { CheckCircle2, ImageIcon, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { majorToMinor, minorToMajor, slugify, type CategoryOptionDefinition, type Product, type ProductOption, type ProductOptionValue } from "@/lib/domain";
import { useShop } from "@/contexts/shop-context";
import { useAuth } from "@/features/auth/auth-provider";
import { createStoreEditorApi } from "@/features/store-editor/api/client";
import { CreateCategoryDialog } from "./create-category-dialog";
import { ProductOptionsEditor } from "./product-options-editor";
import { ProductOrganizationPanel } from "./product-organization-panel";
import { cardClass, inputClass, labelClass } from "./product-form-styles";
import { reconcileProductVariants } from "@/lib/product-variants";
import { catalogProductToStorefrontProduct } from "@/features/commerce/api/client";

const API_URL = process.env.NEXT_PUBLIC_STORE_EDITOR_API_URL ?? "http://localhost:3001";
const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1486427944299-d1955d23e34d?auto=format&fit=crop&w=1200&q=85";
function parseSpecifications(value: string): Record<string, string> {
  return Object.fromEntries(value.split("\n").flatMap((line) => {
    const separator = line.indexOf(":");
    if (separator < 1) return [];
    const key = line.slice(0, separator).trim(); const content = line.slice(separator + 1).trim();
    return key && content ? [[key, content]] : [];
  }));
}

export function ProductForm({ product }: { product?: Product }) {
  const { repository, state } = useShop();
  const { session, activeStore } = useAuth();
  const storeId = activeStore?.id ?? state.activeStoreId;
  const token = session?.access_token;
  const api = useMemo(() => token ? createStoreEditorApi({ baseUrl: API_URL, token }) : null, [token]);
  const variant = product?.variants?.[0];
  const categories = repository.getCategories(storeId);
  const brands = repository.getBrands(storeId);
  const collections = repository.getCollections(storeId);
  const [name, setName] = useState(product?.name ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [specificationsText, setSpecificationsText] = useState(Object.entries(product?.specifications ?? {}).map(([key, value]) => `${key}: ${value}`).join("\n"));
  const [categoryId, setCategoryId] = useState(product?.primaryCategoryId ?? "");
  const [additionalCategoryIds, setAdditionalCategoryIds] = useState(product?.additionalCategoryIds ?? []);
  const [brandId, setBrandId] = useState(product?.brandId ?? "");
  const [collectionIds, setCollectionIds] = useState(product?.collectionIds ?? []);
  const [price, setPrice] = useState(minorToMajor(variant?.priceMinor ?? 0));
  const [compareAtPrice, setCompareAtPrice] = useState(minorToMajor(variant?.compareAtPriceMinor ?? 0));
  const [stock, setStock] = useState(String(variant?.stock ?? 0));
  const [sku, setSku] = useState(variant?.sku ?? "");
  const [imageUrl, setImageUrl] = useState(product?.imageUrl ?? FALLBACK_IMAGE);
  const [published, setPublished] = useState(product?.published ?? true);
  const [options, setOptions] = useState<ProductOption[]>(product?.options ?? []);
  const [showOptions, setShowOptions] = useState((product?.options?.length ?? 0) > 0);
  const [saved, setSaved] = useState(false), [saving, setSaving] = useState(false), [error, setError] = useState("");
  const [createOpen, setCreateOpen] = useState(false), [createName, setCreateName] = useState(""), [createParentId, setCreateParentId] = useState<string | undefined>(), [createError, setCreateError] = useState("");
  const [persistedProduct, setPersistedProduct] = useState(product);

  const updateOption = (id: string, patch: Partial<ProductOption>) => setOptions((items) => items.map((item) => item.id === id ? { ...item, ...patch } : item));
  const updateValue = (optionId: string, valueId: string, patch: Partial<ProductOptionValue>) => setOptions((items) => items.map((item) => item.id === optionId ? { ...item, values: item.values.map((value) => value.id === valueId ? { ...value, ...patch } : value) } : item));
  const selectPrimary = (id: string) => { setCategoryId(id); setAdditionalCategoryIds((ids) => ids.filter((item) => item !== id)); repository.recordRecentCategory(storeId, id); };
  const addAdditional = (id: string) => setAdditionalCategoryIds((ids) => id === categoryId || ids.includes(id) ? ids : [...ids, id]);
  const openCreate = (parentId?: string) => { setCreateParentId(parentId); setCreateName(""); setCreateError(""); setCreateOpen(true); };
  const createCategory = () => { try { if (!createName.trim()) { setCreateError("Enter a category name."); return; } const category = repository.createCategory({ storeId, name: createName, ...(createParentId ? { parentId: createParentId } : {}) }); selectPrimary(category.id); setCreateOpen(false); } catch (caught) { setCreateError(caught instanceof Error ? caught.message.replaceAll("_", " ") : "Unable to create category."); } };
  const addRecommended = (definitions: CategoryOptionDefinition[]) => { setShowOptions(true); setOptions((items) => { const names = new Set(items.map((item) => item.name.trim().toLowerCase())); return [...items, ...definitions.filter((definition) => !names.has(definition.name.trim().toLowerCase())).map((definition, index) => ({ id: `option-${crypto.randomUUID()}`, name: definition.name, type: definition.optionKind, display: definition.displayType, required: definition.required, position: items.length + index, values: [] }))]; }); };

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    const priceMinor = majorToMinor(price), stockValue = Number(stock);
    if (!name.trim()) return setError("Add a product name before saving.");
    if (!Number.isFinite(priceMinor) || priceMinor < 0) return setError("Base price must be zero or greater.");
    if (!Number.isInteger(stockValue) || stockValue < 0) return setError("Stock cannot be negative.");
    const compareAtMinor = compareAtPrice.trim() ? majorToMinor(compareAtPrice) : 0;
    if (!Number.isFinite(compareAtMinor) || compareAtMinor < 0) return setError("Compare-at price must be zero or greater.");
    const specifications = parseSpecifications(specificationsText);
    const cleanOptions = options.map((option) => ({ ...option, name: option.name.trim(), values: option.values.map((value) => ({ ...value, label: value.label.trim() })) }));
    if (cleanOptions.some((option) => !option.name || option.values.some((value) => !value.label))) return setError("Every option needs a name and non-empty values.");
    const selectedCategory = categories.find((category) => category.id === categoryId);
    const id = persistedProduct?.id ?? `product-${crypto.randomUUID()}`;
    const inventoryOptionIds = cleanOptions.filter((option) => option.type === "variant").map((option) => option.id);
    const reconciled = reconcileProductVariants({ options: cleanOptions, inventoryOptionIds, variants: persistedProduct?.variants ?? [{ id: variant?.id ?? `${id}-variant-1`, name: "Standard", sku, priceMinor, stock: stockValue, options: {} }], basePriceMinor: priceMinor, defaultStock: stockValue, updateStandard: true, standardSku: sku });
    if (reconciled.error) return setError(reconciled.error);
    const slug = product?.slug ? slugify(product.slug) : slugify(name.trim());
    const local: Product = { id, storeId, name: name.trim(), slug, description: description.trim(), specifications, category: selectedCategory?.name ?? "Other", imageUrl, published, archived: false, featured: product?.featured ?? false, primaryCategoryId: categoryId || undefined, additionalCategoryIds: additionalCategoryIds.filter((item) => item !== categoryId), brandId: brandId || undefined, collectionIds, options: cleanOptions, inventoryOptionIds, variants: reconciled.variants };
    setSaving(true);
    try {
      if (!api || !activeStore) throw new Error("Select your authenticated store before saving.");
      const payload = { imageUrl: local.imageUrl, handle: local.slug, title: local.name, description: local.description, specifications: local.specifications, productType: local.category, status: published ? "ACTIVE" as const : "DRAFT" as const, primaryCategoryId: local.primaryCategoryId, additionalCategoryIds: local.additionalCategoryIds, brandId: local.brandId, collectionIds: local.collectionIds, categoryMetadata: selectedCategory ?? null, brandMetadata: brands.find((item) => item.id === brandId) ?? null, collectionMetadata: collectionIds.map((collectionId) => collections.find((item) => item.id === collectionId)).filter(Boolean), options: local.options, inventoryOptionIds: local.inventoryOptionIds, variants: local.variants.map((item) => ({ ...(persistedProduct?.variants.some((existing) => existing.id === item.id) ? { id: item.id } : {}), title: item.name, sku: item.sku || undefined, priceMinor: item.priceMinor, compareAtPriceMinor: !cleanOptions.length && item.id === reconciled.variants[0]?.id && compareAtMinor > 0 ? compareAtMinor : item.compareAtPriceMinor ?? null, quantity: item.stock, trackInventory: true, options: item.options })) };
      const result = persistedProduct?.id ? await api.updateProduct(activeStore.id, persistedProduct.id, payload) : await api.createProduct(activeStore.id, payload);
      const canonical = catalogProductToStorefrontProduct(result);
      repository.saveProduct(canonical);
      setPersistedProduct(canonical);
      setSaved(true);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to save this product."); }
    finally { setSaving(false); }
  }

  return (
    <form
      onSubmit={submit}
      onChange={() => setSaved(false)}
      className="space-y-5"
    >
      {saved && (
        <div
          role="status"
          className="flex items-center gap-2.5 rounded-[18px] border border-border bg-muted/50 px-4 py-3 text-[11px] font-black text-success"
        >
          <CheckCircle2 size={16} />
          Product saved successfully
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-[18px] border border-tint-border bg-muted/50 px-4 py-3 text-[11px] font-bold text-tint-foreground"
        >
          {error}
        </div>
      )}

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_350px]">
        {/* MAIN COLUMN */}
        <div className="min-w-0 space-y-5">

          {/* PRODUCT INFORMATION */}
          <section className={cardClass}>
            <div className="border-b border-black/[0.055] px-5 py-4 sm:px-6">
              <h2 className="text-[15px] font-black tracking-[-0.02em] text-foreground">
                Product information
              </h2>
              <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                Give your product a clear name and description.
              </p>
            </div>

            <div className="space-y-5 p-5 sm:p-6">
              <label className="block">
                <span className={labelClass}>Product name</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className={inputClass}
                  placeholder="e.g. Oversized Cotton T-Shirt"
                />
              </label>

              <label className="block">
                <div className="flex items-center justify-between">
                  <span className={labelClass}>Description</span>
                  <span className="text-[9px] font-semibold text-muted-foreground">
                    Customer facing
                  </span>
                </div>

                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={6}
                  placeholder="Describe materials, features, fit, care information, or anything customers should know."
                  className="mt-2 w-full resize-y rounded-[16px] border border-black/[0.08] bg-muted/50 px-3.5 py-3 text-[12px] font-medium leading-6 text-foreground outline-none transition placeholder:text-muted-foreground hover:border-black/[0.13] focus:border-tint-border focus:bg-white focus:ring-4 focus:ring-ring/40"
                />
              </label>
              <label className="block">
                <span className={labelClass}>Product specifications</span>
                <textarea value={specificationsText} onChange={(event) => setSpecificationsText(event.target.value)} rows={4} maxLength={12000} placeholder={"Material: Cotton\nCare: Machine wash cold"} className="mt-2 w-full resize-y rounded-[16px] border border-black/[0.08] bg-muted/50 px-3.5 py-3 text-[12px] font-medium leading-6 text-foreground outline-none focus:border-tint-border focus:ring-4 focus:ring-ring/40" />
                <small className="mt-1 block text-[10px] text-muted-foreground">Use one label and value per line, separated by a colon.</small>
              </label>
            </div>
          </section>

          {/* MEDIA */}
          <section className={cardClass}>
            <div className="flex items-center justify-between border-b border-black/[0.055] px-5 py-4 sm:px-6">
              <div>
                <h2 className="text-[15px] font-black tracking-[-0.02em] text-foreground">
                  Media
                </h2>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Add a clear product image for your storefront.
                </p>
              </div>
            </div>

            <div className="p-5 sm:p-6">
              <div className="grid gap-5 sm:grid-cols-[180px_minmax(0,1fr)]">
                <div className="group relative aspect-[4/5] overflow-hidden rounded-[22px] border border-black/[0.06] bg-muted">
                  {imageUrl ? (
                    <Image
                      src={imageUrl}
                      alt={name || "Product preview"}
                      fill
                      sizes="180px"
                      className="object-cover transition duration-300 group-hover:scale-[1.02]"
                    />
                  ) : (
                    <div className="grid h-full place-items-center text-muted-foreground">
                      <ImageIcon size={24} />
                    </div>
                  )}

                  <div className="absolute left-2 top-2 rounded-full bg-card/90 px-2 py-1 text-[8px] font-black uppercase tracking-[0.1em] text-muted-foreground shadow-sm backdrop-blur">
                    Primary
                  </div>
                </div>

                <div className="flex min-w-0 flex-col justify-center">
                  <label>
                    <span className={labelClass}>Image URL</span>
                    <input
                      type="url"
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      className={inputClass}
                      placeholder="https://..."
                    />
                  </label>

                  <div className="mt-4 rounded-[16px] border border-dashed border-border bg-muted/50 px-4 py-4">
                    <p className="text-[11px] font-black text-muted-foreground">
                      Product media
                    </p>
                    <p className="mt-1 text-[10px] leading-5 text-muted-foreground">
                      Multiple product and variant images can be added here when
                      your media model is enabled.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* PRICING */}
          <section className={cardClass}>
            <div className="border-b border-black/[0.055] px-5 py-4 sm:px-6">
              <h2 className="text-[15px] font-black tracking-[-0.02em] text-foreground">
                Pricing & inventory
              </h2>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Set the base selling price and inventory information.
              </p>
            </div>

            <div className="p-5 sm:p-6">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <label>
                  <span className={labelClass}>Base price</span>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      className={`${inputClass} pl-8`}
                    />
                    <span className="pointer-events-none absolute left-3 top-[21px] text-[11px] font-black text-muted-foreground">
                      {new Intl.NumberFormat("en", { style: "currency", currency: activeStore?.currency ?? "INR", maximumFractionDigits: 0 }).formatToParts(0).find((part) => part.type === "currency")?.value ?? "¤"}
                    </span>
                  </div>
                </label>

                <label>
                  <span className={labelClass}>Compare-at price</span>
                  <input type="number" min="0" step="0.01" value={compareAtPrice} onChange={(event) => setCompareAtPrice(event.target.value)} className={inputClass} placeholder="Optional" />
                </label>

                <label>
                  <span className={labelClass}>Stock</span>
                  <input
                    type="number"
                    min="0"
                    value={stock}
                    onChange={(e) => setStock(e.target.value)}
                    className={inputClass}
                    placeholder="0"
                  />
                </label>

                <label>
                  <span className={labelClass}>SKU</span>
                  <input
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    className={inputClass}
                    placeholder="JS-001"
                  />
                </label>
              </div>
            </div>
          </section>

          <ProductOptionsEditor options={options} showOptions={showOptions} setOptions={setOptions} setShowOptions={setShowOptions} updateOption={updateOption} updateValue={updateValue} />
        </div>

        {/* SIDEBAR */}
        <aside className="space-y-5 xl:sticky xl:top-6">

          {/* STATUS */}
          <section className={cardClass}>
            <div className="border-b border-black/[0.055] px-5 py-4">
              <h2 className="text-[14px] font-black text-foreground">
                Status
              </h2>
            </div>

            <div className="p-5">
              <label className="flex cursor-pointer items-center justify-between rounded-[16px] border border-black/[0.06] bg-muted/50 px-4 py-3.5">
                <div>
                  <p className="text-[11px] font-black text-foreground">
                    Publish in storefront
                  </p>
                  <p className="mt-0.5 text-[9px] leading-4 text-muted-foreground">
                    Customers can see this product.
                  </p>
                </div>

                <span
                  className={`relative h-6 w-11 rounded-full transition ${published ? "bg-primary" : "bg-muted"
                    }`}
                >
                  <input
                    type="checkbox"
                    checked={published}
                    onChange={(e) => setPublished(e.target.checked)}
                    className="sr-only"
                  />

                  <span
                    className={`absolute top-1 size-4 rounded-full bg-card shadow-sm transition ${published ? "left-6" : "left-1"
                      }`}
                  />
                </span>
              </label>

              <div className="mt-3 flex items-center gap-2 px-1 text-[9px] font-black uppercase tracking-[0.1em] text-muted-foreground">
                <span
                  className={`size-2 rounded-full ${published ? "bg-success/15" : "bg-secondary"
                    }`}
                />
                {published ? "Active" : "Draft"}
              </div>
            </div>
          </section>

          <ProductOrganizationPanel repository={repository} state={state} storeId={storeId} categories={categories} brands={brands} collections={collections} categoryId={categoryId} additionalCategoryIds={additionalCategoryIds} brandId={brandId} collectionIds={collectionIds} options={options} selectPrimary={selectPrimary} openCreate={openCreate} addAdditional={addAdditional} addRecommended={addRecommended} setAdditionalCategoryIds={setAdditionalCategoryIds} setBrandId={setBrandId} setCollectionIds={setCollectionIds} />
        </aside>
      </div>

      {/* CREATE CATEGORY DIALOG */}
      {createOpen && (
        <CreateCategoryDialog createName={createName} setCreateName={setCreateName} createParentId={createParentId} createError={createError} categories={categories} onCancel={() => setCreateOpen(false)} onCreate={createCategory} />
      )}

      {/* SAVE BAR */}
      <div className="sticky bottom-4 z-20">
        <div className="ml-auto flex w-fit items-center gap-3 rounded-full border border-black/[0.07] bg-card/95 p-1.5 pl-4 shadow-[0_14px_40px_rgba(58,40,45,0.14)] backdrop-blur">
          <span className="hidden text-[9px] font-bold text-muted-foreground sm:block">
            {published ? "Ready for storefront" : "Saving as draft"}
          </span>

          <button
            type="submit"
            disabled={saving}
            className="inline-flex h-10 min-w-36 items-center justify-center gap-2 rounded-full bg-primary px-5 text-[10px] font-black text-primary-foreground shadow-[0_5px_18px_rgba(41,36,38,0.16)] transition hover:-translate-y-px hover:bg-primary disabled:pointer-events-none disabled:opacity-50"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {saving ? "Saving…" : product ? "Save changes" : "Save product"}
          </button>
        </div>
      </div>
    </form>
  );
}
