"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Check, ExternalLink, Pencil, X } from "lucide-react";
import { Button, ConfirmDialog, buttonClass } from "@/components/admin";
import { listStarterPacks } from "@jelly/storefront-themes";
import { templateDisplayName } from "../template-gallery";
import type { StoreDesigns } from "../hooks/use-store-designs";

/**
 * The two questions around using a design, shared by the Store designs library and the full-page
 * preview: "Switch to this design?" (when the store already has a draft), then "Customize or publish?"
 * once the design is saved as a draft.
 */
export function StoreDesignDialogs({ designs, onCustomize }: { designs: StoreDesigns; onCustomize(): void }) {
  const { switching, setSwitching, keepContent, setKeepContent, installStarter, ready } = designs;
  const switchingName = templateDisplayName(listStarterPacks().find((item) => item.id === switching?.starterId)?.name ?? "this design");
  return <>
    <ConfirmDialog open={Boolean(switching)} onOpenChange={(open) => { if (!open) setSwitching(null); }}
      title={`Switch to ${switchingName}?`}
      description={<>
        <p>Your new design is saved as a draft. Shoppers keep seeing your current store until you publish.</p>
        <p>Products, collections, pages, orders and customers stay as they are. The draft&apos;s page layouts and section text are replaced by the new design&apos;s.</p>
        <label className="mt-3 flex items-start gap-2.5 text-sm">
          <input type="checkbox" className="mt-0.5 size-4 shrink-0 accent-[var(--jk-accent)]" checked={keepContent} onChange={(event) => setKeepContent(event.target.checked)} />
          <span>Keep my logo, social links, languages and menus</span>
        </label>
      </>}
      confirmLabel="Switch design" onConfirm={() => { const choice = switching; if (choice) void installStarter(choice.starterId, choice.styleId); }} />
    {ready && <ReadyDialog designs={designs} onCustomize={onCustomize} />}
  </>;
}

function ReadyDialog({ designs, onCustomize }: { designs: StoreDesigns; onCustomize(): void }) {
  const { ready, setReady, publishDraft, activeStore } = designs;
  if (!ready) return null;
  const { publish } = ready;
  const busy = publish.status === "publishing";
  const close = () => { if (!busy) setReady(null); };
  const storeHref = activeStore ? `/${activeStore.slug}` : undefined;

  const title = publish.status === "published" ? `${ready.name} is live`
    : publish.status === "blocked" ? "A few things need fixing first"
    : `${ready.name} is ready`;

  return <DialogPrimitive.Root open onOpenChange={(open) => { if (!open) close(); }}>
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="jk-overlay" />
      <DialogPrimitive.Content className="jk-dialog" aria-describedby="design-ready-summary" data-design-ready={publish.status}>
        <div className="jk-dialog-title flex items-center justify-between gap-3">
          <DialogPrimitive.Title className="m-0 text-inherit">{title}</DialogPrimitive.Title>
          <DialogPrimitive.Close asChild><button type="button" className={buttonClass("quiet", "small")} aria-label="Close" disabled={busy}><X size={16} aria-hidden="true" /></button></DialogPrimitive.Close>
        </div>
        <div className="jk-dialog-body">
          {publish.status === "published" ? <p id="design-ready-summary">Shoppers now see {ready.name} on your store. Keep changing it in the editor; nothing changes for shoppers until you publish again.</p>
            : publish.status === "blocked" ? <>
              <p id="design-ready-summary">Your draft is saved, but it can&apos;t go live until these are fixed in the editor:</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">{publish.problems.map((problem, index) => <li key={`${problem}-${index}`}>{problem}</li>)}</ul>
            </>
            : <>
              <p id="design-ready-summary">We saved {ready.name} as a draft with all its pages. Your live store hasn&apos;t changed: shoppers see your current design until you publish.</p>
              <ul className="mt-3 space-y-1.5 text-sm">
                <li className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-[var(--jk-success-text)]" aria-hidden="true" />Your products, collections and pages are all here.</li>
                {ready.kept && <li className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-[var(--jk-success-text)]" aria-hidden="true" />Your logo, social links, languages and menus came across.</li>}
              </ul>
              {publish.status === "failed" && <p className="jk-field-error mt-3" role="alert">{publish.message}</p>}
            </>}
        </div>
        <div className="jk-dialog-footer">
          {publish.status === "published" ? <>
            {storeHref && <a href={storeHref} target="_blank" rel="noreferrer" className={buttonClass("secondary")}>View store<ExternalLink size={14} aria-hidden="true" /></a>}
            <Button variant="primary" onClick={onCustomize}><Pencil size={14} aria-hidden="true" />Keep customizing</Button>
          </> : publish.status === "blocked" ? <>
            <button type="button" className="jk-button" onClick={close}>Close</button>
            <Button variant="primary" onClick={onCustomize}><Pencil size={14} aria-hidden="true" />Fix in the editor</Button>
          </> : <>
            <Button variant="secondary" loading={busy} loadingLabel="Publishing…" onClick={() => void publishDraft()}>{publish.status === "failed" ? "Try publishing again" : "Publish now"}</Button>
            <Button variant="primary" disabled={busy} onClick={onCustomize}><Pencil size={14} aria-hidden="true" />Customize</Button>
          </>}
        </div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  </DialogPrimitive.Root>;
}
