"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight, CheckCircle2, ChevronDown, Circle, Minus, type LucideIcon } from "lucide-react";

export type Trend = "up" | "down" | "flat";

/** Direction of a change, for the arrow and colour next to a figure. */
export function trendOf(current: number, previous: number): Trend {
  if (current === previous || (!previous && !current)) return "flat";
  return current > previous ? "up" : "down";
}

const TREND_ICON: Record<Trend, LucideIcon> = { up: ArrowUpRight, down: ArrowDownRight, flat: Minus };

/** One headline figure: label, value and how it compares, with an optional link. */
export function KpiCard({ label, value, hint, trend, icon: Icon, href, loading = false }: {
  label: string; value?: string; hint?: string; trend?: Trend; icon: LucideIcon; href?: string; loading?: boolean;
}) {
  const TrendIcon = trend ? TREND_ICON[trend] : null;
  const body = <>
    <div className="jk-kpi-head"><span className="jk-kpi-icon" aria-hidden="true"><Icon size={16} /></span><span className="jk-kpi-label">{label}</span>
      {href && <ArrowRight size={14} className="jk-kpi-go" aria-hidden="true" />}</div>
    {loading ? <><span className="jk-skeleton" style={{ width: "55%", height: 28, marginTop: 6 }} /><span className="jk-skeleton" style={{ width: "80%", height: 12, marginTop: 8 }} /></> : <>
      <strong className="jk-kpi-value">{value}</strong>
      {hint && <span className={`jk-kpi-hint ${trend ? `is-${trend}` : ""}`}>{TrendIcon && <TrendIcon size={14} aria-hidden="true" />}<span>{hint}</span></span>}
    </>}
  </>;
  return href && !loading ? <Link href={href} className="jk-kpi is-link">{body}</Link> : <div className="jk-kpi" aria-busy={loading || undefined}>{body}</div>;
}

export type SetupStep = { label: string; help: string; href: string; action: string; done?: boolean };

/**
 * Setup guide: progress bar, then each step. The first step still to do is open with its help
 * and a button; the others fold, and any can be opened.
 */
export function SetupGuide({ steps }: { steps: SetupStep[] }) {
  const doneCount = steps.filter((step) => step.done).length;
  const firstOpen = steps.findIndex((step) => !step.done);
  const [openIndex, setOpenIndex] = useState(firstOpen);
  const [collapsed, setCollapsed] = useState(false);
  return <section className="jk-card jk-setup" aria-labelledby="jk-setup-title">
    <div className="jk-setup-head">
      <div className="min-w-0">
        <h2 id="jk-setup-title">Set up your store</h2>
        <p>Do these once and your store is ready to take orders.</p>
      </div>
      <button type="button" className="jk-icon-button" aria-expanded={!collapsed} aria-controls="jk-setup-steps" aria-label={collapsed ? "Show setup steps" : "Hide setup steps"} onClick={() => setCollapsed((value) => !value)}>
        <ChevronDown size={18} aria-hidden="true" style={{ transform: collapsed ? "rotate(-90deg)" : undefined }} />
      </button>
    </div>
    <div className="jk-progress-row">
      <span className="jk-progress-text">{doneCount} of {steps.length} done</span>
      <div className="jk-progress" role="progressbar" aria-label="Setup progress" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={doneCount}>
        <span style={{ width: `${(doneCount / steps.length) * 100}%` }} />
      </div>
    </div>
    {!collapsed && <ol className="jk-setup-steps" id="jk-setup-steps">{steps.map((step, index) => {
      const open = index === openIndex;
      return <li key={step.label} className={`${step.done ? "is-done" : ""} ${open ? "is-open" : ""}`}>
        {step.done ? <CheckCircle2 size={20} aria-hidden="true" className="jk-step-icon is-done" /> : <Circle size={20} aria-hidden="true" className="jk-step-icon" />}
        <div className="min-w-0 flex-1">
          {open && !step.done ? <>
            <Link href={step.href} className="jk-step-title">{step.label}</Link>
            <p className="jk-step-help">{step.help}</p>
            <Link href={step.href} className="jk-button jk-button-primary jk-step-action">{step.action}</Link>
          </> : <button type="button" className="jk-step-title" aria-expanded={open} onClick={() => setOpenIndex(open ? -1 : index)}>
            {step.label}<span className="sr-only">{step.done ? " (done)" : ""}</span>
          </button>}
          {open && step.done && <p className="jk-step-help">Done. <Link href={step.href} className="jk-link">Review it</Link></p>}
        </div>
      </li>;
    })}</ol>}
  </section>;
}
