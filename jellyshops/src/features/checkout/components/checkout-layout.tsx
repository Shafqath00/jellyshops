import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import type { CheckoutSection } from "../use-checkout";

interface CheckoutLayoutProps {
  storeSlug: string;
  section?: CheckoutSection;
  /** False for bags with nothing to deliver: the progress skips Delivery. */
  delivery?: boolean;
  children: ReactNode;
  summary?: ReactNode;
  /** Merchant accent colour (theme settings > Checkout), as CSS custom properties. */
  style?: CSSProperties;
}

const ORDER: CheckoutSection[] = ["contact", "delivery", "payment"];
const LABELS: Record<CheckoutSection, string> = { contact: "Details", delivery: "Delivery", payment: "Payment" };

/**
 * The Jellyshop checkout frame, the same for every store and theme. Desktop: the step cards with the title and
 * progress line on the left (about three quarters of the width), the order summary in a narrow sticky column on the
 * right. Phones and tablets: the summary as a folding bar at the top, then the cards. Looks come from tokens in checkout.css.
 */
export function CheckoutLayout({ storeSlug, section, delivery = true, children, summary, style }: CheckoutLayoutProps) {
  const steps = ORDER.filter((key) => delivery || key !== "delivery");
  const current = section ? steps.indexOf(section) : -1;
  return (
    <main className="jelly-checkout" data-flow="cards" data-section={section} style={style}>
      <div className="jelly-checkout__column">
        {summary}
        <div className="jelly-checkout__main">
          {section && (
            <header className="jelly-checkout__header">
              <Link className="jelly-checkout__back-link" href={`/${storeSlug}/cart`}>Bag</Link>
              <h1 className="jelly-checkout__title">Checkout</h1>
              <nav aria-label="Checkout progress">
                <ol className="jelly-checkout__progress" style={{ "--checkout-progress": `${Math.max(0, current) / Math.max(1, steps.length - 1)}` } as CSSProperties}>
                  {steps.map((key, index) => (
                    <li key={key} data-state={index < current ? "done" : index === current ? "current" : "next"}>
                      <span aria-current={index === current ? "step" : undefined}>
                        <span className="jelly-checkout__sr">{index < current ? "Done: " : index === current ? "Current step: " : "Next: "}</span>{LABELS[key]}
                      </span>
                    </li>
                  ))}
                </ol>
              </nav>
            </header>
          )}
          {children}
        </div>
      </div>
    </main>
  );
}
