"use client";

import { useParams } from "next/navigation";
import { ContentItemEditor } from "@/features/content-admin/content-item-editor";

export default function EditBlogPostAdminPage() {
  const { id } = useParams<{ id: string }>();
  return <ContentItemEditor kind="post" id={decodeURIComponent(id)} />;
}
