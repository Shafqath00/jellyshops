"use client";

import { useEffect, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/admin";

type Confirmation = { title: string; description: string; confirmLabel: string; destructive?: boolean };

/** Resolve only the requested decision; closing a dialog never performs the action. */
export function useProductConfirm() {
  const [question, setQuestion] = useState<Confirmation | null>(null);
  const resolve = useRef<((value: boolean) => void) | null>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const focusScope = useRef<HTMLElement | null>(null);
  useEffect(() => () => { resolve.current?.(false); }, []);
  function ask(input: Confirmation) {
    resolve.current?.(false);
    trigger.current = document.activeElement as HTMLElement;
    focusScope.current = trigger.current?.closest<HTMLElement>('[role="dialog"],.product-surface') ?? null;
    setQuestion(input);
    return new Promise<boolean>(done => { resolve.current = done; });
  }
  function finish(value: boolean) {
    resolve.current?.(value);
    resolve.current = null;
    setQuestion(null);
  }
  function restoreFocus(event: Event) {
    event.preventDefault();
    const scope = focusScope.current?.isConnected ? focusScope.current : document.querySelector<HTMLElement>(".product-surface");
    const candidates = [trigger.current, scope?.querySelector<HTMLElement>(".product-sheet-close"), scope?.querySelector<HTMLElement>("#pb-title"), scope?.querySelector<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled)')];
    candidates.find(target => target?.isConnected && !target.matches(":disabled") && !target.closest("[inert],[hidden]"))?.focus();
  }
  const dialog = <ConfirmDialog open={Boolean(question)} onOpenChange={open => { if (!open) finish(false); }} title={question?.title ?? "Confirm action"} description={question?.description ?? ""} confirmLabel={question?.confirmLabel ?? "Continue"} destructive={question?.destructive} className="product-overlay" overlayClassName="product-backdrop" onConfirm={() => finish(true)} onCloseAutoFocus={restoreFocus} />;
  return { ask, dialog };
}
