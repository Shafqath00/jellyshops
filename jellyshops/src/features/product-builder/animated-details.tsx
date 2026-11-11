"use client";

import { Children, cloneElement, isValidElement, useState, type ComponentProps, type ReactElement } from "react";
import { m } from "framer-motion";
import { useProductMotion } from "./product-surface";

/** Keep native summary/keyboard semantics and descendants mounted, including during exit. */
export function AnimatedDetails({ children, open = false, onToggle, ...props }: ComponentProps<"details">) {
  const animated = useProductMotion();
  const [expanded, setExpanded] = useState(open);
  const [visible, setVisible] = useState(open);
  const [seenOpen, setSeenOpen] = useState(open);
  if (seenOpen !== open) {
    setSeenOpen(open);
    setExpanded(open);
    if (open) setVisible(true);
  }
  const [summary, ...content] = Children.toArray(children);
  const trigger = isValidElement(summary) ? cloneElement(summary as ReactElement<ComponentProps<"summary">>, {
    "aria-expanded": animated ? expanded : undefined,
    onClick: event => {
      if (!animated) return;
      event.preventDefault();
      setExpanded(current => !current);
      setVisible(true);
    },
  }) : summary;
  return <details {...props} open={visible} onToggle={event => {
    if (!animated) { setVisible(event.currentTarget.open); setExpanded(event.currentTarget.open); }
    // Validation can open the native element directly before focusing its field.
    if (event.currentTarget.open && !visible) { setVisible(true); setExpanded(true); }
    onToggle?.(event);
  }}>
    {trigger}
    <m.div className="product-disclosure-content" initial={false} animate={{ height: !animated || expanded ? "auto" : 0, opacity: !animated || expanded ? 1 : 0 }} transition={{ duration: animated ? 0.18 : 0 }} onAnimationComplete={() => { if (animated && !expanded) setVisible(false); }}>
      {content}
    </m.div>
  </details>;
}
