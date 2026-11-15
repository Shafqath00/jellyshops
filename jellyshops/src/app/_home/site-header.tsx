"use client";

import { ChevronDown, Menu, Moon, Sun, X } from "lucide-react";
import Link from "next/link";
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "motion/react";
import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import type { NavItem } from "../home-content";
import { Icon } from "./icons";
import { JellyShopLogo } from "@/features/brand/logo";
import { EASE, SPRING, useReducedMotion } from "@/features/brand/motion";
import styles from "../home.module.css";

const THEME_KEY = "jellyshop-home-theme";

// The theme lives on <html data-home-theme>, set before paint by the script in page.tsx.
function subscribeTheme(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-home-theme"] });
  return () => observer.disconnect();
}
const themeSnapshot = (): "dark" | "light" => (document.documentElement.dataset.homeTheme === "light" ? "light" : "dark");
const serverTheme = (): "dark" | "light" => "dark";

export function SiteHeader({ items }: { items: NavItem[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const [drawer, setDrawer] = useState(false);
  const [drawerTop, setDrawerTop] = useState(64);
  const [scrolled, setScrolled] = useState(false);
  const theme = useSyncExternalStore(subscribeTheme, themeSnapshot, serverTheme);
  const reduced = useReducedMotion();
  const headerRef = useRef<HTMLElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const closeTimer = useRef<number | undefined>(undefined);
  const id = useId();
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, "change", (y) => setScrolled(y > 12));

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.homeTheme = next;
    try { localStorage.setItem(THEME_KEY, next); } catch { /* private mode: keep it for this visit */ }
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (open) {
        document.getElementById(`${id}-${open}-button`)?.focus();
        setOpen(null);
      }
      setDrawer(false);
    }
    function onPointer(event: PointerEvent) {
      if (navRef.current && !navRef.current.contains(event.target as Node)) setOpen(null);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open, id]);

  useEffect(() => {
    document.documentElement.style.overflow = drawer ? "hidden" : "";
    return () => { document.documentElement.style.overflow = ""; };
  }, [drawer]);

  const hoverOpen = (label: string) => { window.clearTimeout(closeTimer.current); setOpen(label); };
  const hoverClose = () => { closeTimer.current = window.setTimeout(() => setOpen(null), 140); };

  return (
    <header ref={headerRef} className={`${styles.header} ${scrolled || drawer ? styles.headerSolid : ""} ${drawer ? styles.headerOpen : ""}`}>
      <div className={styles.headerInner}>
        <Link href="/" className={styles.logo}>
          <JellyShopLogo height={26} />
        </Link>

        <nav
          ref={navRef}
          className={styles.desktopNav}
          aria-label="Main"
          onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setOpen(null); }}
        >
          <ul role="list" className={styles.navList}>
            {items.map((item) => item.groups ? (
              <li key={item.label} onPointerEnter={(e) => e.pointerType === "mouse" && hoverOpen(item.label)} onPointerLeave={(e) => e.pointerType === "mouse" && hoverClose()}>
                <button
                  type="button"
                  id={`${id}-${item.label}-button`}
                  className={styles.navTrigger}
                  aria-expanded={open === item.label}
                  aria-controls={`${id}-${item.label}-panel`}
                  onClick={() => setOpen(open === item.label ? null : item.label)}
                >
                  {item.label}
                  <ChevronDown size={14} strokeWidth={1.5} aria-hidden="true" className={styles.chevron} />
                </button>
                <AnimatePresence>
                  {open === item.label ? (
                    <motion.div
                      id={`${id}-${item.label}-panel`}
                      className={styles.megaPanel}
                      initial={reduced ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={reduced ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.98 }}
                      transition={{ duration: 0.22, ease: EASE }}
                    >
                      {item.groups.map((group) => (
                        <div key={group.title} className={styles.megaGroup}>
                          <p className={styles.label}>{group.title}</p>
                          <ul role="list">
                            {group.links.map((link) => (
                              <li key={link.label}>
                                <a href={link.href} className={styles.megaLink} onClick={() => setOpen(null)}>
                                  <span className={styles.megaIcon}><Icon name={link.icon} size={16} /></span>
                                  <span><strong>{link.label}</strong><span>{link.text}</span></span>
                                </a>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </li>
            ) : (
              <li key={item.label}><a className={styles.navTrigger} href={item.href}>{item.label}</a></li>
            ))}
          </ul>
        </nav>

        <div className={styles.headerActions}>
          <button type="button" className={styles.iconButton} onClick={toggleTheme} aria-pressed={theme === "light"}>
            {theme === "dark" ? <Sun size={16} strokeWidth={1.5} aria-hidden="true" /> : <Moon size={16} strokeWidth={1.5} aria-hidden="true" />}
            <span className={styles.srOnly}>Light mode</span>
          </button>
          <Link href="/login" className={styles.loginLink}>Log in</Link>
          <motion.span whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} transition={SPRING} className={styles.headerCta}>
            <Link href="/signup" className={`${styles.btn} ${styles.btnSolid} ${styles.btnSmall}`}>Start free</Link>
          </motion.span>
          <button
            type="button"
            className={styles.menuButton}
            aria-expanded={drawer}
            aria-controls={`${id}-drawer`}
            onClick={() => {
              if (!drawer && headerRef.current) setDrawerTop(Math.round(headerRef.current.getBoundingClientRect().bottom));
              setDrawer(!drawer);
            }}
          >
            {drawer ? <X size={20} strokeWidth={1.5} aria-hidden="true" /> : <Menu size={20} strokeWidth={1.5} aria-hidden="true" />}
            <span className={styles.srOnly}>{drawer ? "Close menu" : "Open menu"}</span>
          </button>
        </div>
      </div>

      <AnimatePresence>
        {drawer ? (
          <motion.div
            id={`${id}-drawer`}
            className={styles.drawer}
            style={{ top: drawerTop }}
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: EASE }}
          >
            <nav aria-label="Mobile">
              {items.map((item) => item.groups ? (
                <details key={item.label} className={styles.drawerGroup}>
                  <summary>{item.label}<ChevronDown size={16} strokeWidth={1.5} aria-hidden="true" /></summary>
                  <ul role="list">
                    {item.groups.flatMap((group) => group.links).map((link) => (
                      <li key={link.label}><a href={link.href} onClick={() => setDrawer(false)}><Icon name={link.icon} size={16} />{link.label}</a></li>
                    ))}
                  </ul>
                </details>
              ) : (
                <a key={item.label} className={styles.drawerLink} href={item.href} onClick={() => setDrawer(false)}>{item.label}</a>
              ))}
              <div className={styles.drawerActions}>
                <Link href="/login" className={`${styles.btn} ${styles.btnOutline}`}>Log in</Link>
                <Link href="/signup" className={`${styles.btn} ${styles.btnSolid}`}>Start free</Link>
              </div>
            </nav>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  );
}
