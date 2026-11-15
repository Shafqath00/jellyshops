"use client";

import { ArrowUpRight, Check } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion, useMotionValueEvent, useScroll, useTransform } from "motion/react";
import { useRef, useState } from "react";
import { features, shops, stats, steps, templates } from "../home-content";
import { Counter, EASE, Reveal, staggerChild, staggerParent, useReducedMotion } from "@/features/brand/motion";
import styles from "../home.module.css";

/* ---------- 3. Customer marquee + stats ---------- */

export function ProofBand() {
  const reduced = useReducedMotion();
  return (
    <section className={styles.proof} aria-labelledby="proof-title">
      <p id="proof-title" className={styles.proofLabel}>Built for independent shops like these</p>
      <div className={styles.marquee} data-paused={reduced ? "true" : undefined}>
        <ul role="list" className={styles.marqueeTrack}>
          {[...shops, ...shops].map((name, i) => (
            <li key={`${name}-${i}`} aria-hidden={i >= shops.length ? "true" : undefined} className={styles[`shop${i % 5}`]}>{name}</li>
          ))}
        </ul>
      </div>
      <p className={styles.footnoteCenter}>Shop names are illustrative.</p>
      <div className={styles.container}>
        <motion.ul role="list" className={styles.stats} variants={staggerParent} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-10%" }}>
          {stats.map(({ value, suffix, label }) => (
            <motion.li key={label} variants={staggerChild}>
              <strong><Counter value={value} suffix={suffix} /></strong>
              <span>{label}</span>
            </motion.li>
          ))}
        </motion.ul>
      </div>
    </section>
  );
}

/* ---------- 4. How it works: pinned, scroll-driven ---------- */

export function HowItWorks() {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const progress = useTransform(scrollYProgress, [0, 1], [0, 1]);
  useMotionValueEvent(scrollYProgress, "change", (value) => {
    const next = Math.min(steps.length - 1, Math.floor(value * steps.length));
    setActive((current) => (current === next ? current : next));
  });

  return (
    <section ref={ref} id="how-it-works" className={`${styles.how} ${reduced ? styles.howStatic : ""}`} aria-labelledby="how-title" style={{ ["--steps" as string]: steps.length }}>
      <div className={styles.howSticky}>
        <div className={`${styles.container} ${styles.howGrid}`}>
          <div>
            <p className={styles.label}>How it works</p>
            <h2 id="how-title" className={styles.h2}>From idea to open shop in four steps.</h2>
            <ol role="list" className={styles.howSteps}>
              <motion.span className={styles.howRail} style={{ scaleY: progress }} aria-hidden="true" />
              {steps.map((step, i) => (
                <li key={step.title} data-active={i === active || undefined}>
                  <span className={styles.howNum} aria-hidden="true">0{i + 1}</span>
                  <div>
                    <h3>{step.title}</h3>
                    <p>{step.text}</p>
                  </div>
                  <Image className={styles.howInlineImage} src={`/assets/${step.image}.webp`} alt="" width={1200} height={800} sizes="92vw" loading="lazy" />
                </li>
              ))}
            </ol>
          </div>
          <div className={styles.howVisual} aria-hidden="true">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div
                key={active}
                className={styles.howImage}
                initial={reduced ? { opacity: 0 } : { opacity: 0, y: 40, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={reduced ? { opacity: 0 } : { opacity: 0, y: -40, scale: 0.98 }}
                transition={{ duration: 0.6, ease: EASE }}
              >
                <Image src={`/assets/${steps[active].image}.webp`} alt="" width={1200} height={800} sizes="(max-width: 1240px) 50vw, 640px" />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- 5. Bento grid ---------- */

function MiniChart() {
  const bars = [32, 48, 40, 64, 56, 72, 60, 84, 70, 92, 80, 100];
  return (
    <div className={styles.miniChart} aria-hidden="true">
      <div className={styles.miniChartHead}>
        <span>Sales · 30 days</span>
        <strong><Counter value={24860} prefix="£" /></strong>
        <em>+12%</em>
      </div>
      <motion.div className={styles.miniBars} variants={{ show: { transition: { staggerChildren: 0.05 } } }} initial="hidden" whileInView="show" viewport={{ once: true }}>
        {bars.map((h, i) => (
          <motion.span key={i} style={{ height: `${h}%` }} variants={{ hidden: { scaleY: 0 }, show: { scaleY: 1, transition: { duration: 0.7, ease: EASE } } }} />
        ))}
      </motion.div>
    </div>
  );
}

function MiniOrders() {
  const rows = [["#1048", "£86.00", "Paid"], ["#1047", "£42.00", "Packed"], ["#1046", "£128.50", "Shipped"]];
  return (
    <motion.ul role="list" className={styles.miniOrders} aria-hidden="true" variants={staggerParent} initial="hidden" whileInView="show" viewport={{ once: true }}>
      {rows.map(([n, total, status]) => (
        <motion.li key={n} variants={staggerChild}><span>{n}</span><span>{total}</span><b>{status}</b></motion.li>
      ))}
    </motion.ul>
  );
}

export function Bento() {
  return (
    <section id="features" className={styles.section} aria-labelledby="features-title">
      <div className={styles.container}>
        <Reveal className={styles.sectionHead}>
          <p className={styles.label}>Everything in one place</p>
          <h2 id="features-title" className={styles.h2}>Every tool you need to sell online. None of the clutter.</h2>
        </Reveal>
        <motion.ul role="list" className={styles.bento} variants={staggerParent} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-10%" }}>
          {features.map((feature) => (
            <motion.li key={feature.id} variants={staggerChild} className={`${styles.bentoCard} ${styles[`bento_${feature.size}`]}`} whileHover="hover">
              <div className={styles.bentoCopy}>
                <h3>{feature.title}</h3>
                <p>{feature.text}</p>
              </div>
              <div className={styles.bentoVisual}>
                {feature.id === "analytics" ? <MiniChart /> : (
                  <motion.div className={styles.bentoImage} variants={{ hover: { scale: 1.04 } }} transition={{ duration: 0.6, ease: EASE }}>
                    <Image src={`/assets/feature-${feature.id}.webp`} alt="" width={1200} height={800} sizes="(max-width: 899px) 92vw, 600px" loading="lazy" />
                  </motion.div>
                )}
                {feature.id === "orders" ? <MiniOrders /> : null}
                {feature.id === "checkout" ? (
                  <motion.span className={styles.paidChip} aria-hidden="true" initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, ease: EASE, delay: 0.5 }}>
                    <Check size={14} strokeWidth={1.5} /> Payment received · £86.00
                  </motion.span>
                ) : null}
              </div>
            </motion.li>
          ))}
        </motion.ul>
      </div>
    </section>
  );
}

/* ---------- 6. Templates ---------- */

export function Templates() {
  return (
    <section id="templates" className={styles.section} aria-labelledby="templates-title">
      <div className={styles.container}>
        <div className={styles.headRow}>
          <Reveal className={styles.sectionHead}>
            <p className={styles.label}>Store designs</p>
            <h2 id="templates-title" className={styles.h2}>Start with a design made for your shop.</h2>
          </Reveal>
          <Link href="/signup" className={styles.textLink}>Browse all designs <ArrowUpRight size={16} strokeWidth={1.5} aria-hidden="true" /></Link>
        </div>
        <motion.ul role="list" className={styles.templateGrid} variants={staggerParent} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-10%" }}>
          {templates.map(({ slug, name, category }) => (
            <motion.li key={slug} variants={staggerChild}>
              <motion.div whileHover="hover" className={styles.templateCard}>
                <Link href={`/theme-preview/${slug}`} prefetch={false} className={styles.templateLink}>
                  <span className={styles.templateImage}>
                    <motion.span variants={{ hover: { scale: 1.05, y: -6 } }} transition={{ duration: 0.7, ease: EASE }} className={styles.templateImageInner}>
                      <Image src={`/assets/template-${slug.replace("jelly-", "")}.webp`} alt="" width={1200} height={800} sizes="(max-width: 639px) 92vw, (max-width: 1023px) 46vw, 380px" loading="lazy" />
                    </motion.span>
                    <motion.span className={styles.templateHover} variants={{ hover: { opacity: 1, y: 0 } }} initial={{ opacity: 0, y: 8 }} transition={{ duration: 0.3, ease: EASE }} aria-hidden="true">
                      Preview live store <ArrowUpRight size={14} strokeWidth={1.5} />
                    </motion.span>
                  </span>
                  <span className={styles.templateMeta}>
                    <strong>{name}</strong>
                    <span>{category}</span>
                  </span>
                  <span className={styles.srOnly}>, preview this design</span>
                </Link>
              </motion.div>
            </motion.li>
          ))}
        </motion.ul>
      </div>
    </section>
  );
}
