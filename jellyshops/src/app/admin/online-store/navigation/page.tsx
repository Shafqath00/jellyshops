"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/features/auth/auth-provider";
import { createNavigationApi, type NavigationMenu } from "@/features/navigation/api";
import { MenuEditor } from "@/features/navigation/menu-editor";

export default function NavigationPage() {
  const { session, activeStore } = useAuth();
  const storeId = activeStore?.id ?? "";
  const token = session?.access_token;
  const api = useMemo(() => (token && storeId) ? createNavigationApi({
    baseUrl: process.env.NEXT_PUBLIC_STORE_EDITOR_API_URL ?? "http://localhost:3001",
    token,
  }) : null, [token, storeId]);
  const [menus, setMenus] = useState<NavigationMenu[]>([]);
  const [activeMenuId, setActiveMenuId] = useState("");
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!api || !storeId) return;
    let active = true;
    void api.listMenus(storeId).then((next) => {
      if (!active) return;
      setMenus(next);
      setActiveMenuId((current) => current || next[0]?.id || "");
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : "Unable to load navigation");
    });
    return () => { active = false; };
  }, [api, storeId]);

  const menu = menus.find((entry) => entry.id === activeMenuId);

  if (!api) return <main className="p-8">Navigation manager is unavailable until merchant authentication is connected.</main>;

  return (
    <main className="mx-auto max-w-5xl p-6 md:p-8">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/admin/online-store/editor" aria-label="Back to Online Store" className="grid size-9 place-items-center rounded-lg border border-[#d7d7d7] bg-white"><ArrowLeft size={16} /></Link>
        <div><p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8c9196]">Online Store</p><h1 className="text-2xl font-semibold tracking-[-0.03em]">Navigation</h1></div>
      </div>
      {error && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <div className="mb-4 flex gap-2 overflow-x-auto">
        {menus.map((entry) => (
          <button key={entry.id} type="button" onClick={() => setActiveMenuId(entry.id)} className={`h-9 rounded-lg border px-3 text-[12px] font-semibold ${entry.id === activeMenuId ? "border-[#303030] bg-[#303030] text-white" : "border-[#d7d7d7] bg-white"}`}>{entry.name}</button>
        ))}
      </div>
      {menu ? (
        <MenuEditor
          menu={menu}
          onChange={(items) => setMenus((current) => current.map((entry) => entry.id === menu.id ? { ...entry, items } : entry))}
          onSave={() => {
            void api.updateMenu(storeId, menu.id, menu.revision, { items: menu.items }).then((result) => {
              setMenus((current) => current.map((entry) => entry.id === result.menu.id ? result.menu : entry));
            }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Unable to save menu"));
          }}
        />
      ) : <p className="rounded-xl border border-dashed border-[#d7d7d7] p-8 text-center text-sm text-[#8c9196]">No navigation menus yet.</p>}
    </main>
  );
}
