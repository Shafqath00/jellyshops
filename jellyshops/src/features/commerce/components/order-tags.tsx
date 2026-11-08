"use client";
import { useState } from "react";
import { Card, TagInput, useToast } from "@/components/admin";

/** Tags card on the order page. Saves when the merchant presses Save tags. */
export function OrderTags({ initial, onSave }: { initial: string[]; onSave: (tags: string[]) => Promise<string[]> }) {
  const toast = useToast();
  const [saved, setSaved] = useState(initial);
  const [tags, setTags] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dirty = JSON.stringify(tags) !== JSON.stringify(saved);
  async function save() {
    setBusy(true); setError("");
    try { const result = await onSave(tags); setSaved(result); setTags(result); toast("Tags saved"); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Could not save tags."); }
    finally { setBusy(false); }
  }
  return <Card title="Tags" description="Your own labels for this order, for example gift or wholesale.">
    <TagInput label="Order tags" value={tags} onChange={setTags} />
    {error && <p className="jk-field-error mt-2" role="alert">{error}</p>}
    {dirty && <div className="jk-row mt-3"><button type="button" className="jk-button jk-button-primary" disabled={busy} onClick={() => void save()}>{busy ? "Saving…" : "Save tags"}</button><button type="button" className="jk-button" disabled={busy} onClick={() => setTags(saved)}>Cancel</button></div>}
  </Card>;
}
