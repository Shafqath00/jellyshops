"use client";
import { useState, type ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";

/** Asks before something that cannot be undone. Name the item and the consequence in `description`. */
export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel, destructive = false, onConfirm }: {
  open: boolean; onOpenChange: (open: boolean) => void; title: string; description: ReactNode; confirmLabel: string; destructive?: boolean;
  onConfirm: () => void | Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function confirm() {
    setBusy(true); setError("");
    try { await onConfirm(); onOpenChange(false); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "That did not work. Try again."); }
    finally { setBusy(false); }
  }
  return <DialogPrimitive.Root open={open} onOpenChange={(value) => { if (!busy) { setError(""); onOpenChange(value); } }}>
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="jk-overlay" />
      <DialogPrimitive.Content className="jk-dialog" aria-describedby={undefined}>
        <DialogPrimitive.Title className="jk-dialog-title">{title}</DialogPrimitive.Title>
        <div className="jk-dialog-body">{description}{error && <p className="jk-field-error" role="alert">{error}</p>}</div>
        <div className="jk-dialog-footer">
          <DialogPrimitive.Close asChild><button type="button" className="jk-button" disabled={busy}>Cancel</button></DialogPrimitive.Close>
          <button type="button" className={`jk-button ${destructive ? "jk-button-critical-solid" : "jk-button-primary"}`} disabled={busy} onClick={() => void confirm()}>{busy ? "Working…" : confirmLabel}</button>
        </div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  </DialogPrimitive.Root>;
}
