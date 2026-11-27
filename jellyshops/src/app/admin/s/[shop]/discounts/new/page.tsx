"use client";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { CardSkeleton } from "@/components/admin";
import { NewDiscount } from "@/features/discounts/new-discount";

function NewDiscountFromAddress() {
  const params = useSearchParams();
  return <NewDiscount type={params.get("type")} method={params.get("method")} template={params.get("template")} />;
}

/** `/admin/discounts/new?type=…&method=…` or `?template=…` (from the type picker). */
export default function NewDiscountPage() {
  return <Suspense fallback={<CardSkeleton />}><NewDiscountFromAddress /></Suspense>;
}
