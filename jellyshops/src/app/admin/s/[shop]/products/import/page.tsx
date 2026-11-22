"use client";
import { useProductBulkApi } from "@/features/product-bulk/api";
import { ImportWizard } from "@/features/product-bulk/import-wizard";

export default function ProductImportPage() {
  return <ImportWizard api={useProductBulkApi()} />;
}
