"use client";
import { cloneElement, isValidElement, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Banner } from "./feedback";
import { Button } from "./button";

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
      <Button type={onSave ? "button" : "submit"} variant="primary" loading={saving} loadingLabel="Saving…" onClick={onSave}>{saveLabel}</Button>
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

/**
 * Label + control + help text + error, wired for screen readers. Give the control the same `id`:
 * it is then told about the help text and the error (`aria-describedby`, `aria-invalid`) and, with
 * `required`, that it must be filled in. `required` marks the label; the page still checks the value.
 */
export function Field({ id, label, help, error, required = false, children }: { id: string; label: ReactNode; help?: ReactNode; error?: string; required?: boolean; children: ReactNode }) {
  const describedBy = [help ? `${id}-help` : "", error ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined;
  const control = isValidElement<Record<string, unknown>>(children) && children.props.id === id
    ? cloneElement(children, {
      "aria-describedby": children.props["aria-describedby"] ?? describedBy,
      "aria-invalid": children.props["aria-invalid"] ?? (error ? true : undefined),
      "aria-required": children.props["aria-required"] ?? (required || undefined),
    })
    : children;
  return <div className={`jk-field ${error ? "has-error" : ""}`}>
    <label htmlFor={id}>{label}{required && <span className="jk-required" aria-hidden="true"> *</span>}</label>
    {control}
    {help && <small id={`${id}-help`} className="jk-muted">{help}</small>}
    {error && <small id={`${id}-error`} className="jk-field-error" role="alert">{error}</small>}
  </div>;
}
