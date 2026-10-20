import * as React from "react";
import { cn } from "@/lib/utils";

/* ──────────────────────────────────────────────────────────────────────
 * Skeleton — loading placeholder with shimmer animation
 * Uses Jellyshop motion tokens from globals.css @theme
 * ──────────────────────────────────────────────────────────────────── */

export function Skeleton({
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
