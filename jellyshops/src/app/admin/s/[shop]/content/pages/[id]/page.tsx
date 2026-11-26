"use client";

import { useParams } from "next/navigation";
import { ContentItemEditor } from "@/features/content-admin/content-item-editor";

export default function EditPageAdminPage() {
  const { id } = useParams<{ id: string }>();
  return <ContentItemEditor kind="page" id={decodeURIComponent(id)} />;
}
