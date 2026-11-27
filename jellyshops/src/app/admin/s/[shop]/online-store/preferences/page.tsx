"use client";

import { useEffect } from "react";
import { useAdminRouter } from "@/features/admin/admin-routing";

/** Site preferences live in Settings > Store; old links and bookmarks land there. */
export default function OldPreferencesPage() {
  const router = useAdminRouter();
  useEffect(() => { router.replace("/admin/settings/preferences"); }, [router]);
  return <p className="jk-muted" role="status">Opening Site preferences…</p>;
}
