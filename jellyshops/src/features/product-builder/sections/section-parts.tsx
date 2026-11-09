import type { ReactNode } from "react";

export function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="jk-card">
      <div className="jk-card-header"><div><h2>{title}</h2>{hint && <p>{hint}</p>}</div></div>
      <div className="jk-section-body">{children}</div>
    </section>
  );
}

export function Field({ id, label, error, hint, children }: { id: string; label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="jk-label">{label}</label>
      {children}
      {hint && !error && <p className="jk-help">{hint}</p>}
      {error && <p id={`${id}-error`} role="alert" className="jk-field-error jk-help">{error}</p>}
    </div>
  );
}
