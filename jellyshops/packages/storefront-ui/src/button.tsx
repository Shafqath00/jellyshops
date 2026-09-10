import type { ButtonHTMLAttributes } from "react";

export function StorefrontButton({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...props} className={`jelly-button ${props.className ?? ""}`.trim()}>{children}</button>;
}
