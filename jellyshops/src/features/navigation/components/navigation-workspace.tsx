"use client";

import "../navigation.css";
import "@/features/content-admin/content-admin.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, ListTree } from "lucide-react";
import { AdminPage, Banner, Button, Card, CardSkeleton, ConfirmDialog, EmptyState, Field, useToast } from "@/components/admin";
import { authApiOrigin } from "@/features/auth/providers/auth-provider";
import type { ContentApi } from "@/features/content/api/client";
import type { StoreEditorApi } from "@/features/store-editor/api/client";
import { PreviewDialog } from "@/features/content-admin/preview-dialog";
import { useAdminRouter } from "@/features/admin/admin-routing";
import { NavigationApiError, type NavigationApi, type NavigationMenu, type PublishCheck } from "../api/client";
import { menuPlacements, type MenuPlacement } from "../header-menu";
import { menuIssues, productIds } from "../link-check";
import { menuItemsForSaving, menuWithShownPhotos } from "../menu-photos";
import { countLinks } from "../menu-tree";
import { useLinkResources } from "../use-link-resources";
import { MenuBuilder } from "./menu-builder";

const isEarlierVersion = (handle: string) => handle.startsWith("previous-");
const handleFrom = (name: string) => name.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "menu";
const PLACE_WORDS: Record<MenuPlacement, string> = { header: "Header", footer: "Footer" };

/**
 * Navigation: every menu, a builder for the chosen one, a preview in the store's real header and footer, and
 * "Publish menu changes" (menus only, unless the store design has other unpublished changes, which it says).
 */
export function NavigationWorkspace({ storeId, storeSlug, api, editor, content }: { storeId: string; storeSlug: string; api: NavigationApi; editor: StoreEditorApi; content: ContentApi }) {
  const toast = useToast();
  const router = useAdminRouter();
  const clients = useRef({ api, editor });
  useEffect(() => { clients.current = { api, editor }; }, [api, editor]);
  const [menus, setMenus] = useState<NavigationMenu[]>([]);
  const [saved, setSaved] = useState<Record<string, string>>({});
  const [placements, setPlacements] = useState<Record<string, MenuPlacement[]>>({});
  const [activeId, setActiveId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"" | "saving" | "publishing" | "creating">("");
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [check, setCheck] = useState<PublishCheck | null>(null);
  const [checkAttempt, setCheckAttempt] = useState(0);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [showEarlier, setShowEarlier] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [confirmAll, setConfirmAll] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    const { api, editor } = clients.current;
    Promise.all([api.listMenus(storeId), editor.listTemplates(storeId, "home"), editor.listGlobalSections(storeId)]).then(([loaded, templates, globals]) => {
      if (!active) return;
      const next = loaded.map((entry) => menuWithShownPhotos(entry, authApiOrigin()));
      const places = menuPlacements(templates, globals);
      setMenus(next);
      setPlacements(places);
      setSaved(Object.fromEntries(next.map((menu) => [menu.id, JSON.stringify(menu.items)])));
      setActiveId((current) => next.some((menu) => menu.id === current) ? current : next.find((menu) => places[menu.handle]?.includes("header"))?.id ?? next[0]?.id ?? "");
      setError(""); setConflict(false);
    }).catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Your menus could not be loaded."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [storeId, attempt]);

  // Which menus differ from the live store (refreshed after every save and publish).
  useEffect(() => {
    let active = true;
    const { api, editor } = clients.current;
    editor.loadWorkspace(storeId).then((workspace) => api.publishCheck(storeId, workspace.generation))
      .then((result) => { if (active) setCheck(result); })
      .catch(() => { if (active) setCheck(null); });
    return () => { active = false; };
  }, [storeId, checkAttempt]);

  const menu = menus.find((entry) => entry.id === activeId);
  const dirty = Boolean(menu && saved[menu.id] !== JSON.stringify(menu.items));
  const allProductIds = useMemo(() => productIds(menus.flatMap((entry) => entry.items)), [menus]);
  const { resources, error: resourceError, retry, searchProducts } = useLinkResources(content, storeId, allProductIds);
  const issues = menu ? menuIssues(menu.items, resources) : [];
  const unnamed = menu ? countUnnamed(menu.items) : 0;
  const unpublished = check?.ok ? new Set(check.menus) : new Set<string>();

  async function save(): Promise<boolean> {
    if (!menu) return true;
    if (!dirty) return true;
    if (unnamed) { setError(`Give every link a name before saving (${unnamed} without one).`); return false; }
    setBusy("saving"); setError("");
    try {
      const result = await api.updateMenu(storeId, menu.id, menu.revision, { items: menuItemsForSaving(menu.items) });
      const shown = menuWithShownPhotos(result.menu, authApiOrigin());
      setMenus((current) => current.map((entry) => entry.id === shown.id ? shown : entry));
      setSaved((current) => ({ ...current, [shown.id]: JSON.stringify(shown.items) }));
      setCheckAttempt((count) => count + 1);
      return true;
    } catch (reason) {
      if (reason instanceof NavigationApiError && reason.status === 409) setConflict(true);
      setError(reason instanceof Error ? reason.message : "The menu could not be saved.");
      return false;
    } finally { setBusy(""); }
  }

  async function publish(force = false) {
    if (!(await save())) return;
    setBusy("publishing"); setError("");
    try {
      const workspace = await editor.loadWorkspace(storeId);
      if (!force) {
        const result = await api.publishCheck(storeId, workspace.generation);
        setCheck(result);
        if (!result.ok) { setError(result.diagnostics[0]?.message ?? "Your store design has a problem that stops publishing. Open the store designer to fix it."); return; }
        if (result.design) { setConfirmAll(workspace.generation); return; }
        if (!result.menus.length) { toast("Your menus are already live"); return; }
      }
      const published = await editor.publish(storeId, workspace.generation, `menus-${storeId}-${workspace.generation}`);
      if (!published.ok) { setError("Publishing stopped: your store design has a problem. Open the store designer to see it."); return; }
      toast(force ? "Your store design and menus are live" : "Menu changes are live on your store");
      setCheckAttempt((count) => count + 1);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Publishing did not work. Try again.");
    } finally { setBusy(""); }
  }

  async function create() {
    const trimmed = name.trim();
    if (!trimmed) { setError("Give the menu a name, for example Footer help."); return; }
    const taken = new Set(menus.map((entry) => entry.handle));
    let handle = handleFrom(trimmed);
    for (let suffix = 2; taken.has(handle); suffix++) handle = `${handleFrom(trimmed)}-${suffix}`;
    setBusy("creating"); setError("");
    try {
      const result = await api.createMenu(storeId, { name: trimmed, handle, items: [] });
      setMenus((current) => [...current, result.menu]);
      setSaved((current) => ({ ...current, [result.menu.id]: JSON.stringify(result.menu.items) }));
      setActiveId(result.menu.id); setCreating(false); setName("");
      toast(`Menu “${trimmed}” created. Choose it in your header or footer in the store designer to show it.`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The menu could not be created."); }
    finally { setBusy(""); }
  }

  const visibleMenus = menus.filter((entry) => showEarlier || !isEarlierVersion(entry.handle) || entry.id === activeId);
  const earlierCount = menus.filter((entry) => isEarlierVersion(entry.handle)).length;
  const activeUnpublished = menu ? unpublished.has(menu.handle) : false;
  const status = !menu ? "" : dirty ? "Unsaved changes" : activeUnpublished ? "Saved, not live yet" : check?.ok ? "Live on your store" : "Saved";

  return (
    <AdminPage title="Navigation" description="The menus in your store's header and footer. Build them here, preview them in your design, then publish."
      primaryAction={menu ? { label: busy === "publishing" ? "Publishing…" : "Publish menu changes", onAction: () => void publish(), disabled: Boolean(busy) || (!dirty && !activeUnpublished && check?.ok === true && !check.menus.length) } : undefined}
      secondaryActions={menu ? [
        { label: busy === "saving" ? "Saving…" : "Save", onAction: () => void save().then((ok) => ok && toast("Menu saved. Publish to show it on your store.")), disabled: !dirty || Boolean(busy) },
        { label: "Preview", onAction: () => setPreviewOpen(true) },
      ] : []}
      moreActions={[{ label: "Create menu", onAction: () => { setCreating(true); setError(""); } }]}>
      {error && <Banner tone="critical" title="Something went wrong" action={!loading && !menus.length ? <Button size="small" onClick={() => setAttempt((value) => value + 1)}>Try again</Button> : undefined}>{error}</Banner>}
      {conflict && <Banner tone="warning" title="This menu changed in another window" action={<Button size="small" onClick={() => setAttempt((value) => value + 1)}>Load the latest</Button>}>Loading the latest replaces your unsaved changes here.</Banner>}
      {resourceError && <Banner tone="warning" action={<Button size="small" onClick={retry}>Try again</Button>}>{resourceError}</Banner>}
      {creating && (
        <Card title="New menu">
          <form className="jk-stack-sm" onSubmit={(event) => { event.preventDefault(); void create(); }}>
            <Field id="menu-name" label="Menu name" help="Only you see this name. Pick the menu in your header or footer settings to show it.">
              <input id="menu-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={120} placeholder="Footer help" autoFocus />
            </Field>
            <div className="jk-row"><Button type="submit" variant="primary" loading={busy === "creating"}>Create menu</Button><Button onClick={() => setCreating(false)}>Cancel</Button></div>
          </form>
        </Card>
      )}
      {loading ? <CardSkeleton label="Loading navigation" /> : !menus.length ? (
        <Card><EmptyState icon={ListTree} title="No menus yet" description="Menus hold the links in your header and footer. Create one to start." action={<Button variant="primary" onClick={() => setCreating(true)}>Create menu</Button>} /></Card>
      ) : (
        <div className="jnav-layout">
          <nav className="jnav-menus jk-card" aria-label="Menus">
            <ul>
              {visibleMenus.map((entry) => {
                const places = placements[entry.handle] ?? [];
                const changed = saved[entry.id] !== JSON.stringify(entry.items);
                return (
                  <li key={entry.id}>
                    <button type="button" className="jnav-menu" aria-current={entry.id === activeId ? "true" : undefined} onClick={() => { setActiveId(entry.id); setError(""); }}>
                      <strong>{entry.name}</strong>
                      <small>{places.length ? places.map((place) => PLACE_WORDS[place]).join(" and ") : isEarlierVersion(entry.handle) ? "Earlier version" : "Not shown anywhere yet"} · {countLinks(entry.items)} links</small>
                      {(changed || unpublished.has(entry.handle)) && <span className="jnav-dot" title={changed ? "Unsaved changes" : "Not published yet"}>{changed ? "Unsaved" : "Not live"}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
            {earlierCount > 0 && <button type="button" className="jk-link jnav-earlier" onClick={() => setShowEarlier((value) => !value)}>{showEarlier ? "Hide earlier versions" : `Show ${earlierCount} earlier version${earlierCount === 1 ? "" : "s"}`}</button>}
          </nav>
          {menu && (
            <div className="jnav-main">
              <div className="jnav-status" role="status">
                {dirty || activeUnpublished ? <AlertTriangle size={15} aria-hidden /> : <CheckCircle2 size={15} aria-hidden />}
                <span>{status}</span>
                {(placements[menu.handle] ?? []).length === 0 && !isEarlierVersion(menu.handle) && (
                  <span className="jk-muted">· To show this menu, pick it in your header or footer in the <button type="button" className="jk-link" onClick={() => router.push("/admin/online-store/editor")}>store designer</button>.</span>
                )}
              </div>
              {issues.length > 0 && (
                <Banner tone="warning" title={`${issues.length} link${issues.length === 1 ? "" : "s"} won't work for shoppers`}>
                  <ul className="jnav-issues">{issues.map((issue) => <li key={issue.id}><strong>{issue.label || "Unnamed link"}:</strong> {issue.problem}</li>)}</ul>
                </Banner>
              )}
              <Card>
                <MenuBuilder key={menu.id} items={menu.items} resources={resources} searchProducts={searchProducts}
                  uploadImage={async (file) => (await editor.uploadMedia(storeId, file)).url}
                  onChange={(items) => setMenus((current) => current.map((entry) => entry.id === menu.id ? { ...entry, items } : entry))} />
              </Card>
            </div>
          )}
        </div>
      )}
      <PreviewDialog open={previewOpen} onClose={() => setPreviewOpen(false)} storeSlug={storeSlug} label="Preview your menus"
        subtitle="your menus as they'd look in your header and footer"
        draft={{ kind: "menus", menus: Object.fromEntries(menus.map((entry) => [entry.handle, menuItemsForSaving(entry.items)])) }} />
      <ConfirmDialog open={confirmAll !== null} onOpenChange={(open) => { if (!open) setConfirmAll(null); }}
        title="Publish your store design too?"
        description="Your store design also has changes that aren't live yet (made in the store designer). Publishing now makes those live along with your menus. To check them first, open the store designer."
        confirmLabel="Publish everything" onConfirm={async () => { setConfirmAll(null); await publish(true); }} />
    </AdminPage>
  );
}

function countUnnamed(items: NavigationMenu["items"]): number {
  return items.reduce((total, item) => total + (item.label.trim() ? 0 : 1) + countUnnamed(item.children), 0);
}
