"use client";

import { useRef, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { FileUp } from "lucide-react";
import { Banner, Button } from "@/components/admin";
import type { StorePreferences } from "@jelly/storefront-schema";
import { SECTION_LABELS, SECTION_WARNINGS, applySections, differingSections, parseImport, type ParsedImport, type SectionKey } from "./settings-transfer";

/**
 * Import settings from a file. Nothing is saved here: the chosen sections go into the form so the owner can look at
 * them and press Save (or Discard) like any other change.
 */
export function ImportDialog({ open, onOpenChange, current, onApply }: { open: boolean; onOpenChange: (open: boolean) => void; current: StorePreferences; onApply: (next: StorePreferences, sections: SectionKey[]) => void }) {
  return <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="jk-overlay" />
      <DialogPrimitive.Content className="jk-dialog jk-dialog-wide" aria-describedby={undefined}>
        {/* Mounted on open so it always starts empty. */}
        {open && <ImportForm current={current} onApply={onApply} />}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  </DialogPrimitive.Root>;
}

function ImportForm({ current, onApply }: { current: StorePreferences; onApply: (next: StorePreferences, sections: SectionKey[]) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState<ParsedImport | null>(null);
  const [chosen, setChosen] = useState<Set<SectionKey>>(new Set());

  async function read(file: File) {
    setFileName(file.name);
    const result = parseImport(await file.text());
    setParsed(result);
    // Policy page choices and tracking IDs belong to the source store, so they start unticked.
    setChosen(result.ok ? new Set(differingSections(current, result.preferences).filter((key) => key !== "tracking" && key !== "policies")) : new Set());
  }
  const differing = parsed?.ok ? differingSections(current, parsed.preferences) : [];
  const toggle = (key: SectionKey) => setChosen((value) => { const next = new Set(value); if (!next.delete(key)) next.add(key); return next; });

  return <>
    <DialogPrimitive.Title className="jk-dialog-title">Import settings</DialogPrimitive.Title>
    <div className="jk-dialog-body jk-stack-sm">
      <p className="jk-muted">Choose a file you exported from Site preferences. You&apos;ll pick what to copy, then check it on the page and save. Photos aren&apos;t included.</p>
      <div className="jk-row">
        <Button onClick={() => input.current?.click()}><FileUp size={14} aria-hidden="true" /> {fileName ? "Choose another file" : "Choose file"}</Button>
        {fileName && <span className="jk-muted">{fileName}</span>}
        <input ref={input} type="file" accept=".json,application/json" hidden aria-label="Preferences file" onChange={(event) => { const file = event.target.files?.[0]; if (file) void read(file); event.target.value = ""; }} />
      </div>
      {parsed && !parsed.ok && <Banner tone="critical" title="Couldn't import">
        {parsed.message}
        {parsed.problems.length > 0 && <ul className="jk-bullets">{parsed.problems.slice(0, 5).map((problem) => <li key={problem.path}><span className="jk-code">{problem.path}</span>: {problem.message}</li>)}</ul>}
      </Banner>}
      {parsed?.ok && (differing.length === 0
        ? <Banner tone="info">This file matches your current settings. Nothing to import.</Banner>
        : <fieldset className="jk-stack-sm"><legend className="jk-subheading">What would change</legend>
          {differing.map((key) => <label key={key} className="jk-check"><input type="checkbox" checked={chosen.has(key)} onChange={() => toggle(key)} />
            <span><span className="jk-strong">{SECTION_LABELS[key]}</span>{SECTION_WARNINGS[key] && <><br /><small className="jk-muted">{SECTION_WARNINGS[key]}</small></>}</span></label>)}
        </fieldset>)}
    </div>
    <div className="jk-dialog-footer">
      <DialogPrimitive.Close asChild><button type="button" className="jk-button">Cancel</button></DialogPrimitive.Close>
      <DialogPrimitive.Close asChild>
        <Button variant="primary" disabled={!parsed?.ok || chosen.size === 0} onClick={() => { if (parsed?.ok) onApply(applySections(current, parsed.preferences, [...chosen]), [...chosen]); }}>
          {chosen.size ? `Copy ${chosen.size} ${chosen.size === 1 ? "section" : "sections"} to the page` : "Copy to the page"}
        </Button>
      </DialogPrimitive.Close>
    </div>
  </>;
}
