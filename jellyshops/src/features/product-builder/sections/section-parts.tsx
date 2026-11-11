"use client";

import { useState, type ReactNode } from "react";
import { AnimatedDetails } from "../animated-details";
import { ChevronDown } from "lucide-react";

export function Section({ title, hint, children, collapsible = false, defaultOpen = false, summary }: { title: string; hint?: string; children: ReactNode; collapsible?: boolean; defaultOpen?: boolean; summary?: string }) {
  const [open, setOpen] = useState(defaultOpen);
  if (collapsible) return (
    <AnimatedDetails className="jk-card jk-optional-section" open={open} onToggle={event => setOpen(event.currentTarget.open)}>
      <summary><div><h2>{title}</h2><p>{summary || hint}</p></div><span className="jk-field-kind">Optional</span><ChevronDown size={16} aria-hidden="true" /></summary>
      <div className="jk-section-body">{hint && <p className="jk-section-hint">{hint}</p>}{children}</div>
    </AnimatedDetails>
  );
  return (
    <section className="jk-card">
      <div className="jk-card-header"><div><h2>{title}</h2>{hint && <p>{hint}</p>}</div></div>
      <div className="jk-section-body">{children}</div>
    </section>
  );
}

export function Field({ id, label, error, hint, children, required }: { id: string; label: string; error?: string; hint?: string; children: ReactNode; required?: boolean }) {
  return (
    <div>
      <div className="jk-field-label"><label htmlFor={id} className="jk-label">{label}</label>{required !== undefined && <span className="jk-field-kind">{required ? "Required" : "Optional"}</span>}</div>
      {children}
      {hint && !error && <p className="jk-help">{hint}</p>}
      {error && <p id={`${id}-error`} role="alert" className="jk-field-error jk-help">{error}</p>}
    </div>
  );
}
