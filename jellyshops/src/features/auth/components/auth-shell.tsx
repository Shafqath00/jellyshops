"use client";

import { PoundSterling } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { motion, useMotionValue, useSpring, useTransform } from "motion/react";
import type { ReactNode } from "react";
import "@/features/brand/brand.css";
import { geist, geistMono } from "@/features/brand/fonts";
import { JellyShopLogo } from "@/features/brand/logo";
import { useReducedMotion } from "@/features/brand/motion";
import styles from "./merchant-auth.module.css";

const EASE = [0.22, 1, 0.36, 1] as const;

// The picture already shows "Store published" and "New order", so only the payout card floats over it.
const CARDS = [
  { id: "payout", icon: PoundSterling, label: "Payout on its way", value: "£1,240.50", className: styles.cardBottom, delay: 0.9 },
];

/** Product visual beside the form: tilts gently towards the pointer, cards float in. Decorative only. */
function AuthVisual() {
  const reduced = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateY = useSpring(useTransform(x, [-0.5, 0.5], reduced ? [0, 0] : [-6, 6]), { stiffness: 120, damping: 20 });
  const rotateX = useSpring(useTransform(y, [-0.5, 0.5], reduced ? [0, 0] : [5, -5]), { stiffness: 120, damping: 20 });

  return (
    <aside
      className={styles.art}
      aria-hidden="true"
      inert
      onPointerMove={(event) => {
        const box = event.currentTarget.getBoundingClientRect();
        x.set((event.clientX - box.left) / box.width - 0.5);
        y.set((event.clientY - box.top) / box.height - 0.5);
      }}
      onPointerLeave={() => { x.set(0); y.set(0); }}
    >
      <div className={styles.artCopy}>
        <p className={styles.eyebrow}>Jellyshop</p>
        <p className={styles.artTitle}>Launch your store.<br /><span>Sell from day one.</span></p>
      </div>
      <motion.div className={styles.artStage} style={{ rotateX, rotateY, transformPerspective: 1200 }}>
        <motion.div
          className={styles.artFrame}
          initial={reduced ? false : { opacity: 0, y: 40, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 1, ease: EASE, delay: 0.15 }}
        >
          <Image src="/assets/auth-visual.webp" alt="" width={864} height={1296} sizes="(max-width: 1023px) 0px, 420px" priority />
        </motion.div>
        {CARDS.map(({ id, icon: Icon, label, value, className, delay }) => (
          <motion.div
            key={id}
            className={`${styles.card} ${className}`}
            initial={reduced ? false : { opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.8, ease: EASE, delay }}
          >
            <motion.div
              className={styles.cardInner}
              animate={reduced ? undefined : { y: [0, -6, 0] }}
              transition={{ duration: 5, ease: "easeInOut", repeat: Infinity, delay: delay + 0.8 }}
            >
              <span className={styles.cardIcon}><Icon size={14} strokeWidth={1.5} /></span>
              <span><small>{label}</small><strong>{value}</strong></span>
            </motion.div>
          </motion.div>
        ))}
      </motion.div>
      <p className={styles.artNote}>Free plan · No card needed · Live in minutes</p>
    </aside>
  );
}

export function MerchantAuthShell({ title, eyebrow, subtitle, children }: {
  title: string; eyebrow?: string; subtitle: string; children: ReactNode;
}) {
  const reduced = useReducedMotion();
  return (
    <div data-brand className={`${styles.shell} ${geist.variable} ${geistMono.variable}`}>
      <div className={styles.column}>
        <header className={styles.header}>
          <Link href="/" className={styles.logo}><JellyShopLogo height={24} /></Link>
        </header>
        <main className={styles.main}>
          <motion.section
            className={styles.panel}
            aria-labelledby="auth-title"
            initial={reduced ? false : { y: 12 }}
            animate={{ y: 0 }}
            transition={{ duration: 0.6, ease: EASE }}
          >
            <div className={styles.intro}>
              {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
              <h1 id="auth-title">{title}</h1>
              <p className={styles.subtitle}>{subtitle}</p>
            </div>
            {children}
          </motion.section>
        </main>
        <footer className={styles.footer}>
          <span>© {new Date().getFullYear()} Jelly Labs</span>
          <Link href="/">Back to home</Link>
        </footer>
      </div>
      <AuthVisual />
    </div>
  );
}
