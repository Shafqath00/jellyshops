"use client";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "secondary" | "primary" | "destructive" | "destructive-quiet" | "quiet";
export type ButtonSize = "small" | "medium" | "large";

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  secondary: "",
  primary: "jk-button-primary",
  destructive: "jk-button-critical-solid",
  "destructive-quiet": "jk-button-critical",
  quiet: "jk-button-plain",
};
const SIZE_CLASS: Record<ButtonSize, string> = { small: "jk-button-sm", medium: "", large: "jk-button-lg" };

/** The class names for a kit button, for links that should look like one. */
export function buttonClass(variant: ButtonVariant = "secondary", size: ButtonSize = "medium") {
  return ["jk-button", VARIANT_CLASS[variant], SIZE_CLASS[size]].filter(Boolean).join(" ");
}

/**
 * The one button every admin page uses.
 * - `primary`: the single main action of a page or dialog. `secondary` (default): everything else.
 * - `destructive`: confirms something that removes data. `destructive-quiet`: opens that confirm.
 * - `quiet`: low-emphasis actions such as "Clear selection".
 * While `loading`, the button cannot be pressed again, shows a spinner and says `loadingLabel` to everyone.
 */
export function Button({ variant = "secondary", size = "medium", loading = false, loadingLabel = "Working…", icon, className = "", disabled, children, type = "button", ...rest }: {
  variant?: ButtonVariant; size?: ButtonSize; loading?: boolean; loadingLabel?: string; icon?: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...rest} type={type} className={`${buttonClass(variant, size)} ${className}`} disabled={disabled || loading} aria-busy={loading || undefined}>
    {loading ? <span className="jk-spinner" aria-hidden="true" /> : icon}
    {loading ? loadingLabel : children}
  </button>;
}
