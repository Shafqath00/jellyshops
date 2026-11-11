"use client";
import { AnimatedDetails } from "../animated-details";
import { useEffect, useState, type ReactNode } from "react";
import { useAdminCatalog, type CollectionRow } from "@/features/admin/api/catalog-api";
import { Card } from "@/components/admin";
import type { Brand } from "@/lib/domain";
import type { CategoryPath } from "../taxonomy";
import type { ProductDraft } from "../draft";

export function OrganizationSection({ draft,onChange,brands = [],categories = [],extra, category }: { category?: ReactNode; extra?:ReactNode;brands?:Brand[];categories?:CategoryPath[];draft:ProductDraft;onChange:<K extends keyof ProductDraft>(field:K,value:ProductDraft[K])=>void }) {
  const {all,ready,storeId}=useAdminCatalog();
  const [collectionQuery, setCollectionQuery] = useState("");
  const [collections,setCollections]=useState<CollectionRow[]>([]);
  const [error,setError]=useState("");
  const [tagText,setTagText]=useState((draft.tags??[]).join(", "));
  // Types, brands and tags already used in this store, offered as suggestions so names stay consistent.
  const [known,setKnown]=useState<{types:string[];vendors:string[];tags:string[]}>({types:[],vendors:[],tags:[]});
  const [knownLoaded,setKnownLoaded]=useState(false);
  // Loaded the first time the merchant clicks into one of these fields, not on every product open.
  const loadKnown=()=>{if(knownLoaded||!ready)return;setKnownLoaded(true);void all<{productType?:string|null;vendor?:string|null;tags?:string[]}>("/products").then(rows=>{const unique=(values:Array<string|null|undefined>)=>[...new Set(values.map(value=>value?.trim()).filter((value):value is string=>Boolean(value)))].sort((a,b)=>a.localeCompare(b));setKnown({types:unique(rows.map(row=>row.productType)),vendors:unique(rows.map(row=>row.vendor)),tags:unique(rows.flatMap(row=>row.tags??[]))});}).catch(()=>setKnownLoaded(false));};
  useEffect(()=>{let active=true;if(ready) void all<CollectionRow>("/collections").then(rows=>{if(active){setCollections(rows);setError("");}}).catch(()=>{if(active)setError("Collections could not load. Existing selections will be kept.");});return()=>{active=false;};},[all,ready,storeId]);
  const matches = collections.filter(collection => collection.title.toLocaleLowerCase().includes(collectionQuery.trim().toLocaleLowerCase()));
  return <aside id="pb-organization" className="jk-builder-side" aria-label="Publishing and organization">
    <Card title="Publishing"><label className="admin-field">Product status<select id="pb-published" aria-label="Product status" value={draft.archived?"ARCHIVED":draft.published?"ACTIVE":"DRAFT"} onChange={event=>{onChange("published",event.target.value==="ACTIVE");onChange("archived",event.target.value==="ARCHIVED");}}><option value="ACTIVE">Active</option><option value="DRAFT">Draft</option>{draft.archived&&<option value="ARCHIVED">Archived</option>}</select><small>{draft.archived?"Hidden from your store.":draft.published?"Visible in your online store when saved.":"Hidden from customers. Save your draft or publish when you are ready."}</small></label></Card>
    {category}
    <Card title="Product organization"><div className="admin-stack">
      <label className="admin-field"><span className="jk-field-label">Product type <span className="jk-field-kind">Optional</span></span><input list="pb-known-types" onFocus={loadKnown} value={draft.productType??""} placeholder="e.g. T-shirts" onChange={event=>onChange("productType",event.target.value)} /></label>
      <label className="admin-field"><span className="jk-field-label">Brand or supplier <span className="jk-field-kind">Optional</span></span><input list="pb-known-vendors" onFocus={loadKnown} value={draft.vendor??""} onChange={event=>onChange("vendor",event.target.value)} /></label>
      <fieldset className="admin-field"><legend className="mb-2">Collections <span className="jk-field-kind">Optional</span></legend><p className="jk-section-hint">Group products for your store, such as Summer or Gifts.</p>{collections.length > 0 && <><label htmlFor="pb-collection-search" className="sr-only">Search collections</label><input id="pb-collection-search" type="search" placeholder="Search collections" value={collectionQuery} onChange={event => setCollectionQuery(event.target.value)} /><p className="jk-collection-count" aria-live="polite">{(draft.collectionIds ?? []).length} selected</p></>}{error&&<p className="text-xs text-muted-foreground">{error}</p>}<div className="jk-collection-list">{matches.map(collection=><label key={collection.id} className="flex items-center gap-2"><input type="checkbox" checked={(draft.collectionIds??[]).includes(collection.id)} onChange={event=>onChange("collectionIds",event.target.checked?[...(draft.collectionIds??[]),collection.id]:(draft.collectionIds??[]).filter(id=>id!==collection.id))}/>{collection.title}</label>)}</div>{collections.length > 0 && matches.length === 0 && <p className="jk-section-hint">No matching collections. Try another name.</p>}{!collections.length&&!error&&<small>Create collections from Products → Collections.</small>}</fieldset>
      <label className="admin-field"><span className="jk-field-label">Tags <span className="jk-field-kind">Optional</span></span><input onFocus={loadKnown} value={tagText} placeholder="e.g. summer, handmade" onChange={event=>{setTagText(event.target.value);onChange("tags",Array.from(new Set(event.target.value.split(",").map(tag=>tag.trim()).filter(Boolean))));}} /><small>Separate tags with commas.</small></label>
      {known.tags.length>0&&<p className="text-xs text-muted-foreground">Tags used in your store: {known.tags.slice(0,12).map((tag,index)=><span key={tag}>{index>0&&", "}<button type="button" className="underline" onClick={()=>{const next=Array.from(new Set([...(draft.tags??[]),tag]));setTagText(next.join(", "));onChange("tags",next);}}>{tag}</button></span>)}</p>}
      <datalist id="pb-known-types">{known.types.map(type=><option key={type} value={type} />)}</datalist>
      <datalist id="pb-known-vendors">{known.vendors.map(vendor=><option key={vendor} value={vendor} />)}</datalist>
      <AnimatedDetails className="jk-disclosure"><summary>More organization details</summary><div className="admin-stack mt-3">
        <label className="admin-field">Saved brand<select value={draft.brandId??""} onChange={event=>onChange("brandId",event.target.value)}><option value="">No saved brand</option>{draft.brandId&&!brands.some(brand=>brand.id===draft.brandId)&&<option value={draft.brandId}>Current brand</option>}{brands.map(brand=><option key={brand.id} value={brand.id}>{brand.name}</option>)}</select></label>
        <fieldset className="admin-field"><legend>Additional categories</legend><div className="max-h-48 space-y-2 overflow-auto">{categories.filter(category=>category.id!==draft.categoryId).map(category=><label key={category.id} className="flex items-start gap-2"><input type="checkbox" checked={(draft.additionalCategoryIds??[]).includes(category.id)} onChange={event=>onChange("additionalCategoryIds",event.target.checked?[...(draft.additionalCategoryIds??[]),category.id]:(draft.additionalCategoryIds??[]).filter(id=>id!==category.id))}/>{category.label}</label>)}</div></fieldset>
      </div></AnimatedDetails>
    </div></Card>
    {extra}
  </aside>;
}
