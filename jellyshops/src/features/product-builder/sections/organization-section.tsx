"use client";
import { useEffect, useState, type ReactNode } from "react";
import { useAdminCatalog, type CollectionRow } from "@/features/admin/api/catalog-api";
import { AdminCard } from "@/components/admin-ui";
import type { Brand } from "@/lib/domain";
import type { CategoryPath } from "../taxonomy";
import type { ProductDraft } from "../draft";

export function OrganizationSection({ draft,onChange,brands = [],categories = [],extra }: { extra?:ReactNode;brands?:Brand[];categories?:CategoryPath[];draft:ProductDraft;onChange:<K extends keyof ProductDraft>(field:K,value:ProductDraft[K])=>void }) {
  const {all,ready,storeId}=useAdminCatalog();
  const [collections,setCollections]=useState<CollectionRow[]>([]);
  const [error,setError]=useState("");
  const [tagText,setTagText]=useState((draft.tags??[]).join(", "));
  useEffect(()=>{let active=true;if(ready) void all<CollectionRow>("/collections").then(rows=>{if(active){setCollections(rows);setError("");}}).catch(()=>{if(active)setError("Collections could not load. Existing selections will be kept.");});return()=>{active=false;};},[all,ready,storeId]);
  return <aside className="admin-product-sidebar admin-stack">
    <AdminCard title="Status"><label className="admin-field">Product status<select aria-label="Product status" value={draft.archived?"ARCHIVED":draft.published?"ACTIVE":"DRAFT"} onChange={event=>{onChange("published",event.target.value==="ACTIVE");onChange("archived",event.target.value==="ARCHIVED");}}><option value="ACTIVE">Active</option><option value="DRAFT">Draft</option>{draft.archived&&<option value="ARCHIVED">Archived</option>}</select><small>{draft.archived?"Hidden from your store.":draft.published?"Visible in your online store when saved.":"Hidden from customers."}</small></label></AdminCard>
    <AdminCard title="Product organization"><div className="admin-stack">
      <label className="admin-field">Product type<input value={draft.productType??""} placeholder="e.g. T-shirts" onChange={event=>onChange("productType",event.target.value)} /></label>
      <label className="admin-field">Brand or supplier<input value={draft.vendor??""} onChange={event=>onChange("vendor",event.target.value)} /></label>
      <fieldset className="admin-field"><legend className="mb-2">Collections</legend>{error&&<p className="text-xs text-muted-foreground">{error}</p>}{collections.map(collection=><label key={collection.id} className="flex items-center gap-2"><input type="checkbox" checked={(draft.collectionIds??[]).includes(collection.id)} onChange={event=>onChange("collectionIds",event.target.checked?[...(draft.collectionIds??[]),collection.id]:(draft.collectionIds??[]).filter(id=>id!==collection.id))}/>{collection.title}</label>)}{!collections.length&&!error&&<small>Create collections from Products → Collections.</small>}</fieldset>
      <label className="admin-field">Tags<input value={tagText} placeholder="e.g. summer, handmade" onChange={event=>{setTagText(event.target.value);onChange("tags",Array.from(new Set(event.target.value.split(",").map(tag=>tag.trim()).filter(Boolean))));}} /><small>Separate tags with commas.</small></label>
      <details><summary className="cursor-pointer text-[13px]">More organization details</summary><div className="admin-stack mt-3">
        <label className="admin-field">Saved brand<select value={draft.brandId??""} onChange={event=>onChange("brandId",event.target.value)}><option value="">No saved brand</option>{draft.brandId&&!brands.some(brand=>brand.id===draft.brandId)&&<option value={draft.brandId}>Current brand</option>}{brands.map(brand=><option key={brand.id} value={brand.id}>{brand.name}</option>)}</select></label>
        <fieldset className="admin-field"><legend>Additional categories</legend><div className="max-h-48 space-y-2 overflow-auto">{categories.filter(category=>category.id!==draft.categoryId).map(category=><label key={category.id} className="flex items-start gap-2"><input type="checkbox" checked={(draft.additionalCategoryIds??[]).includes(category.id)} onChange={event=>onChange("additionalCategoryIds",event.target.checked?[...(draft.additionalCategoryIds??[]),category.id]:(draft.additionalCategoryIds??[]).filter(id=>id!==category.id))}/>{category.label}</label>)}</div></fieldset>
      </div></details>
    </div></AdminCard>
    {extra}
  </aside>;
}
