"use client";
import { useCallback } from "react";
import { resolveMediaUrls } from "@/lib/media-urls";
import { authApiOrigin, useAuth } from "@/features/auth/providers/auth-provider";
import type { CatalogAdminProduct } from "@/features/store-editor/api/types";
import type { RichTextDocument } from "@jelly/storefront-schema";
export interface CollectionRow { id:string; title:string; handle:string; description:string; descriptionDoc?:RichTextDocument|null; productIds:string[] }
export interface InventoryRow { productId:string;variantId:string;productTitle:string;variantTitle:string;sku:string|null;barcode:string|null;lowStockThreshold:number|null;stockStatus:"untracked"|"out"|"low"|"in_stock";trackInventory:boolean;quantity:number|null;reserved:number;availableQuantity:number|null;revision:string|null }
export interface CatalogPage<T> { nodes:T[];nextCursor:string|null }
export class CatalogRequestError extends Error { constructor(message:string,public status:number){super(message);} }
export function useAdminCatalog() {
  const { activeStore,session }=useAuth();
  const storeId=activeStore?.id,token=session?.access_token;
  const request=useCallback(async <T,>(path:string,init:RequestInit={}):Promise<T>=>{
    if(!storeId||!token) throw new Error("Select a store and sign in to continue.");
    const response=await fetch(authApiOrigin()+"/api/stores/"+encodeURIComponent(storeId)+"/catalog"+path,{...init,headers:{"Authorization":"Bearer "+token,"Content-Type":"application/json",...init.headers}});
    const body=await response.json();
    if(!response.ok) throw new CatalogRequestError(body.error?.message??"Could not load this information.",response.status);
    return resolveMediaUrls(body,authApiOrigin()) as T;
  },[storeId,token]);
  const all=useCallback(async <T,>(path:string):Promise<T[]>=>{
    const rows:T[]=[]; let cursor:string|null=null;
    do {const page: CatalogPage<T>=await request<CatalogPage<T>>(path+"?limit=100"+(cursor?"&cursor="+encodeURIComponent(cursor):""));rows.push(...page.nodes);cursor=page.nextCursor;} while(cursor);
    return rows;
  },[request]);
  return {request,all,ready:Boolean(storeId&&token),storeId};
}
export type { CatalogAdminProduct };
