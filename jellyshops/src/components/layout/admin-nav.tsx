"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CreditCard, FileText, Home, Inbox, Settings, Store, Tag, Users, type LucideIcon } from "lucide-react";

export type AdminDestination = { label: string; href: string };
export type AdminNavGroup = AdminDestination & { icon: LucideIcon; section?: string; children?: AdminDestination[] };

/** Every admin page the sidebar and the page search know about, in menu order. */
export const ADMIN_NAV: AdminNavGroup[] = [
  { label: "Home", href: "/admin", icon: Home },
  { label: "Orders", href: "/admin/orders", icon: Inbox },
  { label: "Products", href: "/admin/products", icon: Tag, children: [
    { label: "All products", href: "/admin/products" }, { label: "Collections", href: "/admin/products/collections" }, { label: "Inventory", href: "/admin/products/inventory" }, { label: "Reviews", href: "/admin/products/reviews" }, { label: "Import", href: "/admin/products/import" },
  ] },
  { label: "Customers", href: "/admin/customers", icon: Users, children: [
    { label: "All customers", href: "/admin/customers" }, { label: "Messages", href: "/admin/customers/messages" },
  ] },
  { label: "Content", href: "/admin/content/pages", icon: FileText, children: [
    { label: "Pages", href: "/admin/content/pages" }, { label: "Blog posts", href: "/admin/content/blogs" }, { label: "Files", href: "/admin/content/files" }, { label: "Menus", href: "/admin/content/menus" }, { label: "Custom content", href: "/admin/content/metaobjects" },
  ] },
  { label: "Payments", href: "/admin/payments", icon: CreditCard },
  { label: "Online Store", href: "/admin/online-store", icon: Store, section: "Sales channels", children: [
    { label: "Store designs", href: "/admin/online-store" }, { label: "Preferences", href: "/admin/online-store/preferences" },
  ] },
];
export const ADMIN_SETTINGS: AdminNavGroup = { label: "Settings", href: "/admin/settings", icon: Settings };

/** Flat list for the page search: each child page, with the group it belongs to. */
export function adminDestinations() {
  return [...ADMIN_NAV, ADMIN_SETTINGS].flatMap((group) => group.children
    ? group.children.map((child) => ({ ...child, group: group.label, icon: group.icon }))
    : [{ label: group.label, href: group.href, group: "", icon: group.icon }]);
}

function isWithin(pathname: string, href: string) {
  return href === "/admin" ? pathname === href : pathname === href || pathname.startsWith(href + "/");
}

/** The child page that best matches the address (longest match wins, so /admin/products/123 is "All products"). */
function activeChild(pathname: string, children: AdminDestination[]) {
  return children.filter((child) => isWithin(pathname, child.href)).sort((a, b) => b.href.length - a.href.length)[0]?.href;
}

/**
 * Sidebar navigation. A group shows its pages only while you are inside it, so the menu stays short
 * and the open group always says where you are.
 */
export function AdminNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname() ?? "";
  const item = (group: AdminNavGroup) => {
    const childHref = group.children ? activeChild(pathname, group.children) : undefined;
    const open = Boolean(childHref) || (group.children ? isWithin(pathname, group.href) : false);
    const exact = !group.children && isWithin(pathname, group.href);
    return <li key={group.href}>
      {group.section && <p className="admin-nav-section">{group.section}</p>}
      <Link href={group.href} onClick={onNavigate} aria-current={exact ? "page" : undefined}
        className={`admin-nav-link ${exact ? "is-active" : ""} ${open ? "is-open" : ""}`}>
        <group.icon size={16} aria-hidden="true" />{group.label}
      </Link>
      {open && group.children && <ul className="admin-nav-children" aria-label={group.label}>
        {group.children.map((child) => <li key={child.href}>
          <Link href={child.href} onClick={onNavigate} aria-current={child.href === childHref ? "page" : undefined}
            className={`admin-nav-link admin-nav-child ${child.href === childHref ? "is-active" : ""}`}>{child.label}</Link>
        </li>)}
      </ul>}
    </li>;
  };
  return <nav aria-label="Merchant navigation" className="admin-sidebar-scroll">
    <ul className="admin-navigation">{ADMIN_NAV.map(item)}</ul>
    <ul className="admin-navigation admin-sidebar-footer">{item(ADMIN_SETTINGS)}</ul>
  </nav>;
}
