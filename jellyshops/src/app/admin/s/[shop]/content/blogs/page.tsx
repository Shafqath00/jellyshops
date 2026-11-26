"use client";

import "@/features/content-admin/content-admin.css";
import { ContentList } from "@/features/content-admin/content-list";

export default function BlogPostsAdminPage() {
  return <ContentList kind="post" />;
}
