"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Home, Package, Users, FileText, Store, CreditCard, Settings, Search, ChevronRight, type LucideIcon } from "lucide-react";

type Destination = { label: string; href: string };
const groups: Array<Destination & { icon: LucideIcon; children?: Destination[] }> = [
  { label: "Home", href: "/admin", icon: Home },
  { label: "Orders", href: "/admin/orders", icon: Package },
  { label: "Products", href: "/admin/products", icon: Package, children: [
    { label: "All products", href: "/admin/products" }, { label: "Collections", href: "/admin/products/collections" }, { label: "Inventory", href: "/admin/products/inventory" },
  ] },
  { label: "Customers", href: "/admin/customers", icon: Users, children: [
    { label: "All customers", href: "/admin/customers" }, { label: "Messages", href: "/admin/customers/messages" },
  ] },
  { label: "Content", href: "/admin/content/pages", icon: FileText, children: [
    { label: "Pages", href: "/admin/content/pages" }, { label: "Blog posts", href: "/admin/content/blogs" }, { label: "Menus", href: "/admin/content/menus" }, { label: "Custom content", href: "/admin/content/metaobjects" },
  ] },
  { label: "Online Store", href: "/admin/online-store", icon: Store, children: [
    { label: "Store designs", href: "/admin/online-store" }, { label: "Store appearance", href: "/admin/store" },
  ] },
  { label: "Payments", href: "/admin/payments", icon: CreditCard },
  { label: "Settings", href: "/admin/settings", icon: Settings },
];
export function AdminNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname() ?? "";
  const [query, setQuery] = useState("");
  const match = (href: string) => href === "/admin" ? pathname === href : pathname === href || pathname.startsWith(href + "/");
  const link = (item: Destination, nested = false) => <Link key={item.href} href={item.href} onClick={onNavigate} aria-current={pathname === item.href ? "page" : undefined} className={`admin-nav-link ${nested ? "admin-nav-child" : ""} ${pathname === item.href ? "is-active" : ""}`}>{item.label}</Link>;
  const matches = groups.flatMap(group => group.children ?? [group]).filter(item => item.label.toLowerCase().includes(query.trim().toLowerCase()));
  return <nav aria-label="Merchant navigation" className="admin-navigation">
    <label className="admin-nav-search"><Search size={15} aria-hidden="true" /><input type="search" aria-label="Search pages" placeholder="Search pages" value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === "Escape") setQuery(""); }} /></label>
    {query.trim() ? <div className="admin-nav-results">{matches.map(item => link(item))}{!matches.length && <p className="px-3 py-2 text-xs text-white/60">No pages found.</p>}</div> :
      groups.map(group => group.children ? <details key={group.label} open={match(group.href) || group.children.some(item => match(item.href))} className="admin-nav-group">
        <summary><group.icon size={17} aria-hidden="true" />{group.label}<ChevronRight size={13} className="ml-auto" /></summary>
        {group.children.map(item => link(item, true))}
      </details> : <Link key={group.href} href={group.href} onClick={onNavigate} aria-current={match(group.href) ? "page" : undefined} className={`admin-nav-link ${match(group.href) ? "is-active" : ""}`}><group.icon size={17} aria-hidden="true" />{group.label}</Link>)}
  </nav>;
}
