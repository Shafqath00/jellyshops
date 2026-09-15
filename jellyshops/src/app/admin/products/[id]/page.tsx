"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Archive } from "lucide-react";
import { ProductForm } from "@/components/product-form";
import { useShop } from "@/contexts/shop-context";

export function ProductEditView({ productId }: { productId: string }) {
  const { repository } = useShop();
  const product = repository.getProduct(productId);
  if (!product) return <div className="admin-page"><h1>Product not found</h1><Link href="/admin/products">Back to products</Link></div>;
  return <div className="admin-page narrow-page"><Link href="/admin/products" className="back-link"><ArrowLeft size={16} /> Products</Link><header className="page-head split-head"><div><span className="page-kicker">Edit product</span><h1>{product.name}</h1></div><button type="button" className="button button-secondary" onClick={() => repository.archiveProduct(product.id)}><Archive size={16} /> Archive</button></header><ProductForm product={product} /></div>;
}

export default function ProductEditPage() {
  const params = useParams<{ id: string }>();
  return <ProductEditView productId={params.id} />;
}
