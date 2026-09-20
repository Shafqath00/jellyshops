import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ProductForm } from "@/components/product-form";

export default function NewProductPage() {
  return (
    <main className="min-h-screen bg-[#fbf8f6]">
      <div className="mx-auto w-full max-w-[1380px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="mb-7">
          <Link
            href="/admin/products"
            className="group inline-flex items-center gap-2 rounded-full px-1 py-1 text-[11px] font-black text-[#877b7e] transition hover:text-[#2f292b]"
          >
            <span className="grid size-7 place-items-center rounded-full border border-black/[0.06] bg-white shadow-sm transition group-hover:-translate-x-0.5">
              <ArrowLeft size={13} />
            </span>
            Products
          </Link>

          <div className="mt-6 flex flex-col gap-4 border-b border-black/[0.06] pb-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="inline-flex items-center rounded-full border border-[#efd9df] bg-[#fff6f8] px-3 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-[#a45e70]">
                Product editor
              </div>

              <h1 className="mt-3 text-[32px] font-black tracking-[-0.045em] text-[#292426] sm:text-[38px]">
                Add a product
              </h1>

              <p className="mt-2 max-w-2xl text-[13px] leading-6 text-[#7c7073]">
                Add product details, organize it in your catalog, configure
                options, pricing, inventory, and storefront visibility.
              </p>
            </div>

            <div className="hidden rounded-2xl border border-black/[0.05] bg-white px-4 py-3 shadow-[0_8px_30px_rgba(70,50,55,0.04)] sm:block">
              <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#a09295]">
                Status
              </p>
              <div className="mt-1.5 flex items-center gap-2 text-[11px] font-black text-[#4b4244]">
                <span className="size-2 rounded-full bg-[#c9d782]" />
                Unsaved product
              </div>
            </div>
          </div>
        </div>

        <ProductForm />
      </div>
    </main>
  );
}