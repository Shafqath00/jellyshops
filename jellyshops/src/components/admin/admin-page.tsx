"use client";
import Link from "next/link";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ChevronDown } from "lucide-react";

export type PageAction = { label: string; onAction?: () => void; href?: string; disabled?: boolean; destructive?: boolean };

function ActionButton({ action, primary = false }: { action: PageAction; primary?: boolean }) {
  const className = `jk-button ${primary ? "jk-button-primary" : ""} ${action.destructive ? "jk-button-critical" : ""}`;
  return action.href && !action.disabled
    ? <Link href={action.href} className={className}>{action.label}</Link>
    : <button type="button" className={className} disabled={action.disabled} onClick={action.onAction}>{action.label}</button>;
}

/** "More actions": a disclosure list of buttons. Escape or a click outside closes it. */
export function MoreActions({ actions, label = "More actions" }: { actions: PageAction[]; label?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const close = (event: Event) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", close);
    document.addEventListener("pointerdown", close);
    return () => { document.removeEventListener("keydown", close); document.removeEventListener("pointerdown", close); };
  }, [open]);
  if (!actions.length) return null;
  return <div className="jk-more" ref={ref}>
    <button type="button" className="jk-button" aria-expanded={open} aria-controls={id} onClick={() => setOpen((value) => !value)}>{label}<ChevronDown size={14} aria-hidden="true" /></button>
    {open && <div className="jk-more-list" id={id}>{actions.map((action) => action.href && !action.disabled
      ? <Link key={action.label} href={action.href} className="jk-more-item" onClick={() => setOpen(false)}>{action.label}</Link>
      : <button key={action.label} type="button" className={`jk-more-item ${action.destructive ? "is-critical" : ""}`} disabled={action.disabled} onClick={() => { setOpen(false); action.onAction?.(); }}>{action.label}</button>)}</div>}
  </div>;
}

export type AdminPageProps = {
  title: string;
  /** One line saying what this page is for. Every page should have one. */
  description?: ReactNode;
  back?: { href: string; label: string };
  badges?: ReactNode;
  primaryAction?: PageAction;
  secondaryActions?: PageAction[];
  moreActions?: PageAction[];
  /** full = lists, detail = 2/3 + 1/3 pages, narrow = settings forms */
  width?: "full" | "detail" | "narrow";
  children: ReactNode;
};

export function AdminPage({ title, description, back, badges, primaryAction, secondaryActions = [], moreActions = [], width = "full", children }: AdminPageProps) {
  return <div className={`jk-page jk-page-${width}`}>
    <header className="jk-page-header">
      <div className="jk-page-title">
        {back && <Link href={back.href} className="jk-back" aria-label={`Back to ${back.label}`}><ArrowLeft size={16} aria-hidden="true" /></Link>}
        <div className="min-w-0">
          <div className="jk-title-row"><h1>{title}</h1>{badges}</div>
          {description && <p className="jk-page-description">{description}</p>}
        </div>
      </div>
      {(primaryAction || secondaryActions.length > 0 || moreActions.length > 0) && <div className="jk-page-actions">
        <MoreActions actions={moreActions} />
        {secondaryActions.map((action) => <ActionButton key={action.label} action={action} />)}
        {primaryAction && <ActionButton action={primaryAction} primary />}
      </div>}
    </header>
    {children}
  </div>;
}

/** Two-column detail layout: main content and a side column that drops below on small screens. */
export function DetailLayout({ main, side }: { main: ReactNode; side?: ReactNode }) {
  return <div className="jk-detail"><div className="jk-detail-main">{main}</div>{side && <aside className="jk-detail-side">{side}</aside>}</div>;
}

export function Card({ title, description, actions, children, flush = false }: { title?: string; description?: ReactNode; actions?: ReactNode; children: ReactNode; flush?: boolean }) {
  return <section className={`jk-card ${flush ? "is-flush" : ""}`}>
    {(title || actions) && <div className="jk-card-header"><div>{title && <h2>{title}</h2>}{description && <p>{description}</p>}</div>{actions}</div>}
    {children}
  </section>;
}
