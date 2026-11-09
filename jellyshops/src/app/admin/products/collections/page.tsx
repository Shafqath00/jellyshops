"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { LayoutGrid } from "lucide-react";
import { AdminPage, Banner, EmptyState, Field, IndexTable } from "@/components/admin";
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
const toDraft=(row:CollectionRow):Draft=>({id:row.id,title:row.title,handle:row.handle,description:row.description??"",descriptionDoc:row.descriptionDoc??null,productIds:row.productIds??[]});
export default function CollectionsPage(){
  const drawerTrigger = useRef<HTMLElement | null>(null);
  const { session } = useAuth();
  const token = session?.access_token;
  const editorApi = useMemo(() => token ? createStoreEditorApi({ baseUrl: process.env.NEXT_PUBLIC_STORE_EDITOR_API_URL ?? "http://localhost:3001", token }) : null, [token]);
  const {all,request,ready,storeId}=useAdminCatalog();
  const [rows,setRows]=useState<CollectionRow[]>([]),[products,setProducts]=useState<CatalogAdminProduct[]>([]);
  const [draft,setDraft]=useState<Draft|null>(null),[query,setQuery]=useState(""),[productQuery,setProductQuery]=useState("");
  const [error,setError]=useState(""),[formError,setFormError]=useState(""),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[revision,setRevision]=useState(0);
  useEffect(()=>{let active=true;if(!ready)return;setLoading(true);void Promise.all([all<CollectionRow>("/collections"),all<CatalogAdminProduct>("/products")]).then(([collections,catalog])=>{if(active){setRows(collections);setProducts(catalog);setError("");}}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[all,ready,storeId,revision]);
  useEffect(()=>{setDraft(null);setRows([]);setProducts([]);setFormError("");},[storeId]);
  async function save(){
    if(!draft?.title.trim()){setFormError("Give this collection a name.");return;}
    setBusy(true);setFormError("");
    try{await request("/collections"+(draft.id?"/"+encodeURIComponent(draft.id):""),{method:draft.id?"PATCH":"POST",body:JSON.stringify({title:draft.title.trim(),handle:draft.handle.trim()||slugify(draft.title),description:draft.description,descriptionDoc:draft.descriptionDoc??null,productIds:draft.productIds})});setDraft(null);setRevision(n=>n+1);}
    catch(e){setFormError(e instanceof Error?e.message:"Could not save collection.");}finally{setBusy(false);}
  }
  function edit(value:Draft){drawerTrigger.current=document.activeElement as HTMLElement;setDraft(value);setFormError("");setProductQuery("");}
  const filtered=rows.filter(row=>row.title.toLowerCase().includes(query.toLowerCase()));
  const shownProducts=products.filter(product=>product.title.toLowerCase().includes(productQuery.toLowerCase()));
  const address=draft?(draft.handle||slugify(draft.title)||"your-collection"):"";
  return <AdminPage title="Collections" description="Group products to display together in your store." primaryAction={{label:"Create collection",onAction:()=>edit({...blank})}}>
    <IndexTable<CollectionRow>
      label="Collections"
      rows={filtered}
      rowKey={row=>row.id}
      rowLabel={row=>row.title}
      loading={loading}
      error={error||undefined}
      onRetry={()=>setRevision(n=>n+1)}
      search={{value:query,onChange:setQuery,placeholder:"Search collections",label:"Search collections"}}
      columns={[
        {id:"title",header:"Collection",mobile:"primary",cell:row=><button type="button" className="jk-strong jk-row-link" onClick={()=>edit(toDraft(row))}>{row.title}</button>},
        {id:"handle",header:"Web address",cell:row=><span className="jk-muted">/collections/{row.handle}</span>},
        {id:"products",header:"Products",align:"end",cell:row=><span className="tabular-nums">{row.productIds?.length??0}</span>},
      ]}
      emptyState={<EmptyState icon={LayoutGrid} title={query?"No matching collections":"Create your first collection"} description="Collections help customers browse related products."/>}
    />
    <Sheet open={draft!==null} onOpenChange={open=>{if(!open&&!busy)setDraft(null);}}><SheetContent onCloseAutoFocus={event=>{event.preventDefault();drawerTrigger.current?.focus();}} className="jk-sheet overflow-y-auto"><SheetTitle>{draft?.id?"Edit collection":"Create collection"}</SheetTitle><SheetDescription className="jk-muted">Choose the products customers will find in this collection.</SheetDescription>{draft&&<form className="jk-form" onSubmit={event=>{event.preventDefault();void save();}}>
      {formError&&<Banner tone="critical">{formError}</Banner>}
      <Field id="collection-name" label="Collection name"><input id="collection-name" value={draft.title} onChange={event=>setDraft({...draft,title:event.target.value})}/></Field>
      <div className="jk-field"><span className="jk-strong">Description</span><DescriptionEditor id="collection-description" label="Collection description" value={draft.descriptionDoc??null} fallbackText={draft.description} onChange={(document,plainText)=>setDraft(current=>current?{...current,descriptionDoc:document,description:plainText}:current)}/></div>
      <Field id="collection-handle" label="URL handle" help={`Shoppers find it at /collections/${address}`}><input id="collection-handle" value={draft.handle} placeholder={slugify(draft.title)} onChange={event=>setDraft({...draft,handle:event.target.value})}/></Field>
      <fieldset className="jk-field"><legend className="jk-strong">Products <span className="jk-muted">· {draft.productIds.length} chosen</span></legend>
        {products.length>8&&<label className="jk-search"><span className="sr-only">Search products</span><input type="search" placeholder="Search products" value={productQuery} onChange={event=>setProductQuery(event.target.value)}/></label>}
        <div className="jk-check-list">{shownProducts.map(product=><label key={product.id} className="jk-check"><input type="checkbox" checked={draft.productIds.includes(product.id)} onChange={event=>setDraft({...draft,productIds:event.target.checked?[...draft.productIds,product.id]:draft.productIds.filter(id=>id!==product.id)})}/>{product.title}</label>)}
          {!shownProducts.length&&<p className="jk-muted">{products.length?"No products match.":"Add products first, then group them here."}</p>}</div>
      </fieldset>
      {draft.id&&editorApi&&storeId&&<TemplatePicker key={draft.id} api={editorApi} storeId={storeId} resourceType="collection" resourceId={draft.id} />}
      <div className="jk-row" style={{justifyContent:"flex-end"}}><button type="button" className="jk-button" disabled={busy} onClick={()=>setDraft(null)}>Cancel</button><button type="submit" disabled={busy} className="jk-button jk-button-primary">{busy?"Saving…":"Save collection"}</button></div>
    </form>}</SheetContent></Sheet>
  </AdminPage>;
}
