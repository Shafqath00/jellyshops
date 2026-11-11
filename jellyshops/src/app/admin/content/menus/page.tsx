"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth, authApiOrigin } from "@/features/auth/providers/auth-provider";
import { useAdminCatalog } from "@/features/admin/api/catalog-api";
import { createNavigationApi, NavigationApiError, type NavigationApi, type NavigationMenu } from "@/features/navigation/api/client";
import { createStoreEditorApi, type StoreEditorApi } from "@/features/store-editor/api/client";
import { MenuEditor } from "@/features/navigation/components/menu-editor";
import type { CollectionChoice } from "@/features/navigation/components/menu-link-form";
import { ListTree } from "lucide-react";
import { AdminPage, Banner, Card, CardSkeleton, EmptyState, Field } from "@/components/admin";
import { referencedHeaderMenu } from "@/features/navigation/header-menu";
import { menuItemsForSaving, menuWithShownPhotos } from "@/features/navigation/menu-photos";

/** Menus kept from an earlier store design ("previous-…"). They stay saved but are hidden unless asked for. */
const isEarlierVersion = (handle: string) => handle.startsWith("previous-");

export default function NavigationPage() {
  const { session, activeStore } = useAuth();
  const { all } = useAdminCatalog();
  const token = session?.access_token, storeId = activeStore?.id ?? "";
  const api = useMemo(() => token ? createNavigationApi({ baseUrl: authApiOrigin(), token }) : null, [token]);
  const editor = useMemo(() => token ? createStoreEditorApi({ baseUrl: authApiOrigin(), token }) : null, [token]);
  if (!api || !editor || !storeId) return <AdminPage title="Menus"><Banner tone="warning">Select a store and sign in to manage navigation.</Banner></AdminPage>;
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
  const [showEarlier, setShowEarlier] = useState(false);

  useEffect(() => {
    let active = true;
    const { api, editor, all } = clients.current;
    void Promise.all([api.listMenus(storeId), editor.listTemplates(storeId, "home"), editor.listGlobalSections(storeId), all<CollectionChoice>("/collections")]).then(([loaded, templates, globals, choices]) => {
      if (!active) return;
      const next = loaded.map((entry) => menuWithShownPhotos(entry, authApiOrigin()));
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
      const result = await api.updateMenu(storeId, menu.id, menu.revision, { items: menuItemsForSaving(menu.items) });
      const shown = menuWithShownPhotos(result.menu, authApiOrigin());
      setMenus(current => current.map(entry => entry.id === shown.id ? shown : entry));
      setSaved(current => ({ ...current, [shown.id]: JSON.stringify(shown.items) }));
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
  const visibleMenus = menus.filter(entry => showEarlier || !isEarlierVersion(entry.handle) || entry.id === activeId);
  const earlierCount = menus.filter(entry => isEarlierVersion(entry.handle)).length;
  return <AdminPage title="Menus" description="The links in your store's header and footer."
    primaryAction={{ label: "Create menu", disabled: loading || saving, onAction: () => { setCreating(true); setError(""); } }}>
    {error && <Banner tone="critical" title="Something went wrong" action={!loading && !menus.length ? <button type="button" className="jk-button" onClick={() => setRevision(value => value + 1)}>Retry loading navigation</button> : undefined}>{error}</Banner>}
    {conflict && <Banner tone="warning" title="This menu changed somewhere else" action={<button type="button" className="jk-button" onClick={() => { setNotice(""); setRevision(value => value + 1); }}>Reload saved menus</button>}>Your edits are preserved. Reloading will replace them with the latest saved menus.</Banner>}
    {notice && <Banner tone="success" onDismiss={() => setNotice("")}>{notice}</Banner>}
    {creating && <Card title="New menu"><form className="jk-stack-sm" onSubmit={event => { event.preventDefault(); void create(); }}>
      <div className="jk-grid-2">
        <Field id="menu-name" label="Menu name"><input id="menu-name" value={name} onChange={event => setName(event.target.value)} required maxLength={120} disabled={saving} placeholder="Footer help" /></Field>
        <Field id="menu-handle" label="Menu handle" help="Lowercase letters, numbers and hyphens."><input id="menu-handle" value={handle} onChange={event => setHandle(event.target.value)} required pattern="[a-z0-9]+(-[a-z0-9]+)*" disabled={saving} placeholder="footer-help" /></Field>
      </div>
      <div className="jk-row"><button type="submit" className="jk-button jk-button-primary" disabled={saving}>{saving ? "Creating…" : "Create"}</button><button type="button" className="jk-button" disabled={saving} onClick={() => setCreating(false)}>Cancel</button></div>
    </form></Card>}
    {loading ? <CardSkeleton label="Loading navigation" /> : <>
      <nav aria-label="Navigation menus" className="jk-chips">{visibleMenus.map(entry => <button key={entry.id} type="button" className="jk-chip" aria-pressed={entry.id === activeId} disabled={saving} onClick={() => { setActiveId(entry.id); setNotice(""); setError(""); }}>{entry.name}{isEarlierVersion(entry.handle) ? " (earlier version)" : entry.handle !== "main" && entry.handle !== "footer" ? ` · ${entry.handle}` : ""}{saved[entry.id] !== JSON.stringify(entry.items) ? " *" : ""}</button>)}
        {earlierCount > 0 && <button type="button" className="jk-button jk-button-plain" onClick={() => setShowEarlier(value => !value)}>{showEarlier ? "Hide earlier versions" : `Show ${earlierCount} earlier versions`}</button>}</nav>
      {menu ? <MenuEditor key={menu.id} menu={menu} collections={collections} saving={saving} uploadImage={async (file) => (await editor.uploadMedia(storeId, file)).url} dirty={!conflict && saved[menu.id] !== JSON.stringify(menu.items)} onChange={items => { setNotice(""); setMenus(current => current.map(entry => entry.id === menu.id ? { ...entry, items } : entry)); }} onSave={() => void save()} />
        : <Card><EmptyState icon={ListTree} title="No navigation menus yet" description="Create a menu to add your collection links." /></Card>}
    </>}
  </AdminPage>;
}
