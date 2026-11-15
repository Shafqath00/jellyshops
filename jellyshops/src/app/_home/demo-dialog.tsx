"use client";

import { ArrowLeft, ArrowRight, Pause, Play, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { features } from "../home-content";
import { EASE, SPRING, useReducedMotion } from "@/features/brand/motion";
import styles from "../home.module.css";

/**
 * "Book a demo". Live demo booking isn't set up yet, so the dialog says so and
 * offers a guided product tour that advances every 5 seconds (paused for reduced motion).
 */
export function DemoDialog({ variant = "outline" }: { variant?: "outline" | "ghost" }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const reduced = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const slide = features[index];

  useEffect(() => {
    if (!open || !playing || reduced) return;
    const timer = window.setTimeout(() => setIndex((i) => (i + 1) % features.length), 5000);
    return () => window.clearTimeout(timer);
  }, [open, playing, reduced, index]);

  function show() {
    setIndex(0);
    setPlaying(true);
    setOpen(true);
    dialog.current?.showModal();
  }

  return (
    <>
      <motion.button
        type="button"
        className={`${styles.btn} ${variant === "outline" ? styles.btnOutline : styles.btnGhost} ${styles.btnLarge}`}
        onClick={show}
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        transition={SPRING}
      >
        Book a demo
      </motion.button>
      <dialog
        ref={dialog}
        className={styles.dialog}
        aria-labelledby="demo-title"
        onClose={() => setOpen(false)}
        onClick={(event) => { if (event.target === dialog.current) dialog.current?.close(); }}
      >
        <div className={styles.dialogInner}>
          <div className={styles.dialogHead}>
            <div>
              <h2 id="demo-title">Book a demo</h2>
              <p>Live demos with our team are coming soon. In the meantime, here&apos;s a two-minute tour of Jelly Shop.</p>
            </div>
            <button type="button" className={styles.iconButton} onClick={() => dialog.current?.close()}>
              <X size={16} strokeWidth={1.5} aria-hidden="true" /><span className={styles.srOnly}>Close</span>
            </button>
          </div>
          <div className={styles.tourStage}>
            <AnimatePresence mode="wait" initial={false}>
              {open ? (
                <motion.div
                  key={slide.id}
                  initial={reduced ? { opacity: 0 } : { opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={reduced ? { opacity: 0 } : { opacity: 0, x: -24 }}
                  transition={{ duration: 0.45, ease: EASE }}
                >
                  <Image src={`/assets/feature-${slide.id}.webp`} alt="" width={1200} height={800} sizes="(max-width: 900px) 92vw, 860px" />
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
          <div className={styles.tourCaption} aria-live="polite">
            <p className={styles.label}>Step {index + 1} of {features.length}</p>
            <h3>{slide.title}</h3>
            <p>{slide.text}</p>
          </div>
          <div className={styles.tourControls}>
            <div className={styles.tourDots} aria-hidden="true">
              {features.map((f, i) => <span key={f.id} data-active={i === index} />)}
            </div>
            <button type="button" className={styles.iconButton} onClick={() => setIndex((index - 1 + features.length) % features.length)}>
              <ArrowLeft size={16} strokeWidth={1.5} aria-hidden="true" /><span className={styles.srOnly}>Previous</span>
            </button>
            <button type="button" className={styles.iconButton} onClick={() => setPlaying((p) => !p)}>
              {playing ? <Pause size={16} strokeWidth={1.5} aria-hidden="true" /> : <Play size={16} strokeWidth={1.5} aria-hidden="true" />}
              <span className={styles.srOnly}>{playing ? "Pause tour" : "Play tour"}</span>
            </button>
            <button type="button" className={styles.iconButton} onClick={() => setIndex((index + 1) % features.length)}>
              <ArrowRight size={16} strokeWidth={1.5} aria-hidden="true" /><span className={styles.srOnly}>Next</span>
            </button>
            <Link href="/signup" className={`${styles.btn} ${styles.btnSolid}`}>Start free</Link>
          </div>
        </div>
      </dialog>
    </>
  );
}
