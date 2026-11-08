"use client";
import type { ReactNode } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Info, Inbox, X, XCircle, type LucideIcon } from "lucide-react";
import * as Tooltip from "@radix-ui/react-tooltip";
import type { StatusTone } from "./status";

/** Says what a page is for and offers the one thing to do next. */
export function EmptyState({ icon: Icon = Inbox, title, description, action, secondaryAction, learnMore }: {
  icon?: LucideIcon; title: string; description: ReactNode; action?: ReactNode; secondaryAction?: ReactNode; learnMore?: { href: string; label: string };
}) {
  return <div className="jk-empty">
    <span className="jk-empty-icon" aria-hidden="true"><Icon size={22} /></span>
    <h2>{title}</h2>
    <p>{description}</p>
    {(action || secondaryAction) && <div className="jk-empty-actions">{secondaryAction}{action}</div>}
    {learnMore && <Link href={learnMore.href} className="jk-link">{learnMore.label}</Link>}
  </div>;
}

const bannerIcons: Partial<Record<StatusTone, LucideIcon>> = { success: CheckCircle2, warning: AlertTriangle, critical: XCircle, info: Info };

/** A page-level message. Critical banners are announced straight away. */
export function Banner({ tone = "info", title, children, action, onDismiss }: { tone?: StatusTone; title?: string; children?: ReactNode; action?: ReactNode; onDismiss?: () => void }) {
  const Icon = bannerIcons[tone] ?? Info;
  return <div className={`jk-banner jk-tone-${tone}`} role={tone === "critical" ? "alert" : "status"}>
    <Icon size={18} aria-hidden="true" className="jk-banner-icon" />
    <div className="jk-banner-body">{title && <strong>{title}</strong>}{children && <div>{children}</div>}{action && <div className="jk-banner-action">{action}</div>}</div>
    {onDismiss && <button type="button" className="jk-icon-button" aria-label="Dismiss" onClick={onDismiss}><X size={16} /></button>}
  </div>;
}

/** Grey shapes in the size of the content that is loading. */
export function SkeletonBlock({ width = "100%", height = 12 }: { width?: number | string; height?: number }) {
  return <span className="jk-skeleton" style={{ width, height }} aria-hidden="true" />;
}

export function TableSkeleton({ rows = 6, columns = 5, label = "Loading" }: { rows?: number; columns?: number; label?: string }) {
  return <div className="jk-table-skeleton" role="status" aria-label={label}>
    {Array.from({ length: rows }, (_, row) => <div key={row} className="jk-table-skeleton-row">
      {Array.from({ length: columns }, (_, column) => <SkeletonBlock key={column} width={column === 0 ? "70%" : `${40 + ((row + column) % 3) * 15}%`} />)}
    </div>)}
  </div>;
}

export function CardSkeleton({ lines = 3, label = "Loading" }: { lines?: number; label?: string }) {
  return <div className="jk-card" role="status" aria-label={label}><div className="jk-stack-sm"><SkeletonBlock width="35%" height={14} />{Array.from({ length: lines }, (_, index) => <SkeletonBlock key={index} width={`${90 - index * 15}%`} />)}</div></div>;
}

/** An (i) button next to a label that explains it in one line. */
export function HelpTip({ children, label = "More information" }: { children: ReactNode; label?: string }) {
  return <Tooltip.Provider delayDuration={150}><Tooltip.Root>
    <Tooltip.Trigger asChild><button type="button" className="jk-help" aria-label={label}><Info size={14} aria-hidden="true" /></button></Tooltip.Trigger>
    <Tooltip.Portal><Tooltip.Content className="jk-tooltip" sideOffset={6}>{children}<Tooltip.Arrow className="jk-tooltip-arrow" /></Tooltip.Content></Tooltip.Portal>
  </Tooltip.Root></Tooltip.Provider>;
}
