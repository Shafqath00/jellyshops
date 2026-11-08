import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export function AdminPageHeader({ title, description, back, actions }: { title: string; description?: string; back?: string; actions?: ReactNode }) {
  return <header className="admin-page-header"><div>{back && <Link href={back} className="admin-back"><ArrowLeft size={16} />Back</Link>}<h1>{title}</h1>{description && <p>{description}</p>}</div>{actions && <div className="admin-page-actions">{actions}</div>}</header>;
}
export function AdminCard({ title, description, children, className = "" }: { title?: string; description?: string; children: ReactNode; className?: string }) {
  return <section className={`admin-card ${className}`}>{title && <div className="admin-card-heading"><h2>{title}</h2>{description && <p>{description}</p>}</div>}{children}</section>;
}
export function AdminEmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return <div className="admin-empty"><h2>{title}</h2>{children && <p>{children}</p>}{action}</div>;
}
export function AdminNotice({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return <div className={`admin-notice ${error ? "is-error" : ""}`} role={error ? "alert" : "status"}>{children}</div>;
}
export function AdminStatus({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "success" | "warning" }) {
  return <span className={`admin-status admin-status-${tone}`}>{children}</span>;
}
