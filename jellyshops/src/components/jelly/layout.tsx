import * as React from "react";
import { cn } from "@/lib/utils";

/* ──────────────────────────────────────────────────────────────────────
 * Container — max-width content wrapper with consistent responsive padding
 * ──────────────────────────────────────────────────────────────────── */
export function Container({
  as: Tag = "div",
  size = "default",
  className,
  children,
  ...props
}: {
  as?: React.ElementType;
  size?: "sm" | "default" | "lg" | "full";
  className?: string;
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLElement>) {
  return (
    <Tag
      className={cn(
        "mx-auto w-full px-5 sm:px-6 lg:px-8",
        size === "sm" && "max-w-3xl",
        size === "default" && "max-w-[1240px]",
        size === "lg" && "max-w-[1440px]",
        size === "full" && "max-w-none",
        className,
      )}
      {...props}
    >
      {children}
    </Tag>
  );
}

/* ──────────────────────────────────────────────────────────────────────
 * SectionHeader — commerce section heading (eyebrow + title + optional link)
 * ──────────────────────────────────────────────────────────────────── */
export function SectionHeader({
  eyebrow,
  title,
  action,
  className,
}: {
  eyebrow?: string;
  title: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-9 flex items-end justify-between gap-5", className)}>
      <div>
        {eyebrow && (
          <p className="text-[10px] font-extrabold uppercase tracking-[.12em] text-jelly-guava-deep">
            {eyebrow}
          </p>
        )}
        <h2 className="mt-1.5 font-[var(--font-jelly-display,Georgia)] text-[clamp(1.75rem,3.5vw,2.75rem)] tracking-[-0.045em] text-foreground leading-[1.05]">
          {title}
        </h2>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────
 * PageHeader — hero-scale page heading (shop, product, cart pages)
 * ──────────────────────────────────────────────────────────────────── */
export function PageHeader({
  eyebrow,
  title,
  description,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  className?: string;
}) {
  return (
    <header className={cn("max-w-[700px]", className)}>
      {eyebrow && (
        <p className="text-[10px] font-extrabold uppercase tracking-[.12em] text-jelly-guava-deep">
          {eyebrow}
        </p>
      )}
      <h1 className="mt-2 font-[var(--font-jelly-display,Georgia)] text-[clamp(3.5rem,7vw,7rem)] font-medium leading-[.88] tracking-[-0.07em] text-[var(--store-text,var(--foreground))]">
        {title}
      </h1>
      {description && (
        <p className="mt-4 text-[15px] leading-relaxed opacity-65">{description}</p>
      )}
    </header>
  );
}
