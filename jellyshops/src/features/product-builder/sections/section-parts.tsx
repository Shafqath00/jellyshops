"use client";

import { useState, type ReactNode } from "react";
import { AnimatedDetails } from "../animated-details";
import { ChevronDown } from "lucide-react";
import { HelpTip } from "@/components/admin";

/**
 * One card of the product editor. Help text sits behind an (i) tip so the card shows only its title and fields.
 * Collapsible cards start closed (one-line summary); `forceOpen` opens them, for example when a field inside has an error.
 */
export function Section({ title, hint, description, children, collapsible = false, defaultOpen = false, forceOpen = false, summary }: { title: string; hint?: string; /** One short visible line under the title, for facts the merchant needs to see. */ description?: string; children: ReactNode; collapsible?: boolean; defaultOpen?: boolean; forceOpen?: boolean; summary?: string }) {
  const [open, setOpen] = useState(defaultOpen);
  if (collapsible) return (
    <AnimatedDetails className="jk-card jk-optional-section" open={open || forceOpen} onToggle={event => setOpen(event.currentTarget.open)}>
      <summary><div><h2>{title}</h2><p>{summary || hint}</p></div><ChevronDown size={16} aria-hidden="true" /></summary>
      <div className="jk-section-body">{hint && summary && <p className="jk-section-hint">{hint}</p>}{children}</div>
    </AnimatedDetails>
  );
  return (
    <section className="jk-card">
      <div className="jk-card-header"><div className="jk-title-row"><h2>{title}</h2>{hint && <HelpTip label={`About ${title.toLowerCase()}`}>{hint}</HelpTip>}</div>{description && <p>{description}</p>}</div>
      <div className="jk-section-body">{children}</div>
    </section>
  );
}

/** A labelled field. Its hint shows while the field is in use (and always when there is an error). */
export function Field({ id, label, error, hint, children, required }: { id: string; label: string; error?: string; hint?: string; children: ReactNode; required?: boolean }) {
  return (
    <div className="jk-pb-field">
      <div className="jk-field-label"><label htmlFor={id} className="jk-label">{label}</label>{required && <span className="jk-field-kind is-required">Required</span>}</div>
      {children}
      {hint && !error && <p className="jk-hint jk-hint-on-focus">{hint}</p>}
      {error && <p id={`${id}-error`} role="alert" className="jk-field-error jk-hint">{error}</p>}
    </div>
  );
}
