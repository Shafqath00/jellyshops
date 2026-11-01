"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useAuth, authApiOrigin } from "@/features/auth/providers/auth-provider";
import { useAdminCatalog } from "@/features/admin/api/catalog-api";
import { createNavigationApi, NavigationApiError, type NavigationApi, type NavigationMenu } from "@/features/navigation/api/client";
import { createStoreEditorApi, type StoreEditorApi } from "@/features/store-editor/api/client";
import { MenuEditor } from "@/features/navigation/components/menu-editor";
import type { CollectionChoice } from "@/features/navigation/components/menu-link-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { referencedHeaderMenu } from "@/features/navigation/header-menu";

export default function NavigationPage() {
  const { session, activeStore } = useAuth();
  const { all } = useAdminCatalog();
  const token = session?.access_token, storeId = activeStore?.id ?? "";
  const api = useMemo(() => token ? createNavigationApi({ baseUrl: authApiOrigin(), token }) : null, [token]);
  const editor = useMemo(() => token ? createStoreEditorApi({ baseUrl: authApiOrigin(), token }) : null, [token]);
  if (!api || !editor || !storeId) return <main className="p-8">Select a store and sign in to manage navigation.</main>;
  return <NavigationWorkspace key={storeId} storeId={storeId} api={api} editor={editor} all={all} />;
}

function NavigationWorkspace({ storeId, api, editor, all }: { storeId: string; api: NavigationApi; editor: StoreEditorApi; all: <T>(path: string) => Promise<T[]> }) {
  const clients = useRef({ api, editor, all });
  useEffect(() => { clients.current = { api, editor, all }; }, [api, editor, all]);
  const [menus, setMenus] = useState<NavigationMenu[]>([]);
  const [saved, setSaved] = useState<Record<string, string>>({});
  const [activeId, setActiveId] = useState("");
  const [collections, setCollections] = useState<CollectionChoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [conflictIds, setConflictIds] = useState<string[]>([]);
  const [revision, setRevision] = useState(0);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");

  useEffect(() => {
    let active = true;
    const { api, editor, all } = clients.current;
    void Promise.all([api.listMenus(storeId), editor.listTemplates(storeId, "home"), editor.listGlobalSections(storeId), all<CollectionChoice>("/collections")]).then(([next, templates, globals, choices]) => {
      if (!active) return;
      const headerHandle = referencedHeaderMenu(templates, globals);
      setMenus(next); setCollections(choices);
      setSaved(Object.fromEntries(next.map(menu => [menu.id, JSON.stringify(menu.items)])));
      setActiveId(current => next.some(menu => menu.id === current) ? current : next.find(menu => menu.handle === headerHandle)?.id ?? next[0]?.id ?? "");
      setError(""); setConflictIds([]);
    }).catch(reason => { if (active) setError(reason instanceof Error ? reason.message : "Unable to load navigation."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [storeId, revision]);

  const menu = menus.find(entry => entry.id === activeId);
  const conflict = conflictIds.includes(activeId);
  async function save() {
    if (!menu || saving || conflict) return;
    setSaving(true); setError(""); setNotice("");
    try {
      const result = await api.updateMenu(storeId, menu.id, menu.revision, { items: menu.items });
      setMenus(current => current.map(entry => entry.id === result.menu.id ? result.menu : entry));
      setSaved(current => ({ ...current, [result.menu.id]: JSON.stringify(result.menu.items) }));
      setNotice("Menu saved. Publish your storefront in the theme editor to make it live.");
    } catch (reason) {
      if (reason instanceof NavigationApiError && reason.status === 409) setConflictIds(current => [...current, menu.id]);
      setError(reason instanceof Error ? reason.message : "Unable to save menu.");
    } finally { setSaving(false); }
  }
  async function create() {
    if (!name.trim() || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(handle)) { setError("Enter a menu name and a URL handle using lowercase letters, numbers and hyphens."); return; }
    setSaving(true); setError("");
    try {
      const result = await api.createMenu(storeId, { name: name.trim(), handle, items: [] });
      setMenus(current => [...current, result.menu]);
      setSaved(current => ({ ...current, [result.menu.id]: JSON.stringify(result.menu.items) }));
      setActiveId(result.menu.id); setCreating(false); setName(""); setHandle("");
      setNotice("Menu created. Select its handle in the header to display it.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to create menu."); }
    finally { setSaving(false); }
  }
  return <main className="mx-auto flex max-w-5xl flex-col gap-5 p-6 md:p-8">
    <header className="flex items-center gap-3"><Link href="/admin/online-store/editor" aria-label="Back to Online Store" className="admin-button"><ArrowLeft size={16} /></Link><h1 className="flex-1 text-2xl font-semibold">Navigation</h1><Button variant="outline" disabled={loading || saving} onClick={() => { setCreating(true); setError(""); }}>Create menu</Button></header>
    {error && <div role="alert" className="rounded-lg border border-destructive p-4 text-sm">{error}</div>}
    {conflict && <div role="alert" className="rounded-lg border border-border p-4 text-sm"><p>Your edits are preserved. Reloading will replace them with the latest saved menus.</p><Button variant="outline" onClick={() => { setNotice(""); setRevision(value => value + 1); }}>Reload saved menus</Button></div>}
    {error && !loading && !menus.length && <Button variant="outline" onClick={() => setRevision(value => value + 1)}>Retry loading navigation</Button>}
    {notice && <p role="status" className="text-sm text-muted-foreground">{notice}</p>}
    {creating && <form className="flex flex-col gap-4 rounded-xl border border-border p-5" onSubmit={event => { event.preventDefault(); void create(); }}>
      <div className="flex flex-col gap-2"><Label htmlFor="menu-name">Menu name</Label><Input id="menu-name" value={name} onChange={event => setName(event.target.value)} required maxLength={120} disabled={saving} /></div>
      <div className="flex flex-col gap-2"><Label htmlFor="menu-handle">Menu handle</Label><Input id="menu-handle" value={handle} onChange={event => setHandle(event.target.value)} required pattern="[a-z0-9]+(-[a-z0-9]+)*" disabled={saving} /></div>
      <div className="flex gap-2"><Button type="submit" disabled={saving}>{saving ? "Creating…" : "Create"}</Button><Button type="button" variant="outline" disabled={saving} onClick={() => setCreating(false)}>Cancel</Button></div>
    </form>}
    {loading ? <p role="status">Loading navigation…</p> : <>
      <nav aria-label="Navigation menus" className="flex flex-wrap gap-2">{menus.map(entry => <Button key={entry.id} variant={entry.id === activeId ? "default" : "outline"} disabled={saving} onClick={() => { setActiveId(entry.id); setNotice(""); setError(""); }}>{entry.name} · {entry.handle}{saved[entry.id] !== JSON.stringify(entry.items) ? " *" : ""}</Button>)}</nav>
      {menu ? <MenuEditor key={menu.id} menu={menu} collections={collections} saving={saving} dirty={!conflict && saved[menu.id] !== JSON.stringify(menu.items)} onChange={items => { setNotice(""); setMenus(current => current.map(entry => entry.id === menu.id ? { ...entry, items } : entry)); }} onSave={() => void save()} /> : <p>No navigation menus yet. Create a menu to add your collection links.</p>}
    </>}
  </main>;
}
