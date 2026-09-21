import * as React from "react";
import { cn } from "@/lib/utils";

export type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

export function Badge({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { variant?: BadgeVariant }) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors",
        "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        variant === "default" &&
          "border-transparent bg-primary text-primary-foreground shadow",
        variant === "secondary" &&
          "border-transparent bg-secondary text-secondary-foreground",
        variant === "destructive" &&
          "border-transparent bg-destructive text-destructive-foreground shadow",
        variant === "outline" && "text-foreground",
        className,
      )}
      {...props}
    />
  );
}
