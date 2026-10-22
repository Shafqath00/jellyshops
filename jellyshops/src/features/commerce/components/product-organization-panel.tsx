"use client";

import type { Dispatch, SetStateAction } from "react";
import { getCategoryBreadcrumb, type CategoryOptionDefinition, type ProductOption } from "@/lib/domain";
import type { useShop } from "@/contexts/shop-context";
import { CategoryRecommendations } from "./category-recommendations";
import { ProductCategoryPicker } from "./product-category-picker";
import { cardClass, inputClass, labelClass } from "./product-form-styles";

type Shop = ReturnType<typeof useShop>;
type Repository = Shop["repository"];

export function ProductOrganizationPanel({ repository, state, storeId, categories, brands, collections, categoryId, additionalCategoryIds, brandId, collectionIds, options, selectPrimary, openCreate, addAdditional, addRecommended, setAdditionalCategoryIds, setBrandId, setCollectionIds }: {
  repository: Repository;
  state: Shop["state"];
  storeId: string;
  categories: ReturnType<Repository["getCategories"]>;
  brands: ReturnType<Repository["getBrands"]>;
  collections: ReturnType<Repository["getCollections"]>;
  categoryId: string;
  additionalCategoryIds: string[];
  brandId: string;
  collectionIds: string[];
  options: ProductOption[];
  selectPrimary: (id: string) => void;
  openCreate: (parentId?: string) => void;
  addAdditional: (id: string) => void;
  addRecommended: (definitions: CategoryOptionDefinition[]) => void;
  setAdditionalCategoryIds: Dispatch<SetStateAction<string[]>>;
  setBrandId: (value: string) => void;
  setCollectionIds: Dispatch<SetStateAction<string[]>>;
}) {
  return (
        <section className={cardClass}>
          <div className="border-b border-black/[0.055] px-5 py-4">
            <h2 className="text-[14px] font-black text-foreground">
              Organization
            </h2>

            <p className="mt-1 text-[10px] leading-4 text-muted-foreground">
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
                        className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-black/[0.055] bg-muted px-2.5 py-1.5 text-[9px] font-black text-muted-foreground"
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
                          ? "border-tint-border bg-primary text-primary-foreground"
                          : "border-black/[0.055] bg-muted/50 text-muted-foreground hover:bg-muted"
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
  );
}
