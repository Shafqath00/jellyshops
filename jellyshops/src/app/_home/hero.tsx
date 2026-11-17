"use client";

import { ArrowRight, Bell, Check, PoundSterling } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { motion, useScroll, useTransform, type Variants } from "motion/react";
import { useRef } from "react";
import { DemoDialog } from "./demo-dialog";
import { EASE, SPRING, useReducedMotion } from "@/features/brand/motion";
import styles from "../home.module.css";

const LINES = [["Launch", "your", "store."], ["Sell", "from", "day", "one."]];

const word: Variants = {
  hidden: { opacity: 0, y: "0.4em", filter: "blur(8px)" },
  show: (i: number) => ({ opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.8, ease: EASE, delay: 0.15 + i * 0.07 } }),
};

const FLOATING = [
  { id: "order", icon: Check, title: "New order", value: "£86.00", className: styles.floatOrder, delay: 1.0 },
  { id: "payout", icon: PoundSterling, title: "Payout on its way", value: "£1,240.50", className: styles.floatPayout, delay: 1.2 },
  { id: "stock", icon: Bell, title: "Low stock", value: "Ceramic vase · 3 left", className: styles.floatStock, delay: 1.4 },
];

export function Hero() {
  const reduced = useReducedMotion();
  const visualRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: visualRef, offset: ["start end", "center center"] });
  // The mockup starts tilted back and settles flat as it reaches the middle of the screen.
  const rotateX = useTransform(scrollYProgress, [0, 1], reduced ? [0, 0] : [22, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], reduced ? [1, 1] : [0.92, 1]);
  let index = 0;

  return (
    <section className={styles.hero} aria-labelledby="hero-title">
      <div className={`${styles.container} ${styles.heroInner}`}>
        <motion.a
          href="/changelog"
          className={styles.announce}
          initial={reduced ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE }}
          whileHover="hover"
        >
          <span className={styles.announceTag}>New</span>
          <span>Bulk import your catalogue from a spreadsheet</span>
          <motion.span variants={{ hover: { x: 3 } }} transition={SPRING} className={styles.announceArrow}><ArrowRight size={14} strokeWidth={1.5} aria-hidden="true" /></motion.span>
        </motion.a>

        <h1 id="hero-title" className={styles.heroTitle}>
          {LINES.map((line, lineIndex) => (
            <span key={lineIndex} className={styles.heroLine}>
              {line.map((w) => {
                const i = index++;
                // The outcome line ("Sell from day one.") is in the solid brand accent.
                const accent = lineIndex === 1;
                return (
                  <motion.span key={`${w}-${i}`} className={`${styles.word} ${accent ? styles.accentWord : ""}`} custom={i} variants={word} initial={reduced ? false : "hidden"} animate="show">
                    {w}{" "}
                  </motion.span>
                );
              })}
            </span>
          ))}
        </h1>

        <motion.p
          className={styles.heroText}
          initial={reduced ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE, delay: 0.7 }}
        >
          Jellyshop is the all-in-one platform for independent brands: design your store, take payments and manage orders, with no code.
        </motion.p>

        <motion.div
          className={styles.heroActions}
          initial={reduced ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE, delay: 0.85 }}
        >
          <motion.span whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} transition={SPRING}>
            <Link href="/signup" className={`${styles.btn} ${styles.btnSolid} ${styles.btnLarge}`}>
              Start free <ArrowRight size={16} strokeWidth={1.5} aria-hidden="true" />
            </Link>
          </motion.span>
          <DemoDialog />
        </motion.div>
        <motion.p className={styles.heroNote} initial={reduced ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.05, duration: 0.6 }}>
          Free plan · No card needed · Live in minutes
        </motion.p>

        <div className={styles.heroStage} ref={visualRef}>
          <motion.div
            className={styles.heroFrame}
            style={{ rotateX, scale, transformPerspective: 1400 }}
            initial={reduced ? false : { opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.1, ease: EASE, delay: 0.6 }}
          >
            <Image
              src="/assets/hero-dashboard.webp"
              alt="The Jellyshop dashboard on a laptop showing £24,860 in sales, a sales chart and five recent orders, next to a phone showing the Fern Studio shop a customer sees"
              width={1536}
              height={1024}
              priority
              sizes="(max-width: 1240px) 96vw, 1200px"
            />
          </motion.div>
          {FLOATING.map(({ id, icon: IconComponent, title, value, className, delay }) => (
            <motion.div
              key={id}
              className={`${styles.floatCard} ${className}`}
              aria-hidden="true"
              initial={reduced ? false : { opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.8, ease: EASE, delay }}
            >
              <motion.div
                className={styles.floatInner}
                animate={reduced ? undefined : { y: [0, -6, 0] }}
                transition={{ duration: 5, ease: "easeInOut", repeat: Infinity, delay: delay + 0.8 }}
              >
                <span className={styles.floatIcon}><IconComponent size={14} strokeWidth={1.5} /></span>
                <span><small>{title}</small><strong>{value}</strong></span>
              </motion.div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
