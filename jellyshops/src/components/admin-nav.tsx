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
import clsx from "clsx";

const links = [
  {
    href: "/admin",
    label: "Home",
    icon: Home,
  },
  {
    href: "/admin/orders",
    label: "Orders",
    icon: PackageCheck,
  },
  {
    href: "/admin/payments",
    label: "Payments",
    mobileLabel: "Pay",
    icon: CreditCard,
  },
  {
    href: "/admin/products",
    label: "Products",
    icon: Boxes,
  },
  {
    href: "/admin/customers",
    label: "Customers",
    icon: UsersRound,
  },
  {
    href: "/admin/store",
    label: "Store",
    icon: Palette,
  },
  {
    href: "/admin/online-store",
    label: "Online Store",
    mobileLabel: "Store",
    icon: LayoutTemplate,
  },
  {
    href: "/admin/settings",
    label: "Settings",
    icon: Settings,
  },
];

export function AdminNav() {
  const pathname = usePathname() ?? "";

  const isActive = (href: string) => {
    if (href === "/admin") {
      return pathname === "/admin";
    }

    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <nav
      aria-label="Merchant navigation"
      className={clsx(
        "flex flex-col gap-0.5",
        "max-md:fixed",
        "max-md:inset-x-3",
        "max-md:bottom-3",
        "max-md:z-50",
        "max-md:grid",
        "max-md:grid-cols-8",
        "max-md:gap-0.5",
        "max-md:rounded-2xl",
        "max-md:border",
        "max-md:border-black/10",
        "max-md:bg-white/95",
        "max-md:p-1.5",
        "max-md:shadow-[0_8px_30px_rgba(0,0,0,0.12)]",
        "max-md:backdrop-blur-xl"
      )}
    >
      {links.map(
        ({
          href,
          label,
          mobileLabel,
          icon: Icon,
        }) => {
          const active = isActive(href);

          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              aria-current={active ? "page" : undefined}
              className={clsx(
                "group flex min-h-9 items-center gap-2.5 rounded-lg px-2.5",
                "text-[13px] font-medium",
                "transition-colors duration-150",
                "focus-visible:outline-none",
                "focus-visible:ring-2",
                "focus-visible:ring-jelly-guava/50",
                !active &&
                  "text-[#4a4a4a] hover:bg-black/[0.05] hover:text-[#202223]",
                active &&
                  "bg-black/[0.07] font-semibold text-[#202223]",
                "max-md:min-h-[52px]",
                "max-md:min-w-0",
                "max-md:flex-col",
                "max-md:justify-center",
                "max-md:gap-1",
                "max-md:rounded-xl",
                "max-md:px-1",
                "max-md:py-1.5",
                "max-md:bg-transparent",
                active &&
                  "max-md:bg-[#f1f1f1]"
              )}
            >
              <Icon
                size={18}
                strokeWidth={active ? 2.2 : 1.8}
                className={clsx(
                  "shrink-0 transition-colors",
                  active
                    ? "text-[#303030]"
                    : "text-[#6d7175] group-hover:text-[#303030]",
                  active &&
                    "max-md:text-jelly-guava-deep"
                )}
              />

              <span className="truncate max-md:w-full max-md:text-center max-md:text-[9px] max-md:font-medium max-md:leading-none">
                <span className="max-md:hidden">
                  {label}
                </span>

                <span className="hidden max-md:inline">
                  {mobileLabel ?? label}
                </span>
              </span>
            </Link>
          );
        }
      )}
    </nav>
  );
}
