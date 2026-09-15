import type { HTMLAttributes } from "react";

export function StorefrontContainer({ children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={`jelly-container ${props.className ?? ""}`.trim()}>{children}</div>;
}
