"use client";

import { ArrowRight, Check, Plus } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion, useScroll, useTransform } from "motion/react";
import { useId, useRef, useState } from "react";
import { channels, codeLines, faqs, footer, integrations, plans, social, stories, trust } from "../home-content";
import { DemoDialog } from "./demo-dialog";
import { BrandMark, Icon } from "./icons";
import { JellyShopLogo } from "@/features/brand/logo";
import { Counter, EASE, Reveal, SPRING, staggerChild, staggerParent, useReducedMotion } from "@/features/brand/motion";
import styles from "../home.module.css";

/* ---------- 7. Sell everywhere: animated channel diagram ---------- */

const NODES = [
  { x: 110, y: 90 }, { x: 490, y: 90 }, { x: 110, y: 310 }, { x: 490, y: 310 },
];

export function SellEverywhere() {
  const reduced = useReducedMotion();
  return (
    <section id="sell-everywhere" className={styles.section} aria-labelledby="sell-title">
      <div className={`${styles.container} ${styles.split}`}>
        <div>
          <Reveal className={styles.sectionHead}>
            <p className={styles.label}>Sell everywhere</p>
            <h2 id="sell-title" className={styles.h2}>One shop. Every place your customers are.</h2>
            <p className={styles.sectionText}>Products, stock and orders stay in one place, wherever the sale happens.</p>
          </Reveal>
          <motion.ul role="list" className={styles.channelList} variants={staggerParent} initial="hidden" whileInView="show" viewport={{ once: true }}>
            {channels.map(({ title, text, icon, soon }) => (
              <motion.li key={title} variants={staggerChild}>
                <span className={styles.channelIcon}><Icon name={icon} /></span>
                <span><strong>{title}{soon ? <em className={styles.soon}>Soon</em> : null}</strong><span>{text}</span></span>
              </motion.li>
            ))}
          </motion.ul>
        </div>
        <div className={styles.diagram} aria-hidden="true">
          <svg viewBox="0 0 600 400" role="presentation">
            {NODES.map((node, i) => (
              <motion.path
                key={i}
                d={`M300 200 C ${300} ${node.y}, ${node.x} ${200}, ${node.x} ${node.y}`}
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
                strokeDasharray={channels[i].soon ? "4 6" : undefined}
                initial={reduced ? false : { pathLength: 0, opacity: 0 }}
                whileInView={{ pathLength: 1, opacity: channels[i].soon ? 0.35 : 0.6 }}
                viewport={{ once: true }}
                transition={{ duration: 1.2, ease: EASE, delay: 0.2 + i * 0.15 }}
              />
            ))}
          </svg>
          <motion.div className={styles.hub} initial={reduced ? false : { opacity: 0, scale: 0.8 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ duration: 0.7, ease: EASE }}>
            <JellyShopLogo height={22} />
            {!reduced ? <motion.span className={styles.hubPulse} animate={{ scale: [1, 1.5], opacity: [0.4, 0] }} transition={{ duration: 2.4, repeat: Infinity, ease: "easeOut" }} /> : null}
          </motion.div>
          {channels.map(({ title, icon, soon }, i) => (
            <motion.div
              key={title}
              className={`${styles.node} ${soon ? styles.nodeSoon : ""}`}
              style={{ left: `${(NODES[i].x / 600) * 100}%`, top: `${(NODES[i].y / 400) * 100}%` }}
              initial={reduced ? false : { opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, ease: EASE, delay: 0.9 + i * 0.12 }}
            >
              <Icon name={icon} size={16} /> {title}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- 8. Integrations + developers ---------- */

export function Integrations() {
  const reduced = useReducedMotion();
  return (
    <section id="integrations" className={styles.section} aria-labelledby="integrations-title">
      <div className={styles.container}>
        <Reveal className={`${styles.sectionHead} ${styles.center}`}>
          <p className={styles.label}>Integrations</p>
          <h2 id="integrations-title" className={styles.h2}>Works with the tools you already use.</h2>
          <p className={styles.sectionText}>Payments, video, music, maps, forms and spreadsheets, built in.</p>
        </Reveal>
        <motion.ul role="list" className={styles.integrationGrid} variants={staggerParent} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-10%" }}>
          {integrations.map(({ name, text, logo, icon }) => (
            <motion.li key={name} variants={staggerChild} whileHover={{ y: -2 }} transition={SPRING}>
              {logo ? <BrandMark slug={logo} className={styles.brandMark} /> : <span className={styles.genericMark}><Icon name={icon ?? "sheet"} size={18} /></span>}
              <span><strong>{name}</strong><span>{text}</span></span>
            </motion.li>
          ))}
        </motion.ul>
        <p className={styles.footnoteCenter}>Logos belong to their owners and are shown only for integrations Jelly Shop supports today.</p>

        <Reveal className={styles.devPanel}>
          <div id="developers" className={styles.devCopy}>
            <p className={styles.label}>For developers</p>
            <h3>Build your own theme. Ship it from the terminal.</h3>
            <p>A theme kit with live preview, packaging and upload, plus access tokens for your own scripts.</p>
            <Link href="/signup" className={`${styles.btn} ${styles.btnOutline}`}>Get started <ArrowRight size={16} strokeWidth={1.5} aria-hidden="true" /></Link>
          </div>
          <div className={styles.terminal}>
            <div className={styles.terminalBar} aria-hidden="true"><span /><span /><span /><em>terminal</em></div>
            <motion.pre
              aria-label="Example theme kit commands: create, preview, package and upload a theme"
              variants={{ show: { transition: { staggerChildren: reduced ? 0 : 0.35 } } }}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-15%" }}
            >
              {codeLines.map((line, i) => (
                <motion.code
                  key={i}
                  className={styles[`code_${line.kind}`]}
                  variants={{ hidden: { opacity: 0, x: -8 }, show: { opacity: 1, x: 0, transition: { duration: 0.35, ease: EASE } } }}
                >
                  {line.kind === "cmd" ? <span className={styles.prompt}>$ </span> : null}{line.text}
                </motion.code>
              ))}
              <span className={styles.caret} aria-hidden="true" />
            </motion.pre>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ---------- 9. Stories ---------- */

export function Stories() {
  return (
    <section id="stories" className={styles.section} aria-labelledby="stories-title">
      <div className={styles.container}>
        <Reveal className={styles.sectionHead}>
          <p className={styles.label}>Merchant stories</p>
          <h2 id="stories-title" className={styles.h2}>Small shops. Measurable results.</h2>
        </Reveal>
        <motion.ul role="list" className={styles.storyGrid} variants={staggerParent} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-10%" }}>
          {stories.map((story) => (
            <motion.li key={story.name} variants={staggerChild}>
              <figure className={styles.story}>
                <p className={styles.metric}>
                  <strong><Counter value={story.metric} prefix={story.prefix} suffix={story.suffix} decimals={"decimals" in story ? story.decimals : 0} /></strong>
                  <span>{story.metricLabel}</span>
                </p>
                <blockquote><p>“{story.quote}”</p></blockquote>
                <figcaption>
                  <Image src={`/assets/${story.avatar}.webp`} alt="" width={96} height={96} loading="lazy" />
                  <span><strong>{story.name}</strong><span>{story.role}</span></span>
                </figcaption>
              </figure>
            </motion.li>
          ))}
        </motion.ul>
        <p className={styles.footnote}>Illustrative merchants and results, shown to explain what Jelly Shop does.</p>
      </div>
    </section>
  );
}

/* ---------- 10. Pricing ---------- */

export function Pricing() {
  const [yearly, setYearly] = useState(false);
  const reduced = useReducedMotion();
  return (
    <section id="pricing" className={styles.section} aria-labelledby="pricing-title">
      <div className={styles.container}>
        <Reveal className={`${styles.sectionHead} ${styles.center}`}>
          <p className={styles.label}>Pricing</p>
          <h2 id="pricing-title" className={styles.h2}>Simple pricing that grows with you.</h2>
          <p className={styles.sectionText}>Start free. Upgrade when you&apos;re selling more.</p>
        </Reveal>
        <div className={styles.billing} role="radiogroup" aria-label="Billing period">
          {[{ v: false, label: "Monthly" }, { v: true, label: "Yearly" }].map(({ v, label }) => (
            <button key={label} type="button" role="radio" aria-checked={yearly === v} onClick={() => setYearly(v)}>
              {yearly === v ? <motion.span layoutId="billing-pill" className={styles.billingPill} transition={SPRING} /> : null}
              <span className={styles.billingText}>{label}{v ? <em> · 2 months free</em> : null}</span>
            </button>
          ))}
        </div>
        <motion.ul role="list" className={styles.planGrid} variants={staggerParent} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-10%" }}>
          {plans.map((plan) => {
            const price = yearly ? Math.round((plan.monthly * 10) / 12) : plan.monthly;
            return (
              <motion.li key={plan.name} variants={staggerChild} className={`${styles.plan} ${plan.featured ? styles.planFeatured : ""}`}>
                <div className={styles.planHead}>
                  <h3>{plan.name}</h3>
                  {plan.featured ? <span className={styles.badge}>Most popular</span> : null}
                </div>
                <p className={styles.planText}>{plan.text}</p>
                <p className={styles.price} aria-live="polite">
                  <span className={styles.priceNumber}>
                    <AnimatePresence mode="popLayout" initial={false}>
                      <motion.strong key={price} initial={reduced ? { opacity: 0 } : { y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={reduced ? { opacity: 0 } : { y: -16, opacity: 0 }} transition={{ duration: 0.3, ease: EASE }}>
                        £{price}
                      </motion.strong>
                    </AnimatePresence>
                  </span>
                  <span>{plan.monthly === 0 ? "for ever" : yearly ? "a month, billed yearly" : "a month"}</span>
                </p>
                <Link href="/signup" className={`${styles.btn} ${plan.featured ? styles.btnSolid : styles.btnOutline} ${styles.btnBlock}`}>{plan.cta}</Link>
                <ul role="list" className={styles.checkList}>
                  {plan.items.map((item) => <li key={item}><Check size={14} strokeWidth={1.5} aria-hidden="true" />{item}</li>)}
                </ul>
              </motion.li>
            );
          })}
        </motion.ul>
      </div>
    </section>
  );
}

/* ---------- 11. Trust ---------- */

export function Trust() {
  return (
    <section id="trust" className={styles.trust} aria-labelledby="trust-title">
      <div className={styles.container}>
        <Reveal className={styles.sectionHead}>
          <p className={styles.label}>Security, reliability and support</p>
          <h2 id="trust-title" className={styles.h2}>Built to be trusted with your business.</h2>
        </Reveal>
        <motion.ul role="list" className={styles.trustGrid} variants={staggerParent} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-10%" }}>
          {trust.map(({ title, text, icon }) => (
            <motion.li key={title} variants={staggerChild}>
              <span className={styles.trustIcon}><Icon name={icon} size={18} /></span>
              <h3>{title}</h3>
              <p>{text}</p>
            </motion.li>
          ))}
        </motion.ul>
      </div>
    </section>
  );
}

/* ---------- 12. FAQ ---------- */

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  const reduced = useReducedMotion();
  const id = useId();
  return (
    <div className={styles.faqItem}>
      <h3>
        <button type="button" aria-expanded={open} aria-controls={`${id}-panel`} id={`${id}-button`} onClick={() => setOpen(!open)}>
          {q}
          <motion.span animate={{ rotate: open ? 45 : 0 }} transition={SPRING} className={styles.faqIcon}><Plus size={16} strokeWidth={1.5} aria-hidden="true" /></motion.span>
        </button>
      </h3>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            id={`${id}-panel`}
            role="region"
            aria-labelledby={`${id}-button`}
            className={styles.faqPanel}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.35, ease: EASE }}
          >
            <p>{a}</p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export function Faq() {
  return (
    <section id="faq" className={styles.section} aria-labelledby="faq-title">
      <div className={`${styles.container} ${styles.faq}`}>
        <Reveal className={styles.sectionHead}>
          <p className={styles.label}>Questions</p>
          <h2 id="faq-title" className={styles.h2}>Frequently asked questions.</h2>
          <p className={styles.sectionText}>Can&apos;t find an answer? Email us and a real person will reply.</p>
        </Reveal>
        <Reveal className={styles.faqList}>
          {faqs.map(({ q, a }) => <FaqItem key={q} q={q} a={a} />)}
        </Reveal>
      </div>
    </section>
  );
}

/* ---------- 13. Final CTA ---------- */

export function FinalCta() {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const glowScale = useTransform(scrollYProgress, [0, 0.5, 1], reduced ? [1, 1, 1] : [0.8, 1.1, 0.9]);
  return (
    <section className={styles.ctaWrap} aria-labelledby="cta-title">
      <div className={styles.container}>
        <div ref={ref} className={styles.cta}>
          <motion.div className={styles.ctaGlow} style={{ scale: glowScale }} aria-hidden="true">
            <Image src="/assets/bg-cta-glow.webp" alt="" fill sizes="(max-width: 1240px) 100vw, 1200px" loading="lazy" />
          </motion.div>
          <Reveal>
            <h2 id="cta-title" className={styles.ctaTitle}>Your store could be live this afternoon.</h2>
          </Reveal>
          <Reveal delay={0.1}><p>Start free, pick a design and add your first product. No card needed.</p></Reveal>
          <Reveal delay={0.2} className={styles.heroActions}>
            <motion.span whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} transition={SPRING}>
              <Link href="/signup" className={`${styles.btn} ${styles.btnSolid} ${styles.btnLarge}`}>Start free <ArrowRight size={16} strokeWidth={1.5} aria-hidden="true" /></Link>
            </motion.span>
            <DemoDialog />
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ---------- 14. Footer ---------- */

export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.container}>
        <div className={styles.footerGrid}>
          <div className={styles.footerBrand}>
            <JellyShopLogo height={24} />
            <p>The online store builder for independent brands.</p>
          </div>
          {footer.map(({ title, links }) => (
            <nav key={title} aria-labelledby={`footer-${title}`}>
              <h2 id={`footer-${title}`} className={styles.label}>{title}</h2>
              <ul role="list">
                {links.map(([label, href]) => <li key={label}><a href={href}>{label}</a></li>)}
              </ul>
            </nav>
          ))}
        </div>
        <div className={styles.legal}>
          <p>© {new Date().getFullYear()} Jelly Labs. All rights reserved.</p>
          <ul role="list" className={styles.social} aria-label="Jelly Shop on social media">
            {social.map(({ label, href }) => <li key={label}><a href={href}>{label}</a></li>)}
          </ul>
        </div>
      </div>
    </footer>
  );
}
