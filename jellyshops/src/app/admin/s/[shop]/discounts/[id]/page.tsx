"use client";
import { useParams } from "next/navigation";
import { DiscountDetail } from "@/features/discounts/discount-detail";

export default function DiscountPage() {
  const { id } = useParams<{ id: string }>();
  return <DiscountDetail id={decodeURIComponent(id)} />;
}
