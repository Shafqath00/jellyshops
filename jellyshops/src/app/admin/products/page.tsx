"use client";

import Image from "next/image";
import Link from "next/link";
import { PackageOpen, Plus, Search } from "lucide-react";
import { useShop } from "@/contexts/shop-context";
import { formatMoney } from "@/lib/domain";
import { EmptyState } from "@/components/empty-state";

export default function ProductsPage() {
  const { state } = useShop();
  const store = state.stores.find((item) => item.id === state.activeStoreId)!;
  const products = state.products.filter((product) => product.storeId === store.id && !product.archived);
  return <div className="admin-page"><header className="page-head split-head"><div><span className="page-kicker">Catalog</span><h1>Products</h1><p>Everything customers can discover in your shop.</p></div><Link className="button button-primary" href="/admin/products/new"><Plus size={17} /> Add product</Link></header><div className="toolbar"><div className="search-box"><Search size={17} /><input aria-label="Search products" placeholder="Search products" /></div><span>{products.length} products</span></div>{products.length === 0 ? <EmptyState icon={PackageOpen} title="Your shelf is empty" body="Add your first product and it will appear here." action="Add product" href="/admin/products/new" /> : <div className="data-card product-table"><div className="data-head"><span>Product</span><span>Status</span><span>Stock</span><span>Price</span></div>{products.map((product) => { const variant = product.variants[0]; return <Link href={`/admin/products/${product.id}`} className="data-row" key={product.id}><div className="product-cell"><span className="table-thumb"><Image src={product.imageUrl} alt="" fill sizes="48px" /></span><span><b>{product.name}</b><small>{product.category} · {variant.sku}</small></span></div><span className={product.published ? "availability-live" : "availability-draft"}>{product.published ? "Live" : "Draft"}</span><span className={variant.stock <= 3 ? "low-stock" : ""}>{variant.stock} in stock</span><b>{formatMoney(variant.priceMinor, store.currency)}</b></Link>; })}</div>}</div>;
}
