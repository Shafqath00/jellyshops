"use client";
import Link from "next/link";
import { AdminPage } from "@/components/admin";
import { SETTINGS_GROUPS } from "@/features/admin/settings-sections";

export default function SettingsIndexPage() {
  return <AdminPage title="Settings" description="Everything about how your store works behind the scenes. Pick a topic to change it.">
    {SETTINGS_GROUPS.map((group) => <section key={group.label} aria-labelledby={`settings-${group.label}`} className="jk-stack-sm">
      <h2 id={`settings-${group.label}`} className="jk-muted jk-strong">{group.label}</h2>
      <div className="jk-settings-list">{group.items.map((item) => <Link key={item.href} href={item.href} className="jk-settings-tile">
        <item.icon size={18} aria-hidden="true" /><span><span className="jk-strong">{item.label}</span><p>{item.description}</p></span>
      </Link>)}</div>
    </section>)}
  </AdminPage>;
}
