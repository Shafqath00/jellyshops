"use client";
import Link from "next/link";
import { ImageIcon } from "lucide-react";
import { useEffect,useState } from "react";
import { useAuth } from "@/features/auth/providers/auth-provider";
import { AdminPageHeader,AdminEmptyState,AdminNotice,AdminStatus } from "@/components/admin-ui";
import { useAdminCatalog,type CatalogAdminProduct,type CatalogPage } from "@/features/admin/api/catalog-api";

export default function ProductsPage(){
  const {request,ready,storeId}=useAdminCatalog(),{activeStore}=useAuth();
  const [rows,setRows]=useState<CatalogAdminProduct[]>([]),[query,setQuery]=useState(""),[search,setSearch]=useState(""),[status,setStatus]=useState(""),[sort,setSort]=useState("title-asc");
  const [cursor,setCursor]=useState<string|null>(null),[history,setHistory]=useState<Array<string|null>>([]),[next,setNext]=useState<string|null>(null);
  const [error,setError]=useState(""),[loading,setLoading]=useState(true),[revision,setRevision]=useState(0);
  useEffect(()=>{let active=true;if(!ready)return;setLoading(true);const params=new URLSearchParams({limit:"50",sort});if(search.trim())params.set("query",search.trim());if(status)params.set("status",status);if(cursor)params.set("cursor",cursor);void request<CatalogPage<CatalogAdminProduct>>("/products?"+params).then(page=>{if(active){setRows(page.nodes);setNext(page.nextCursor);setError("");}}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[request,ready,storeId,search,status,sort,cursor,revision]);
  const reset=()=>{setCursor(null);setHistory([]);};
  const money=(minor:number)=>new Intl.NumberFormat("en-GB",{style:"currency",currency:activeStore?.currency??"GBP"}).format(minor/100);
  return <div><AdminPageHeader title="Products" actions={<Link href="/admin/products/new" className="admin-button admin-button-primary">Add product</Link>}/>
    {error&&<AdminNotice error>{error}<button className="admin-button ml-3" onClick={()=>setRevision(n=>n+1)}>Retry</button></AdminNotice>}
    <div className="admin-table-wrap">
      <form className="admin-toolbar" onSubmit={event=>{event.preventDefault();setSearch(query);reset();}}>
        <select aria-label="Product status filter" className="admin-button" value={status} onChange={event=>{setStatus(event.target.value);reset();}}><option value="">All products</option><option value="ACTIVE">Active</option><option value="DRAFT">Draft</option><option value="ARCHIVED">Archived</option></select>
        <input aria-label="Search products" className="admin-search" type="search" placeholder="Search products or SKU" value={query} onChange={event=>setQuery(event.target.value)}/>
        <button type="submit" className="admin-button">Search</button>
        <select aria-label="Sort products" className="admin-button" value={sort} onChange={event=>{setSort(event.target.value);reset();}}><option value="title-asc">Name A–Z</option><option value="newest">Newest first</option><option value="price-asc">Price low to high</option><option value="price-desc">Price high to low</option></select>
      </form>
      {loading?<p className="p-6" role="status">Loading products…</p>:!rows.length?<AdminEmptyState title={search||status?"No matching products":"Add your first product"} action={!search&&!status?<Link href="/admin/products/new" className="admin-button admin-button-primary">Add product</Link>:undefined}>Give customers something to discover in your store.</AdminEmptyState>:<table className="admin-table"><thead><tr><th>Product</th><th>Status</th><th>Stock</th><th>Price</th><th>Type</th><th>Brand or supplier</th></tr></thead><tbody>{rows.map(product=>{
        const tracked=product.variants.filter(variant=>variant.trackInventory!==false);
        const stock=tracked.reduce((sum,variant)=>sum+Math.max(0,(variant.quantity??0)-(variant.reserved??0)),0);
        return <tr key={product.id}><td><Link href={"/admin/products/"+product.id} className="flex min-w-44 items-center gap-3 font-medium">{product.media[0]?<img src={product.media[0].url} alt="" width={40} height={40} className="size-10 rounded-lg border border-border object-cover"/>:<span className="grid size-10 place-items-center rounded-lg border border-border bg-muted"><ImageIcon size={17}/></span>}{product.title}</Link></td><td><AdminStatus tone={product.status==="ACTIVE"?"success":"neutral"}>{product.status==="ACTIVE"?"Active":product.status==="ARCHIVED"?"Archived":"Draft"}</AdminStatus></td><td>{tracked.length?stock+" available":"Not tracked"}{product.variants.length>1&&<span className="block text-xs text-muted-foreground">{product.variants.length} variants</span>}</td><td>{money(product.variants[0]?.priceMinor??0)}</td><td>{product.productType||"—"}</td><td>{product.vendor||"—"}</td></tr>;
      })}</tbody></table>}
    </div>
    <div className="mt-4 flex justify-end gap-2"><button className="admin-button" disabled={!history.length||loading} onClick={()=>{setCursor(history.at(-1)??null);setHistory(current=>current.slice(0,-1));}}>Previous</button><button className="admin-button" disabled={!next||loading} onClick={()=>{setHistory(current=>[...current,cursor]);setCursor(next);}}>Next</button></div>
  </div>;
}
