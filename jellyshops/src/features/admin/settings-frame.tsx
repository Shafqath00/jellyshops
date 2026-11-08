"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { SETTINGS_GROUPS } from "./settings-sections";

/** Settings pages get a grouped list on the left (hidden on the settings index, which shows the same list as tiles). */
export function SettingsFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";
  if (pathname === "/admin/settings") return <>{children}</>;
  return <div className="jk-settings">
    <nav className="jk-settings-nav" aria-label="Settings">
      {SETTINGS_GROUPS.map((group) => <div key={group.label} className="jk-settings-group">
        <h2>{group.label}</h2>
        {group.items.map((item) => <Link key={item.href} href={item.href} className="jk-settings-link" aria-current={pathname === item.href ? "page" : undefined}><item.icon size={16} aria-hidden="true" />{item.label}</Link>)}
      </div>)}
    </nav>
    <div className="min-w-0">{children}</div>
  </div>;
}
