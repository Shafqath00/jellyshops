"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Boxes,
  CreditCard,
  Home,
  LayoutTemplate,
  PackageCheck,
  Palette,
  Settings,
  UsersRound,
} from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { href: "/admin", label: "Home", icon: Home },
  { href: "/admin/orders", label: "Orders", icon: PackageCheck },
  { href: "/admin/payments", label: "Payments", mobileLabel: "Pay", icon: CreditCard },
  { href: "/admin/products", label: "Products", icon: Boxes },
  { href: "/admin/customers", label: "Customers", icon: UsersRound },
  { href: "/admin/store", label: "Store", icon: Palette },
  { href: "/admin/online-store", label: "Online Store", mobileLabel: "Online", icon: LayoutTemplate },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export function AdminNav() {
  const pathname = usePathname() ?? "";

  const isActive = (href: string) =>
    href === "/admin"
      ? pathname === "/admin"
      : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav
      aria-label="Merchant navigation"
      className={cn(
        "flex flex-col gap-1",
        "max-md:fixed max-md:inset-x-3 max-md:bottom-3 max-md:z-50",
        "max-md:grid max-md:grid-cols-8 max-md:rounded-xl max-md:border max-md:bg-background/95 max-md:p-1.5 max-md:shadow-lg max-md:backdrop-blur",
      )}
    >
      {links.map(({ href, label, mobileLabel, icon: Icon }) => {
        const active = isActive(href);

        return (
          <Link
            key={href}
            href={href}
            aria-label={label}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group flex min-h-9 items-center gap-2.5 rounded-md px-3 text-sm font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              "max-md:min-h-[52px] max-md:min-w-0 max-md:flex-col max-md:justify-center max-md:gap-1 max-md:px-1 max-md:py-1.5",
            )}
          >
            <Icon size={17} strokeWidth={active ? 2 : 1.8} />
            <span className="truncate max-md:w-full max-md:text-center max-md:text-[10px] max-md:leading-none">
              <span className="max-md:hidden">{label}</span>
              <span className="hidden max-md:inline">{mobileLabel ?? label}</span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
