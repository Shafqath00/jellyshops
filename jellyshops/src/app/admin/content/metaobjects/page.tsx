"use client";

import { useEffect, useMemo, useState } from "react";
import { Shapes } from "lucide-react";
import { AdminPage, Banner, Button, Card, EmptyState, SelectList, SplitLayout, StatusBadge } from "@/components/admin";
import { useAuth } from "@/features/auth/providers/auth-provider";

interface MetaobjectDefinition {
  id: string;
  handle: string;
  name: string;
  storefrontVisible: boolean;
  archivedAt: string | null;
  fields: Array<{ handle: string; name: string; type: string; storefrontVisible: boolean }>;
}

interface MetaobjectEntry {
  id: string;
  handle: string;
  displayName: string;
  archivedAt: string | null;
}

export default function MetaobjectsPage() {
  const { session, activeStore } = useAuth();
  const storeId = activeStore?.id ?? "";
  const token = session?.access_token;
  const origin = process.env.NEXT_PUBLIC_STORE_EDITOR_API_URL ?? "http://localhost:3001";
  const [definitions, setDefinitions] = useState<MetaobjectDefinition[]>([]);
  const [activeId, setActiveId] = useState("");
  const [entries, setEntries] = useState<MetaobjectEntry[]>([]);
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const headers = useMemo(() => token ? { Authorization: `Bearer ${token}` } : null, [token]);

  useEffect(() => {
    if (!headers) return;
    let active = true;
    void fetch(`${origin}/api/stores/${storeId}/custom-data/metaobjects`, { headers })
      .then(async (response) => {
        if (!response.ok) throw new Error("We could not load your custom content. Check your connection and try again.");
        return await response.json() as MetaobjectDefinition[];
      })
      .then((next) => {
        if (!active) return;
        setDefinitions(next);
        setActiveId((current) => current || next.find((definition) => !definition.archivedAt)?.id || next[0]?.id || "");
      })
      .catch((reason: unknown) => active && setError(reason instanceof Error ? reason.message : "We could not load your custom content."))
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headers, origin, attempt]);

  useEffect(() => {
    if (!headers || !activeId) {
      return;
    }
    let active = true;
    void fetch(`${origin}/api/stores/${storeId}/custom-data/metaobjects/${encodeURIComponent(activeId)}/entries`, { headers })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Metaobject entries request failed (${response.status})`);
        return await response.json() as MetaobjectEntry[];
      })
      .then((next) => { if (active) setEntries(next); })
      .catch(() => { if (active) setEntries([]); });
    return () => { active = false; };
  }, [activeId, headers, origin]);

  const definition = definitions.find((entry) => entry.id === activeId);
  if (!headers) return <AdminPage title="Custom content"><Banner tone="warning">Sign in to manage custom content.</Banner></AdminPage>;

  return (
    <AdminPage title="Custom content" description="Your own content types, such as team members or showroom locations, and their entries.">
      {error && <Banner tone="critical" title="Custom content did not load" action={<Button size="small" onClick={() => { setError(undefined); setLoading(true); setAttempt((count) => count + 1); }}>Try again</Button>}>{error}</Banner>}
      <SplitLayout wideList list={<SelectList label="Content types" title="Content types" loading={loading} selectedId={activeId} onSelect={setActiveId}
        items={definitions.map((entry) => ({ id: entry.id, label: entry.name, sub: entry.handle, badge: entry.archivedAt ? <StatusBadge kind="content" value="ARCHIVED" /> : undefined }))}
        empty="No content types yet." />}>
        {definition ? (
          <Card flush title={definition.name} description={`${definition.storefrontVisible ? "Can be shown in your store" : "Only visible in the admin"} · ${definition.fields.length} ${definition.fields.length === 1 ? "field" : "fields"}`}>
            {entries.length ? <ul className="jk-list">{entries.map((entry) => <li key={entry.id} className="jk-list-row" style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}>
              <span className="min-w-0"><span className="jk-strong">{entry.displayName}</span><span className="jk-cell-sub truncate">{entry.handle}</span></span>
              {entry.archivedAt && <StatusBadge kind="content" value="ARCHIVED" />}
            </li>)}</ul> : <EmptyState icon={Shapes} title="No entries yet" description="Entries you add for this content type show up here." />}
          </Card>
        ) : !loading && <Card><EmptyState icon={Shapes} title={definitions.length ? "Choose a content type" : "No custom content yet"} description={definitions.length ? "Pick a content type to see its entries." : "Content types are set up under Settings > Custom data."} /></Card>}
      </SplitLayout>
    </AdminPage>
  );
}
