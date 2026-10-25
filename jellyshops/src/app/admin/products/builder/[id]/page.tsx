"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ProductBuilderEdit } from "@/features/product-builder/ProductBuilderEdit";

export default function ProductBuilderEditPage() {
  const params = useParams<{ id: string }>();
  return (
    <main className="min-h-screen bg-muted/50">
      <div className="mx-auto w-full max-w-[1180px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <Link href="/admin/products" className="inline-flex items-center gap-2 text-[11px] font-black text-muted-foreground hover:text-foreground">
          <ArrowLeft size={13} />
          Products
        </Link>
        <h1 className="mb-6 mt-4 text-[32px] font-black tracking-[-0.045em] text-foreground">Edit product</h1>
        <ProductBuilderEdit productId={params.id} />
      </div>
    </main>
  );
}
