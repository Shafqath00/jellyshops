"use client";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Banner } from "./feedback";

/** Warns before leaving the page while there are unsaved changes. */
export function useUnsavedChangesWarning(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
}

/** Appears only while something is unsaved: "Unsaved changes · Discard · Save". */
export function SaveBar({ dirty, saving = false, onSave, onDiscard, saveLabel = "Save" }: { dirty: boolean; saving?: boolean; onSave?: () => void; onDiscard: () => void; saveLabel?: string }) {
  if (!dirty && !saving) return null;
  return <div className="jk-savebar" role="region" aria-label="Unsaved changes">
    <span>{saving ? "Saving…" : "Unsaved changes"}</span>
    <div className="jk-savebar-actions">
      <button type="button" className="jk-button" disabled={saving} onClick={onDiscard}>Discard</button>
      <button type={onSave ? "button" : "submit"} className="jk-button jk-button-primary" disabled={saving} onClick={onSave}>{saving ? "Saving…" : saveLabel}</button>
    </div>
  </div>;
}

/**
 * A form made of cards with the save bar, a leave-page warning and one place for errors.
 * When `onSubmit` throws, its message is shown at the top of the form and nothing is lost.
 */
export function ResourceForm({ dirty, onSubmit, onDiscard, children, saveLabel }: {
  dirty: boolean; onSubmit: () => Promise<void>; onDiscard: () => void; children: ReactNode; saveLabel?: string;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useUnsavedChangesWarning(dirty);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true); setError("");
    try { await onSubmit(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Could not save. Try again."); }
    finally { setSaving(false); }
  }
  return <form className="jk-form" onSubmit={(event) => void submit(event)}>
    {error && <Banner tone="critical" title="Not saved">{error}</Banner>}
    {children}
    <SaveBar dirty={dirty} saving={saving} onDiscard={() => { setError(""); onDiscard(); }} saveLabel={saveLabel} />
  </form>;
}

/** Label + control + help text + error, wired for screen readers. */
export function Field({ id, label, help, error, children }: { id: string; label: ReactNode; help?: ReactNode; error?: string; children: ReactNode }) {
  return <div className="jk-field">
    <label htmlFor={id}>{label}</label>
    {children}
    {help && <small id={`${id}-help`} className="jk-muted">{help}</small>}
    {error && <small id={`${id}-error`} className="jk-field-error" role="alert">{error}</small>}
  </div>;
}
