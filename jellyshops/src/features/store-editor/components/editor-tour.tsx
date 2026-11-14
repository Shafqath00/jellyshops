"use client";
import { useEffect, useState } from "react";
import { X } from "lucide-react";

const STORAGE_KEY = "jelly-editor-tour-done";
/** Fired by "Show the editor tour" in the ⋯ menu. */
export const OPEN_TOUR_EVENT = "jelly:editor-tour";

const STEPS = [
  { title: "Click anything to edit it", text: "Click a heading, photo or button in the preview. It gets an outline and its settings open on the right." },
  { title: "Your page, section by section", text: "The list on the left shows everything on this page. Drag to reorder, use the eye to hide, and ⋯ to duplicate or delete." },
  { title: "Settings for what you selected", text: "The panel on the right only shows the settings of the selected section or block. The line at the top says where you are." },
  { title: "Saved as you go", text: "Changes save on their own and only you can see them. Press Publish when you want shoppers to see them." },
];

function readDone() {
  try { return window.localStorage.getItem(STORAGE_KEY) === "1"; } catch { return false; }
}

/** A short, dismissible first-time walkthrough of the editor. */
export function EditorTour() {
  const [step, setStep] = useState<number | null>(() => (typeof window === "undefined" || readDone() ? null : 0));
  useEffect(() => {
    const open = () => setStep(0);
    window.addEventListener(OPEN_TOUR_EVENT, open);
    return () => window.removeEventListener(OPEN_TOUR_EVENT, open);
  }, []);
  if (step === null) return null;
  const finish = () => {
    try { window.localStorage.setItem(STORAGE_KEY, "1"); } catch { /* shows again next time */ }
    setStep(null);
  };
  const current = STEPS[step];
  const last = step === STEPS.length - 1;
  return <div role="dialog" aria-modal="false" aria-labelledby="editor-tour-title" className="fixed bottom-5 left-1/2 z-[90] w-[min(380px,calc(100vw-32px))] -translate-x-1/2 rounded-2xl bg-[var(--jk-ink,#0a0a0a)] p-5 text-white shadow-2xl">
    <button type="button" aria-label="Close the tour" onClick={finish} className="absolute right-3 top-3 grid size-8 place-items-center rounded-full text-white/70 hover:bg-white/10 hover:text-white"><X size={16} /></button>
    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/60">Step {step + 1} of {STEPS.length}</p>
    <h2 id="editor-tour-title" className="mt-1 pr-8 text-[16px] font-semibold">{current.title}</h2>
    <p className="mt-2 text-[13px] leading-5 text-white/80">{current.text}</p>
    <div className="mt-4 flex items-center justify-between gap-3">
      <button type="button" onClick={finish} className="text-[13px] font-medium text-white/70 underline-offset-2 hover:text-white hover:underline">Skip</button>
      <div className="flex gap-2">
        {step > 0 && <button type="button" onClick={() => setStep(step - 1)} className="h-9 rounded-full px-4 text-[13px] font-medium text-white ring-1 ring-white/25 hover:bg-white/10">Back</button>}
        <button type="button" onClick={() => last ? finish() : setStep(step + 1)} className="h-9 rounded-full bg-[var(--jk-lime,#c9ff18)] px-4 text-[13px] font-semibold text-[var(--jk-ink,#0a0a0a)]">{last ? "Start editing" : "Next"}</button>
      </div>
    </div>
  </div>;
}
