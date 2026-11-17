import Link from "next/link";
import type { ReactNode } from "react";
import type { CheckoutStep } from "../use-checkout";

interface CheckoutLayoutProps {
  storeSlug: string;
  step?: CheckoutStep;
  children: ReactNode;
  summary?: ReactNode;
}

/** The page frame every theme shares: steps on top, form on the left, summary on the right (on top on phones). */
export function CheckoutLayout({ storeSlug, step, children, summary }: CheckoutLayoutProps) {
  const steps: Array<{ key: string; label: string }> = [
    { key: "bag", label: "Cart" },
    { key: "details", label: "Information" },
    { key: "shipping", label: "Shipping" },
    { key: "payment", label: "Payment" },
  ];
  const isDone = (key: string) => key === "bag" || (step === "payment" && (key === "details" || key === "shipping"));
  const isCurrent = (key: string) => key === step;
  return (
    <main className="jelly-checkout" data-step={step}>
      {step && (
        <header className="jelly-checkout__header">
          <h1 className="jelly-checkout__title">Checkout</h1>
          <nav aria-label="Checkout steps">
            <ol className="jelly-checkout__steps">
              {steps.map(({ key, label }) => (
                <li key={key} data-done={isDone(key) ? "" : undefined}>
                  {key === "bag" ? <Link href={`/${storeSlug}/cart`}>{label}</Link> : <span aria-current={isCurrent(key) ? "step" : undefined}>{label}</span>}
                </li>
              ))}
            </ol>
          </nav>
        </header>
      )}
      {/* The summary comes first in reading and tab order (it sits on top on phones); CSS moves it right on desktop. */}
      <div className={summary ? "jelly-checkout__grid" : "jelly-checkout__single"}>
        {summary}
        <div className="jelly-checkout__main">{children}</div>
      </div>
    </main>
  );
}
