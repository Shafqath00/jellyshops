"use client";
import { Check, Circle } from "lucide-react";
import { Card, StatusBadge } from "@/components/admin";
import type { Readiness } from "./readiness";

/** Moves to the part of the builder that fixes an item and puts the keyboard there. */
function goTo(target: string) {
  const element = document.getElementById(target);
  if (!element) return;
  element.scrollIntoView?.({ behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ? "auto" : "smooth", block: "center" });
  const field = element.matches("input,textarea,select,button,[tabindex]") ? element : element.querySelector<HTMLElement>("input,textarea,select,button,[contenteditable=true]");
  field?.focus({ preventScroll: true });
}

/** The builder's checklist: what is done, what is missing, and a link to each missing part. */
export function ReadinessCard({ readiness }: { readiness: Readiness }) {
  return <Card title="Ready to sell?" actions={<StatusBadge tone={readiness.ready ? (readiness.done === readiness.total ? "success" : "info") : "attention"}>{readiness.done} of {readiness.total}</StatusBadge>}>
    <progress className="jk-progress" max={readiness.total} value={readiness.done} aria-label="Product checklist progress" />
    <p className="jk-muted" role="status">{readiness.summary}</p>
    <ul className="jk-checklist" aria-label="Product checklist">{readiness.items.map((item) => <li key={item.id} className={item.done ? "is-done" : ""}>
      {item.done ? <Check size={15} aria-hidden="true" /> : <Circle size={15} aria-hidden="true" />}
      <span className="min-w-0 flex-1"><span className="jk-strong">{item.label}</span><span className="sr-only">{item.done ? ": done" : item.essential ? ": needed" : ": recommended"}</span>
        {!item.done && <span className="jk-cell-sub">{item.hint}</span>}</span>
      {!item.done && <button type="button" className="jk-link" onClick={() => goTo(item.target)} aria-label={`Go to ${item.label}`}>{item.essential ? "Add" : "Fix"}</button>}
    </li>)}</ul>
  </Card>;
}
