"use client";

import { useMemo, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import Link from "@/features/admin/admin-routing";
import { useParams } from "next/navigation";
import { useAdminRouter as useRouter } from "@/features/admin/admin-routing";
import { listStarterPacks } from "@jelly/storefront-themes";
import { buttonClass } from "@/components/admin";
import { StoreDesignDialogs } from "@/features/store-editor/components/store-design-dialogs";
import { useAuth } from "@/features/auth/providers/auth-provider";
import { TemplateLibraryPreview } from "@/features/store-editor/components/template-library-preview";
import { galleryTemplate } from "@/features/store-editor/template-gallery";
import { templatePreviewConfig } from "@/features/store-editor/template-preview-config";
import { EDITOR_HREF, STORE_DESIGNS_HREF, useStoreDesigns, useTemplateStoreData } from "@/features/store-editor/hooks/use-store-designs";

const subscribeNothing = () => () => {};

export default function TemplatePreviewPage() {
  const { activeStore } = useAuth();
  return <TemplatePreviewScreen key={activeStore?.id ?? "loading"} />;
}

function TemplatePreviewScreen() {
  const router = useRouter();
  const params = useParams<{ templateId: string }>();
  const templateId = decodeURIComponent(params.templateId ?? "");
  const starter = useMemo(() => listStarterPacks().find((item) => item.id === templateId), [templateId]);
  const designs = useStoreDesigns();
  const store = useTemplateStoreData(designs, Boolean(starter));
  const mounted = useSyncExternalStore(subscribeNothing, () => true, () => false);

  if (!starter) {
    return <main className="grid min-h-[60vh] place-items-center p-8 text-center">
      <div>
        <h1 className="text-xl font-semibold">This store design does not exist</h1>
        <p className="mt-2 text-sm text-[var(--jk-text-subdued)]">It may have been renamed or removed.</p>
        <Link href={STORE_DESIGNS_HREF} className={`${buttonClass("secondary")} mt-5`}>Back to templates</Link>
      </div>
    </main>;
  }

  const gallery = galleryTemplate(starter);
  const named = { ...starter, name: gallery.name };
  const config = templatePreviewConfig(named, store);
  const isCurrent = designs.hasWorkspace && designs.configuration?.themeId === starter.id;

  const screen = <>
    <TemplateLibraryPreview starter={named} config={config} category={gallery.category} backHref={STORE_DESIGNS_HREF}
      isCurrent={isCurrent} hasWorkspace={designs.hasWorkspace} busy={Boolean(designs.saving) || designs.loading || !designs.api}
      error={designs.error} usingStore={Boolean(store?.products.length)}
      onUse={(styleId) => designs.chooseStarter(starter.id, styleId)} onEdit={() => router.push(EDITOR_HREF)} />
    <StoreDesignDialogs designs={designs} onCustomize={() => router.push(EDITOR_HREF)} />
  </>;
  // Like the editor, the full-screen preview is drawn on <body>: the admin shell's fade-in would otherwise trap it under the header.
  return mounted ? createPortal(screen, document.body) : null;
}
