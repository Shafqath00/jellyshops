"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { AdminPageHeader, AdminEmptyState, AdminNotice } from "@/components/admin-ui";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { useAdminCatalog, type CollectionRow, type CatalogAdminProduct } from "@/features/admin/api/catalog-api";
import { slugify } from "@/lib/domain";
import { useAuth } from "@/features/auth/providers/auth-provider";
import { createStoreEditorApi } from "@/features/store-editor/api/client";
import { TemplatePicker } from "@/features/store-editor/components/template-picker";
import { DescriptionEditor } from "@/features/product-builder/sections/description-editor";
import type { RichTextDocument } from "@jelly/storefront-schema";
type Draft = { id?:string;title:string;handle:string;description:string;descriptionDoc?:RichTextDocument|null;productIds:string[] };
const blank:Draft={title:"",handle:"",description:"",descriptionDoc:null,productIds:[]};
export default function CollectionsPage(){
  const drawerTrigger = useRef<HTMLElement | null>(null);
  const { session } = useAuth();
  const token = session?.access_token;
  const editorApi = useMemo(() => token ? createStoreEditorApi({ baseUrl: process.env.NEXT_PUBLIC_STORE_EDITOR_API_URL ?? "http://localhost:3001", token }) : null, [token]);
  const {all,request,ready,storeId}=useAdminCatalog();
  const [rows,setRows]=useState<CollectionRow[]>([]),[products,setProducts]=useState<CatalogAdminProduct[]>([]);
  const [draft,setDraft]=useState<Draft|null>(null),[query,setQuery]=useState("");
  const [error,setError]=useState(""),[formError,setFormError]=useState(""),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[revision,setRevision]=useState(0);
  useEffect(()=>{let active=true;if(!ready)return;setLoading(true);void Promise.all([all<CollectionRow>("/collections"),all<CatalogAdminProduct>("/products")]).then(([collections,catalog])=>{if(active){setRows(collections);setProducts(catalog);setError("");}}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[all,ready,storeId,revision]);
  useEffect(()=>{setDraft(null);setRows([]);setProducts([]);setFormError("");},[storeId]);
  async function save(){
    if(!draft?.title.trim()){setFormError("Give this collection a name.");return;}
    setBusy(true);setFormError("");
    try{await request("/collections"+(draft.id?"/"+encodeURIComponent(draft.id):""),{method:draft.id?"PATCH":"POST",body:JSON.stringify({title:draft.title.trim(),handle:draft.handle.trim()||slugify(draft.title),description:draft.description,descriptionDoc:draft.descriptionDoc??null,productIds:draft.productIds})});setDraft(null);setRevision(n=>n+1);}
    catch(e){setFormError(e instanceof Error?e.message:"Could not save collection.");}finally{setBusy(false);}
  }
  function edit(value:Draft){drawerTrigger.current=document.activeElement as HTMLElement;setDraft(value);setFormError("");}
  const filtered=rows.filter(row=>row.title.toLowerCase().includes(query.toLowerCase()));
  return <div><AdminPageHeader title="Collections" description="Group products to display together in your store." actions={<button className="admin-button admin-button-primary" onClick={()=>edit({...blank})}>Create collection</button>}/>
    {error&&<AdminNotice error>{error}<button className="admin-button ml-3" onClick={()=>setRevision(n=>n+1)}>Retry</button></AdminNotice>}
    <div className="admin-table-wrap"><div className="admin-toolbar"><input type="search" className="admin-search" aria-label="Search collections" placeholder="Search collections" value={query} onChange={event=>setQuery(event.target.value)}/></div>
      {loading?<p className="p-6" role="status">Loading collections…</p>:!filtered.length?<AdminEmptyState title={query?"No matching collections":"Create your first collection"}>Collections help customers browse related products.</AdminEmptyState>:<table className="admin-table"><thead><tr><th>Collection</th><th>Products</th></tr></thead><tbody>{filtered.map(row=><tr key={row.id}><td><button className="font-medium hover:underline" onClick={()=>edit({id:row.id,title:row.title,handle:row.handle,description:row.description??"",descriptionDoc:row.descriptionDoc??null,productIds:row.productIds??[]})}>{row.title}</button></td><td>{row.productIds?.length??0}</td></tr>)}</tbody></table>}
    </div>
    <Sheet open={draft!==null} onOpenChange={open=>{if(!open&&!busy)setDraft(null);}}><SheetContent onCloseAutoFocus={event=>{event.preventDefault();drawerTrigger.current?.focus();}} className="admin-shell admin-panel overflow-y-auto"><SheetTitle>{draft?.id?"Edit collection":"Create collection"}</SheetTitle><SheetDescription>Choose the products customers will find in this collection.</SheetDescription>{draft&&<form className="admin-stack mt-5" onSubmit={event=>{event.preventDefault();void save();}}>
      {formError&&<AdminNotice error>{formError}</AdminNotice>}
      <label className="admin-field">Collection name<input value={draft.title} onChange={event=>setDraft({...draft,title:event.target.value})}/></label>
      <div className="admin-field"><span>Description</span><DescriptionEditor id="collection-description" label="Collection description" value={draft.descriptionDoc??null} fallbackText={draft.description} onChange={(document,plainText)=>setDraft(current=>current?{...current,descriptionDoc:document,description:plainText}:current)}/></div>
      <details><summary className="cursor-pointer">Collection URL</summary><label className="admin-field mt-3">URL handle<input value={draft.handle} placeholder={slugify(draft.title)} onChange={event=>setDraft({...draft,handle:event.target.value})}/></label></details>
      <fieldset className="admin-field"><legend>Products</legend>{products.map(product=><label key={product.id} className="flex items-center gap-2 py-1"><input type="checkbox" checked={draft.productIds.includes(product.id)} onChange={event=>setDraft({...draft,productIds:event.target.checked?[...draft.productIds,product.id]:draft.productIds.filter(id=>id!==product.id)})}/>{product.title}</label>)}</fieldset>
      {draft.id&&editorApi&&storeId&&<TemplatePicker key={draft.id} api={editorApi} storeId={storeId} resourceType="collection" resourceId={draft.id} />}
      <button type="submit" disabled={busy} className="admin-button admin-button-primary">{busy?"Saving…":"Save collection"}</button>
    </form>}</SheetContent></Sheet>
  </div>;
}
