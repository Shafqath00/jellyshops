import Link from "next/link";
import type { LucideIcon } from "lucide-react";

export function EmptyState({ icon: Icon, title, body, action, href }: { icon: LucideIcon; title: string; body: string; action?: string; href?: string }) {
  return (
    <div className="flex min-h-[300px] flex-col items-center justify-center rounded-[24px] border-[1.5px] border-dashed border-[#c8c5bd] bg-white/45 px-6 py-[50px] text-center">
      <span className="grid size-[54px] place-items-center rounded-[17px] border-2 border-jelly-ink bg-jelly-citrus shadow-[4px_4px_0_#14213d]"><Icon size={24} /></span>
      <h3 className="mb-[5px] mt-5 text-[21px]">{title}</h3>
      <p className="mb-[22px] max-w-[360px] text-jelly-ink-soft">{body}</p>
      {action && href ? <Link className="inline-flex min-h-12 items-center justify-center rounded-jelly-sm border-2 border-jelly-ink bg-jelly-ink px-[18px] py-[13px] font-extrabold text-jelly-paper shadow-jelly-guava" href={href}>{action}</Link> : null}
    </div>
  );
}
