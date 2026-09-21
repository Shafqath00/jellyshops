import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
  href,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  action?: string;
  href?: string;
}) {
  return (
    <div className="flex min-h-[300px] flex-col items-center justify-center rounded-xl border border-dashed bg-muted/20 px-6 py-12 text-center">
      <span className="grid size-11 place-items-center rounded-lg border bg-background text-muted-foreground shadow-sm">
        <Icon size={20} />
      </span>
      <h3 className="mb-1 mt-4 text-base font-semibold">{title}</h3>
      <p className="mb-5 max-w-[360px] text-sm text-muted-foreground">{body}</p>
      {action && href ? (
        <Link className={buttonVariants()} href={href}>
          {action}
        </Link>
      ) : null}
    </div>
  );
}
