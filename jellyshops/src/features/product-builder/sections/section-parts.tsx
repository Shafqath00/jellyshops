import type { ReactNode } from "react";

export function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="admin-card">
      <h2 className="text-[15px] font-semibold text-foreground">{title}</h2>
      {hint && <p className="mt-1 text-[13px] leading-5 text-muted-foreground">{hint}</p>}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

export function Field({ id, label, error, hint, children }: { id: string; label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="text-[13px] font-semibold text-foreground">{label}</label>
      {children}
      {hint && !error && <p className="mt-1.5 text-[12px] leading-5 text-muted-foreground">{hint}</p>}
      {error && <p id={`${id}-error`} role="alert" className="mt-1.5 text-[12px] font-semibold text-destructive">{error}</p>}
    </div>
  );
}
