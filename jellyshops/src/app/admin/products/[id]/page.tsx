"use client";
import { useParams } from "next/navigation";
import { ProductBuilderEdit } from "@/features/product-builder/product-builder-edit";
function ProductEditView({productId}:{productId:string}) { return <ProductBuilderEdit productId={productId} />; }
export default function ProductEditPage() { const params=useParams<{id:string}>(); return <ProductEditView productId={params.id} />; }
