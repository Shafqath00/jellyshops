import type { ReactNode } from "react";
import { cardClass, labelClass } from "@/features/commerce/components/product-form-styles";

export function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className={cardClass}>
      <h2 className="text-[15px] font-black tracking-[-0.02em] text-foreground">{title}</h2>
      {hint && <p className="mt-1 text-[11px] leading-5 text-muted-foreground">{hint}</p>}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

export function Field({ id, label, error, hint, children }: { id: string; label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className={labelClass}>{label}</label>
      {children}
      {hint && !error && <p className="mt-1.5 text-[11px] text-muted-foreground">{hint}</p>}
      {error && <p id={`${id}-error`} role="alert" className="mt-1.5 text-[11px] font-bold text-tint-foreground">{error}</p>}
    </div>
  );
}
