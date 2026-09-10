"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { migrateStorefrontDocument } from "@jelly/storefront-schema";
import type { CommerceDataProvider } from "@jelly/storefront-renderer";

import { useShop } from "@/contexts/shop-context";
import {
  createStoreEditorApi,
  type StoreEditorApi,
} from "@/features/store-editor/api/client";
import { getDemoSession } from "@/features/store-editor/api/demo-session";
import type { DemoCatalog } from "@/features/store-editor/api/types";
import { EditorShell } from "@/features/store-editor/components/editor-shell";

export function StoreDesignEditor({
  api,
}: {
  api: StoreEditorApi;
}) {
  const { state, repository } = useShop();

  const store = state.stores.find(
    ({ id }) => id === state.activeStoreId
  )!;

  const storeId = store.id;

  const [source, setSource] = useState<{
    document: ReturnType<typeof migrateStorefrontDocument>;
    revision: number;
  } | null>(null);

  const [catalog, setCatalog] = useState<DemoCatalog>({
    products: [],
    collections: [],
  });

  useEffect(() => {
    let active = true;

    const localRecord = repository.getStoreDesign(storeId)!;

    void Promise.all([
      api.loadDraft("store-demo"),
      api.listCatalog(),
    ])
      .then(([draft, nextCatalog]) => {
        if (!active) return;

        setSource({
          document: migrateStorefrontDocument(
            draft.document,
            "store-demo"
          ),
          revision: draft.revision,
        });

        setCatalog(nextCatalog);
      })
      .catch(() => {
        if (!active) return;

        setSource({
          document: migrateStorefrontDocument(
            localRecord.draftDocument,
            "store-demo"
          ),
          revision: localRecord.draftRevision,
        });
      });

    return () => {
      active = false;
    };
  }, [api, repository, storeId]);

  const commerce: CommerceDataProvider = {
    async getProducts() {
      return repository
        .listProducts(store.slug)
        .filter(
          ({ published, archived }) =>
            published && !archived
        )
        .map((product) => ({
          id: product.id,
          name: product.name,
          href: `/${store.slug}/products/${product.slug}`,
          imageUrl: product.imageUrl,
          price: `${store.currency} ${(
            (product.variants[0]?.priceMinor ?? 0) / 100
          ).toFixed(2)}`,
        }));
    },
  };

  if (!source) {
    return (
      <main
        className="fixed inset-0 z-[60] grid place-items-center bg-[#f6f6f7]"
        aria-live="polite"
      >
        <div className="text-center">
          <span className="mx-auto grid size-10 place-items-center rounded-xl bg-jelly-guava text-sm font-black text-jelly-ink">
            J
          </span>

          <p className="mt-4 text-[13px] font-medium text-[#616161]">
            Loading store editor…
          </p>
        </div>
      </main>
    );
  }

  return (
    <EditorShell
      initialDocument={source.document}
      revision={source.revision}
      commerce={commerce}
      catalog={catalog}
      upload={(file, onProgress) =>
        api.uploadMedia("store-demo", file, onProgress)
      }
      onSave={async (document, revision) =>
        (
          await api.saveDraft(
            "store-demo",
            revision,
            document
          )
        ).revision
      }
      onPublish={async (_document, revision) => {
        await api.publish("store-demo", revision);
      }}
      onReload={async () => {
        const draft = await api.loadDraft("store-demo");

        return {
          document: migrateStorefrontDocument(
            draft.document,
            "store-demo"
          ),
          revision: draft.revision,
        };
      }}
    />
  );
}

export default function StoreDesignPage() {
  const session = getDemoSession();
  const token = session?.token;

  const api = useMemo(
    () =>
      token
        ? createStoreEditorApi({
            baseUrl:
              process.env.NEXT_PUBLIC_STORE_EDITOR_API_URL ??
              "http://localhost:3001",
            token,
          })
        : null,
    [token]
  );

  if (!api) {
    return (
      <main className="fixed inset-0 z-[60] grid place-items-center bg-[#f6f6f7] px-6">
        <div className="w-full max-w-[420px] rounded-2xl border border-[#e3e3e3] bg-white p-8 text-center shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
          <span className="mx-auto grid size-10 place-items-center rounded-xl bg-[#f1f1f1] text-sm font-bold text-[#303030]">
            J
          </span>

          <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8c9196]">
            Store design
          </p>

          <h1 className="mt-2 text-xl font-semibold tracking-[-0.02em] text-[#202223]">
            Store Editor is disabled
          </h1>

          <p className="mx-auto mt-2 max-w-[330px] text-[13px] leading-5 text-[#6d7175]">
            Connect Firebase Authentication before enabling
            the editor in production.
          </p>

          <Link
            href="/admin"
            className="mt-6 inline-flex h-9 items-center justify-center rounded-lg border border-[#c9cccf] bg-white px-4 text-[13px] font-semibold text-[#303030] hover:bg-[#f6f6f7]"
          >
            Back to admin
          </Link>
        </div>
      </main>
    );
  }

  return <StoreDesignEditor api={api} />;
}
