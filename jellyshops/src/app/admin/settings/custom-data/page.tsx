"use client";

import { useEffect, useMemo, useState } from "react";
import { Braces } from "lucide-react";
import { AdminPage, Banner, EmptyState, IndexTable, StatusBadge, humanizeCode } from "@/components/admin";
import { useAuth } from "@/features/auth/providers/auth-provider";

interface MetafieldDefinition {
  id: string;
  ownerType: string;
  namespace: string;
  key: string;
  name: string;
  description?: string;
  type: string;
  storefrontVisible: boolean;
  archivedAt: string | null;
}

const ownerTypes = ["store", "product", "variant", "collection", "page", "blog", "article"] as const;
const OWNER_LABELS: Record<(typeof ownerTypes)[number], string> = { store: "Store", product: "Products", variant: "Variants", collection: "Collections", page: "Pages", blog: "Blogs", article: "Blog posts" };

export default function CustomDataSettingsPage() {
  const { session, activeStore } = useAuth();
  const storeId = activeStore?.id ?? "";
  const token = session?.access_token;
  const origin = process.env.NEXT_PUBLIC_STORE_EDITOR_API_URL ?? "http://localhost:3001";
  const [ownerType, setOwnerType] = useState<(typeof ownerTypes)[number]>("product");
  const [definitions, setDefinitions] = useState<MetafieldDefinition[]>([]);
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const headers = useMemo(() => token ? { Authorization: `Bearer ${token}` } : null, [token]);

  useEffect(() => {
    if (!headers) return;
    let active = true;
    void fetch(`${origin}/api/stores/${storeId}/custom-data/metafields?ownerType=${encodeURIComponent(ownerType)}`, { headers })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Custom data request failed (${response.status})`);
        return await response.json() as MetafieldDefinition[];
      })
      .then((next) => { if (active) { setDefinitions(next); setError(undefined); } })
      .catch((reason: unknown) => active && setError(reason instanceof Error ? reason.message : "Unable to load custom data"))
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [headers, origin, ownerType, attempt]);

  if (!headers) return <AdminPage title="Custom data" back={{ href: "/admin/settings", label: "Settings" }}><Banner tone="warning">Sign in to manage custom data.</Banner></AdminPage>;

  return (
    <AdminPage title="Custom data" back={{ href: "/admin/settings", label: "Settings" }} description="Extra fields you can fill in on products, collections and other items, and show in your store.">
      <IndexTable<MetafieldDefinition>
        label="Custom fields"
        rows={definitions}
        rowKey={(row) => row.id}
        rowLabel={(row) => row.name}
        loading={loading}
        error={error}
        onRetry={() => { setError(undefined); setLoading(true); setAttempt((value) => value + 1); }}
        tabs={ownerTypes.map((type) => ({ id: type, label: OWNER_LABELS[type] }))}
        activeTab={ownerType}
        onTabChange={(id) => { setOwnerType(id as (typeof ownerTypes)[number]); setLoading(true); }}
        columns={[
          { id: "name", header: "Field", mobile: "primary", cell: (row) => <><span className="jk-strong">{row.name}</span><span className="jk-cell-sub">{row.namespace}.{row.key}</span></> },
          { id: "type", header: "Type", cell: (row) => humanizeCode(row.type) },
          { id: "visibility", header: "Shown in store", cell: (row) => <StatusBadge tone={row.storefrontVisible ? "success" : "neutral"}>{row.storefrontVisible ? "Yes" : "Admin only"}</StatusBadge> },
        ]}
        emptyState={<EmptyState icon={Braces} title={`No custom fields for ${OWNER_LABELS[ownerType].toLowerCase()} yet`} description="Fields keep their key once created, so store designs that use them keep working." />}
      />
    </AdminPage>
  );
}
