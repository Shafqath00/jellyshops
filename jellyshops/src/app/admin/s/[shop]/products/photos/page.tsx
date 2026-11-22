"use client";
import { useProductBulkApi } from "@/features/product-bulk/api";
import { BulkPhotos } from "@/features/product-bulk/bulk-photos";

export default function BulkPhotosPage() {
  return <BulkPhotos api={useProductBulkApi()} />;
}
