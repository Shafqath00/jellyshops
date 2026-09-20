"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Archive, ArrowLeft } from "lucide-react";
import { ProductForm } from "@/components/product-form";
import { useShop } from "@/contexts/shop-context";

export function ProductEditView({
  productId,
}: {
  productId: string;
}) {
  const { repository } = useShop();
  const router = useRouter();
  const product = repository.getProduct(productId);

  if (!product) {
    return (
      <div className="mx-auto max-w-3xl rounded-[24px] border border-black/[0.06] bg-white p-8 text-center shadow-[0_14px_44px_rgba(83,61,66,0.05)]">
        <h1 className="text-[20px] font-black tracking-[-0.03em] text-[#30292b]">
          Product not found
        </h1>
        <p className="mt-2 text-[12px] text-[#817477]">
          This product may have been removed or archived.
        </p>
        <Link
          href="/admin/products"
          className="mt-5 inline-flex h-10 items-center rounded-full bg-[#241f20] px-4 text-[11px] font-black text-white"
        >
          Back to products
        </Link>
      </div>
    );
  }

  const productIdForArchive = product.id;
  function archiveProduct() {
    repository.archiveProduct(productIdForArchive);
    router.push("/admin/products");
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link
        href="/admin/products"
        className="inline-flex items-center gap-1.5 text-[11px] font-black text-[#756a6d] transition hover:text-[#2d2628]"
      >
        <ArrowLeft size={14} />
        Products
      </Link>

      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#9b5968]">
            Edit product
          </p>

          <h1 className="mt-2 truncate text-[30px] font-black tracking-[-0.045em] text-[#292426] sm:text-[34px]">
            {product.name}
          </h1>

          <p className="mt-2 text-[12px] leading-5 text-[#756b6d]">
            Update product details, inventory, pricing, and storefront
            visibility.
          </p>
        </div>

        <button
          type="button"
          onClick={archiveProduct}
          className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full border border-[#e6c8cf] bg-[#fff7f8] px-4 text-[10px] font-black text-[#945264] transition hover:bg-[#ffedf1]"
        >
          <Archive size={14} />
          Archive
        </button>
      </header>

      <ProductForm product={product} />
    </div>
  );
}

export default function ProductEditPage() {
  const params = useParams<{ id: string }>();

  return <ProductEditView productId={params.id} />;
}
