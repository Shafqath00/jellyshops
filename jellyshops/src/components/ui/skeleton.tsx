import * as React from "react";
import { cn } from "@/lib/utils";

/* ──────────────────────────────────────────────────────────────────────
 * Skeleton — loading placeholder with shimmer animation
 * Uses Jellyshop motion tokens from globals.css @theme
 * ──────────────────────────────────────────────────────────────────── */

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "relative overflow-hidden rounded-md bg-muted",
        "before:absolute before:inset-0",
        "before:bg-gradient-to-r before:from-transparent before:via-white/40 before:to-transparent",
        "before:animate-jelly-shimmer before:bg-[length:200%_100%]",
        className,
      )}
      {...props}
    />
  );
}

/* Convenience skeleton shapes used across Jellyshop */
export function SkeletonProductCard({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-3", className)}>
      <Skeleton className="aspect-[4/5] w-full rounded-[28px]" />
      <div className="space-y-2 px-1">
        <Skeleton className="h-2.5 w-1/3 rounded-full" />
        <Skeleton className="h-4 w-3/4 rounded-md" />
      </div>
    </div>
  );
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn("h-3.5 rounded-full", i === lines - 1 ? "w-2/3" : "w-full")}
        />
      ))}
    </div>
  );
}

/* Table-shaped loading placeholder; the label stays available to screen readers. */
export function SkeletonRows({
  rows = 5,
  label,
  className,
}: {
  rows?: number;
  label: string;
  className?: string;
}) {
  return (
    <div role="status" className={cn("space-y-3 p-5", className)}>
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="size-9 shrink-0 rounded-lg" />
          <Skeleton className="h-3.5 w-1/4 rounded-full" />
          <Skeleton className="h-3.5 flex-1 rounded-full" />
          <Skeleton className="hidden h-3.5 w-16 rounded-full sm:block" />
        </div>
      ))}
    </div>
  );
}
