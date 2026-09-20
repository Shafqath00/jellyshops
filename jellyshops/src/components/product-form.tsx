"use client";

import Image from "next/image";
import { CheckCircle2, ImageIcon, Loader2, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { getCategoryBreadcrumb, majorToMinor, minorToMajor, slugify, type CategoryOptionDefinition, type Product, type ProductOption, type ProductOptionDisplay, type ProductOptionKind, type ProductOptionValue } from "@/lib/domain";
import { useShop } from "@/contexts/shop-context";
import { useAuth } from "@/features/auth/auth-provider";
import { createStoreEditorApi } from "@/features/store-editor/api/client";
import { ProductCategoryPicker } from "@/components/product-category-picker";
import { CategoryRecommendations } from "@/components/category-recommendations";
import { reconcileProductVariants } from "@/lib/product-variants";

const API_URL = process.env.NEXT_PUBLIC_STORE_EDITOR_API_URL ?? "http://localhost:3001";
const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1486427944299-d1955d23e34d?auto=format&fit=crop&w=1200&q=85";
const inputClass = "mt-2 h-11 w-full rounded-xl border border-black/[0.09] bg-white px-3.5 text-[12px] font-semibold text-[#342d2f] outline-none focus:border-[#d39aaa] focus:ring-4 focus:ring-[#ff8da4]/10";
const labelClass = "text-[10px] font-black uppercase tracking-[0.08em] text-[#7f7476]";
const cardClass = "rounded-[24px] border border-black/[0.06] bg-white p-5 shadow-[0_14px_44px_rgba(83,61,66,0.05)] sm:p-6";
const newOption = (position: number): ProductOption => ({ id: `option-${crypto.randomUUID()}`, name: "", type: "configuration", display: "buttons", required: false, position, values: [] });
const newValue = (position: number): ProductOptionValue => ({ id: `value-${crypto.randomUUID()}`, label: "", priceAdjustmentMinor: 0, position });

export function ProductForm({ product }: { product?: Product }) {
  const { repository, state } = useShop();
  const { session, activeStore } = useAuth();
  const storeId = activeStore?.id ?? state.activeStoreId;
  const api = useMemo(() => session?.access_token ? createStoreEditorApi({ baseUrl: API_URL, token: session.access_token }) : null, [session?.access_token]);
  const variant = product?.variants?.[0];
  const categories = repository.getCategories(storeId);
  const brands = repository.getBrands(storeId);
  const collections = repository.getCollections(storeId);
  const [name, setName] = useState(product?.name ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [categoryId, setCategoryId] = useState(product?.primaryCategoryId ?? "");
  const [additionalCategoryIds, setAdditionalCategoryIds] = useState(product?.additionalCategoryIds ?? []);
  const [brandId, setBrandId] = useState(product?.brandId ?? "");
  const [collectionIds, setCollectionIds] = useState(product?.collectionIds ?? []);
  const [price, setPrice] = useState(minorToMajor(variant?.priceMinor ?? 0));
  const [stock, setStock] = useState(String(variant?.stock ?? 0));
  const [sku, setSku] = useState(variant?.sku ?? "");
  const [imageUrl, setImageUrl] = useState(product?.imageUrl ?? FALLBACK_IMAGE);
  const [published, setPublished] = useState(product?.published ?? true);
  const [options, setOptions] = useState<ProductOption[]>(product?.options ?? []);
  const [showOptions, setShowOptions] = useState((product?.options?.length ?? 0) > 0);
  const [saved, setSaved] = useState(false), [saving, setSaving] = useState(false), [error, setError] = useState("");
  const [createOpen, setCreateOpen] = useState(false), [createName, setCreateName] = useState(""), [createParentId, setCreateParentId] = useState<string | undefined>(), [createError, setCreateError] = useState("");

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
    const cleanOptions = options.map((option) => ({ ...option, name: option.name.trim(), values: option.values.map((value) => ({ ...value, label: value.label.trim() })) }));
    if (cleanOptions.some((option) => !option.name || option.values.some((value) => !value.label))) return setError("Every option needs a name and non-empty values.");
    const selectedCategory = categories.find((category) => category.id === categoryId);
    const id = product?.id ?? `product-${crypto.randomUUID()}`;
    const inventoryOptionIds = cleanOptions.filter((option) => option.type === "variant").map((option) => option.id);
    const reconciled = reconcileProductVariants({ options: cleanOptions, inventoryOptionIds, variants: product?.variants ?? [{ id: variant?.id ?? `${id}-variant-1`, name: "Standard", sku, priceMinor, stock: stockValue, options: {} }], basePriceMinor: priceMinor, defaultStock: stockValue });
    if (reconciled.error) return setError(reconciled.error);
    const slug = product?.slug ? slugify(product.slug) : slugify(name.trim());
    const local: Product = { id, storeId, name: name.trim(), slug, description: description.trim(), category: selectedCategory?.name ?? "Other", imageUrl, published, archived: false, featured: product?.featured ?? false, primaryCategoryId: categoryId || undefined, additionalCategoryIds: additionalCategoryIds.filter((item) => item !== categoryId), brandId: brandId || undefined, collectionIds, options: cleanOptions, inventoryOptionIds, variants: reconciled.variants };
    setSaving(true);
    try { repository.saveProduct(local); if (api && activeStore) { const payload = { handle: local.slug, title: local.name, description: local.description, productType: local.category, status: published ? "ACTIVE" as const : "DRAFT" as const, primaryCategoryId: local.primaryCategoryId, additionalCategoryIds: local.additionalCategoryIds, brandId: local.brandId, collectionIds: local.collectionIds, categoryMetadata: selectedCategory ?? null, brandMetadata: brands.find((item) => item.id === brandId) ?? null, collectionMetadata: collectionIds.map((id) => collections.find((item) => item.id === id)).filter(Boolean), options: local.options, inventoryOptionIds: local.inventoryOptionIds, variants: local.variants.map((item) => ({ ...(item.id ? { id: item.id } : {}), title: item.name, sku: item.sku || undefined, priceMinor: item.priceMinor, quantity: item.stock, trackInventory: true, options: item.options })) }; product?.id ? await api.updateProduct(activeStore.id, product.id, payload) : await api.createProduct(activeStore.id, payload); } setSaved(true); } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to save this product."); } finally { setSaving(false); }
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
          className="flex items-center gap-2.5 rounded-[18px] border border-[#dce8b8] bg-[#f7faed] px-4 py-3 text-[11px] font-black text-[#65712f]"
        >
          <CheckCircle2 size={16} />
          Product saved successfully
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-[18px] border border-[#efced5] bg-[#fff5f7] px-4 py-3 text-[11px] font-bold text-[#9a5365]"
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
              <h2 className="text-[15px] font-black tracking-[-0.02em] text-[#30292b]">
                Product information
              </h2>
              <p className="mt-1 text-[11px] leading-5 text-[#93878a]">
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
                  <span className="text-[9px] font-semibold text-[#aaa0a2]">
                    Customer facing
                  </span>
                </div>

                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={6}
                  placeholder="Describe materials, features, fit, care information, or anything customers should know."
                  className="mt-2 w-full resize-y rounded-[16px] border border-black/[0.08] bg-[#fffdfc] px-3.5 py-3 text-[12px] font-medium leading-6 text-[#352e30] outline-none transition placeholder:text-[#b8adaf] hover:border-black/[0.13] focus:border-[#cf8fa0] focus:bg-white focus:ring-4 focus:ring-[#e8a9b8]/10"
                />
              </label>
            </div>
          </section>

          {/* MEDIA */}
          <section className={cardClass}>
            <div className="flex items-center justify-between border-b border-black/[0.055] px-5 py-4 sm:px-6">
              <div>
                <h2 className="text-[15px] font-black tracking-[-0.02em] text-[#30292b]">
                  Media
                </h2>
                <p className="mt-1 text-[11px] text-[#93878a]">
                  Add a clear product image for your storefront.
                </p>
              </div>
            </div>

            <div className="p-5 sm:p-6">
              <div className="grid gap-5 sm:grid-cols-[180px_minmax(0,1fr)]">
                <div className="group relative aspect-[4/5] overflow-hidden rounded-[22px] border border-black/[0.06] bg-[#f5f0ee]">
                  {imageUrl ? (
                    <Image
                      src={imageUrl}
                      alt={name || "Product preview"}
                      fill
                      sizes="180px"
                      className="object-cover transition duration-300 group-hover:scale-[1.02]"
                    />
                  ) : (
                    <div className="grid h-full place-items-center text-[#b1a6a8]">
                      <ImageIcon size={24} />
                    </div>
                  )}

                  <div className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-1 text-[8px] font-black uppercase tracking-[0.1em] text-[#64595c] shadow-sm backdrop-blur">
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

                  <div className="mt-4 rounded-[16px] border border-dashed border-[#dfcbd0] bg-[#fff9fa] px-4 py-4">
                    <p className="text-[11px] font-black text-[#554a4d]">
                      Product media
                    </p>
                    <p className="mt-1 text-[10px] leading-5 text-[#96898c]">
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
              <h2 className="text-[15px] font-black tracking-[-0.02em] text-[#30292b]">
                Pricing & inventory
              </h2>
              <p className="mt-1 text-[11px] text-[#93878a]">
                Set the base selling price and inventory information.
              </p>
            </div>

            <div className="p-5 sm:p-6">
              <div className="grid gap-4 sm:grid-cols-3">
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
                    <span className="pointer-events-none absolute left-3 top-[21px] text-[11px] font-black text-[#988c8f]">
                      ₹
                    </span>
                  </div>
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

          {/* PRODUCT OPTIONS */}
          <section className={cardClass}>
            <div className="flex flex-col gap-3 border-b border-black/[0.055] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div>
                <h2 className="text-[15px] font-black tracking-[-0.02em] text-[#30292b]">
                  Product options
                </h2>

                <p className="mt-1 text-[11px] leading-5 text-[#93878a]">
                  Add sizes, colours, configurations, or add-ons.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowOptions(true);
                  setOptions((items) => [
                    ...items,
                    newOption(items.length),
                  ]);
                }}
                className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-full border border-[#eed8de] bg-[#fff6f8] px-3.5 text-[10px] font-black text-[#9b5968] transition hover:border-[#dfb9c3] hover:bg-[#ffedf1]"
              >
                <Plus size={13} />
                Add option
              </button>
            </div>

            {!showOptions || options.length === 0 ? (
              <div className="p-5 sm:p-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowOptions(true);
                    setOptions((items) => [
                      ...items,
                      newOption(items.length),
                    ]);
                  }}
                  className="group flex w-full flex-col items-center justify-center rounded-[20px] border border-dashed border-[#dfcbd0] bg-[#fffafa] px-5 py-10 text-center transition hover:border-[#d3a6b1] hover:bg-[#fff6f8]"
                >
                  <span className="grid size-10 place-items-center rounded-full bg-[#fff0f3] text-[#a45e70] transition group-hover:scale-105">
                    <Plus size={17} />
                  </span>

                  <span className="mt-3 text-[12px] font-black text-[#443a3d]">
                    Add product options
                  </span>

                  <span className="mt-1 max-w-sm text-[10px] leading-5 text-[#978b8e]">
                    Use options for size, colour, storage, material, add-ons, and
                    other customer choices.
                  </span>
                </button>
              </div>
            ) : (
              <div className="space-y-4 p-5 sm:p-6">
                {options.map((option, optionIndex) => (
                  <div
                    key={option.id}
                    className="overflow-hidden rounded-[20px] border border-black/[0.065] bg-[#fffdfc]"
                  >
                    <div className="flex items-center justify-between border-b border-black/[0.055] bg-[#fcf9f8] px-4 py-3.5">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="grid size-6 place-items-center rounded-full bg-[#f3e9eb] text-[9px] font-black text-[#9b5968]">
                            {optionIndex + 1}
                          </span>

                          <p className="text-[12px] font-black text-[#3a3234]">
                            {option.name || "New option"}
                          </p>
                        </div>

                        <p className="ml-8 mt-0.5 text-[9px] font-semibold capitalize text-[#998d90]">
                          {option.type === "variant"
                            ? "Inventory variant"
                            : option.type}
                        </p>
                      </div>

                      <button
                        type="button"
                        aria-label="Remove option"
                        onClick={() =>
                          setOptions((items) =>
                            items.filter((item) => item.id !== option.id),
                          )
                        }
                        className="grid size-8 place-items-center rounded-full text-[#a35467] transition hover:bg-[#fff0f3]"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    <div className="p-4">
                      <div className="grid gap-3 lg:grid-cols-3">
                        <label>
                          <span className={labelClass}>Option name</span>
                          <input
                            value={option.name}
                            onChange={(e) =>
                              updateOption(option.id, {
                                name: e.target.value,
                              })
                            }
                            className={inputClass}
                            placeholder="e.g. Size"
                          />
                        </label>

                        <label>
                          <span className={labelClass}>Used for</span>
                          <select
                            value={option.type}
                            onChange={(e) =>
                              updateOption(option.id, {
                                type: e.target.value as ProductOptionKind,
                              })
                            }
                            className={inputClass}
                          >
                            <option value="variant">
                              Inventory variant
                            </option>
                            <option value="configuration">
                              Configuration
                            </option>
                            <option value="addon">Add-on</option>
                          </select>
                        </label>

                        <label>
                          <span className={labelClass}>Display as</span>
                          <select
                            value={option.display}
                            onChange={(e) =>
                              updateOption(option.id, {
                                display:
                                  e.target.value as ProductOptionDisplay,
                              })
                            }
                            className={inputClass}
                          >
                            <option value="buttons">Buttons</option>
                            <option value="dropdown">Dropdown</option>
                            <option value="color">Colour swatches</option>
                            <option value="image">Image cards</option>
                          </select>
                        </label>
                      </div>

                      <label className="mt-4 inline-flex items-center gap-2 text-[10px] font-black text-[#756a6d]">
                        <input
                          type="checkbox"
                          checked={option.required}
                          onChange={(e) =>
                            updateOption(option.id, {
                              required: e.target.checked,
                            })
                          }
                          className="size-4 rounded border-black/10 accent-[#9b5968]"
                        />
                        Customers must choose an option
                      </label>

                      <div className="mt-5">
                        <div className="mb-2 flex items-center justify-between">
                          <span className={labelClass}>Values</span>
                          <span className="text-[9px] font-semibold text-[#aaa0a2]">
                            {option.values.length} values
                          </span>
                        </div>

                        <div className="space-y-2">
                          {option.values.map((value, valueIndex) => (
                            <div
                              key={value.id}
                              className="grid items-end gap-2 rounded-[14px] border border-black/[0.055] bg-white p-3 sm:grid-cols-[32px_minmax(0,1fr)_145px_34px]"
                            >
                              <div className="hidden size-8 items-center justify-center rounded-[10px] bg-[#f5f0ee] text-[9px] font-black text-[#8f8386] sm:flex">
                                {valueIndex + 1}
                              </div>

                              <label>
                                <span className={labelClass}>Value</span>
                                <input
                                  value={value.label}
                                  onChange={(e) =>
                                    updateValue(option.id, value.id, {
                                      label: e.target.value,
                                    })
                                  }
                                  className={inputClass}
                                  placeholder="e.g. Black"
                                />
                              </label>

                              <label>
                                <span className={labelClass}>Price change</span>
                                <div className="relative">
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={minorToMajor(
                                      value.priceAdjustmentMinor,
                                    )}
                                    onChange={(e) =>
                                      updateValue(option.id, value.id, {
                                        priceAdjustmentMinor:
                                          majorToMinor(e.target.value) || 0,
                                      })
                                    }
                                    className={`${inputClass} pl-7`}
                                  />
                                  <span className="pointer-events-none absolute left-2.5 top-[21px] text-[10px] font-black text-[#9d9294]">
                                    ₹
                                  </span>
                                </div>
                              </label>

                              <button
                                type="button"
                                aria-label="Remove value"
                                onClick={() =>
                                  updateOption(option.id, {
                                    values: option.values.filter(
                                      (item) => item.id !== value.id,
                                    ),
                                  })
                                }
                                className="mb-1 grid size-8 place-items-center rounded-full text-[#aa6071] transition hover:bg-[#fff0f3]"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          ))}
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            updateOption(option.id, {
                              values: [
                                ...option.values,
                                newValue(option.values.length),
                              ],
                            })
                          }
                          className="mt-3 inline-flex items-center gap-1.5 rounded-full px-1 py-1 text-[10px] font-black text-[#9b5968]"
                        >
                          <Plus size={12} />
                          Add value
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* SIDEBAR */}
        <aside className="space-y-5 xl:sticky xl:top-6">

          {/* STATUS */}
          <section className={cardClass}>
            <div className="border-b border-black/[0.055] px-5 py-4">
              <h2 className="text-[14px] font-black text-[#30292b]">
                Status
              </h2>
            </div>

            <div className="p-5">
              <label className="flex cursor-pointer items-center justify-between rounded-[16px] border border-black/[0.06] bg-[#fcfaf9] px-4 py-3.5">
                <div>
                  <p className="text-[11px] font-black text-[#403739]">
                    Publish in storefront
                  </p>
                  <p className="mt-0.5 text-[9px] leading-4 text-[#95898c]">
                    Customers can see this product.
                  </p>
                </div>

                <span
                  className={`relative h-6 w-11 rounded-full transition ${published ? "bg-[#30292b]" : "bg-[#ded6d4]"
                    }`}
                >
                  <input
                    type="checkbox"
                    checked={published}
                    onChange={(e) => setPublished(e.target.checked)}
                    className="sr-only"
                  />

                  <span
                    className={`absolute top-1 size-4 rounded-full bg-white shadow-sm transition ${published ? "left-6" : "left-1"
                      }`}
                  />
                </span>
              </label>

              <div className="mt-3 flex items-center gap-2 px-1 text-[9px] font-black uppercase tracking-[0.1em] text-[#93878a]">
                <span
                  className={`size-2 rounded-full ${published ? "bg-[#b8cb65]" : "bg-[#cfc6c4]"
                    }`}
                />
                {published ? "Active" : "Draft"}
              </div>
            </div>
          </section>

          {/* ORGANIZATION */}
          <section className={cardClass}>
            <div className="border-b border-black/[0.055] px-5 py-4">
              <h2 className="text-[14px] font-black text-[#30292b]">
                Organization
              </h2>

              <p className="mt-1 text-[10px] leading-4 text-[#93878a]">
                Control where this product belongs.
              </p>
            </div>

            <div className="space-y-5 p-5">
              <div>
                <ProductCategoryPicker
                  categories={categories}
                  value={categoryId}
                  recentCategoryIds={repository.getRecentCategoryIds(storeId)}
                  onChange={selectPrimary}
                  onCreateCategory={openCreate}
                />

                <CategoryRecommendations
                  categoryId={categoryId}
                  categories={categories}
                  definitions={state.categoryOptionDefinitions ?? []}
                  existingOptions={options}
                  onAdd={addRecommended}
                />
              </div>

              <div className="border-t border-black/[0.055] pt-5">
                <ProductCategoryPicker
                  categories={categories.filter(
                    (category) =>
                      category.id !== categoryId &&
                      !additionalCategoryIds.includes(category.id),
                  )}
                  label="Additional categories"
                  onChange={addAdditional}
                />

                {additionalCategoryIds.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {additionalCategoryIds.map((id) => {
                      const category = categories.find(
                        (item) => item.id === id,
                      );

                      if (!category) return null;

                      return (
                        <span
                          key={id}
                          className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-black/[0.055] bg-[#f7f2f0] px-2.5 py-1.5 text-[9px] font-black text-[#756a6d]"
                        >
                          <span className="truncate">
                            {getCategoryBreadcrumb(id, categories)}
                          </span>

                          <button
                            type="button"
                            aria-label={`Remove ${category.name}`}
                            onClick={() =>
                              setAdditionalCategoryIds((ids) =>
                                ids.filter((item) => item !== id),
                              )
                            }
                            className="grid size-4 shrink-0 place-items-center rounded-full hover:bg-white"
                          >
                            ×
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>

              <label className="block border-t border-black/[0.055] pt-5">
                <span className={labelClass}>Brand</span>

                <select
                  value={brandId}
                  onChange={(e) => setBrandId(e.target.value)}
                  className={inputClass}
                >
                  <option value="">No brand</option>

                  {brands.map((brand) => (
                    <option key={brand.id} value={brand.id}>
                      {brand.name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="border-t border-black/[0.055] pt-5">
                <span className={labelClass}>Collections</span>

                <div className="mt-2 flex flex-wrap gap-2">
                  {collections.map((collection) => {
                    const active = collectionIds.includes(collection.id);

                    return (
                      <button
                        type="button"
                        key={collection.id}
                        onClick={() =>
                          setCollectionIds((ids) =>
                            active
                              ? ids.filter((id) => id !== collection.id)
                              : [...ids, collection.id],
                          )
                        }
                        className={`rounded-full border px-3 py-1.5 text-[9px] font-black transition ${active
                            ? "border-[#30292b] bg-[#30292b] text-white"
                            : "border-black/[0.055] bg-[#f7f3f1] text-[#776c6e] hover:bg-[#fff0f3]"
                          }`}
                      >
                        {collection.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>
        </aside>
      </div>

      {/* CREATE CATEGORY DIALOG */}
      {createOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Create category"
          className="fixed inset-0 z-50 grid place-items-center bg-[#2e2729]/35 p-4 backdrop-blur-[2px]"
        >
          <div className="w-full max-w-md overflow-hidden rounded-[28px] border border-white/50 bg-white shadow-[0_30px_90px_rgba(56,39,44,0.22)]">
            <div className="border-b border-black/[0.055] px-6 py-5">
              <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#a05b6c]">
                Organization
              </p>

              <h2 className="mt-1 text-[19px] font-black tracking-[-0.025em] text-[#30292b]">
                Create category
              </h2>
            </div>

            <div className="p-6">
              <label className="block">
                <span className={labelClass}>Category name</span>

                <input
                  autoFocus
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  className={inputClass}
                  placeholder="e.g. Polo Shirts"
                />
              </label>

              <div className="mt-5">
                <p className={labelClass}>Parent category</p>

                <div className="mt-2 rounded-[14px] border border-[#f0dde2] bg-[#fff8fa] px-3.5 py-3 text-[11px] font-bold leading-5 text-[#5f5557]">
                  {createParentId
                    ? getCategoryBreadcrumb(createParentId, categories)
                    : "Root category"}
                </div>
              </div>

              {createError && (
                <p
                  role="alert"
                  className="mt-4 rounded-[14px] bg-[#fff1f4] px-3 py-2.5 text-[10px] font-bold text-[#a35467]"
                >
                  {createError}
                </p>
              )}

              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCreateOpen(false)}
                  className="h-9 rounded-full px-4 text-[10px] font-black text-[#756b6d] transition hover:bg-[#f7f3f1]"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={createCategory}
                  className="h-9 rounded-full bg-[#30292b] px-5 text-[10px] font-black text-white shadow-[0_5px_16px_rgba(48,41,43,0.16)] transition hover:bg-[#1f1a1c]"
                >
                  Create category
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SAVE BAR */}
      <div className="sticky bottom-4 z-20">
        <div className="ml-auto flex w-fit items-center gap-3 rounded-full border border-black/[0.07] bg-white/95 p-1.5 pl-4 shadow-[0_14px_40px_rgba(58,40,45,0.14)] backdrop-blur">
          <span className="hidden text-[9px] font-bold text-[#94888b] sm:block">
            {published ? "Ready for storefront" : "Saving as draft"}
          </span>

          <button
            type="submit"
            disabled={saving}
            className="inline-flex h-10 min-w-36 items-center justify-center gap-2 rounded-full bg-[#292426] px-5 text-[10px] font-black text-white shadow-[0_5px_18px_rgba(41,36,38,0.16)] transition hover:-translate-y-px hover:bg-[#1d191a] disabled:pointer-events-none disabled:opacity-50"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {saving ? "Saving…" : product ? "Save changes" : "Save product"}
          </button>
        </div>
      </div>
    </form>
  );
}
