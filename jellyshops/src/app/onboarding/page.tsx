"use client";

import { ArrowLeft, ArrowRight, Check, LoaderCircle, LockKeyhole } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import "@/features/brand/brand.css";
import { geist, geistMono } from "@/features/brand/fonts";
import { JellyShopLogo } from "@/features/brand/logo";
import { useReducedMotion } from "@/features/brand/motion";
import {
  markets, SetupRequestError, setupRequest,
  type MerchantPolicies, type SetupAnswers, type SetupDraft, type SetupStep,
} from "@/features/auth/api/onboarding-api";
import type { MerchantStore } from "@/features/auth/api/merchant-api";
import { SetupImageControl, useSetupImage } from "@/features/auth/components/setup-images";
import { authApiOrigin, useAuth } from "@/features/auth/providers/auth-provider";
import {
  SetupFields, slugFromName, stepContent, stepVisual, suggestedTheme, themeCover, themes, validateStep, visibleStep, visibleSteps, type VisibleStep,
} from "./steps";
import styles from "./onboarding.module.css";

type AddressCheck = { slug: string; state: "checking" | "available" | "taken" | "error" };
type SaveStatus = "idle" | "saving" | "saved" | "error";
const EASE = [0.22, 1, 0.36, 1] as const;

function prefill(answers: SetupAnswers, metadata: Record<string, unknown>): SetupAnswers {
  const name = metadata.name ?? metadata.full_name;
  return typeof name === "string" && answers.fullName === undefined ? { ...answers, fullName: name.slice(0, 120) } : answers;
}

export default function OnboardingPage() {
  const { configured, loading, session, stores, signOut, getAccessToken, refreshMerchant, setActiveStoreId } = useAuth();
  const router = useRouter();
  const reduced = useReducedMotion();
  const user = session?.user;
  const userId = user?.id;
  const [draft, setDraft] = useState<SetupDraft | null>(null);
  const [answers, setAnswers] = useState<SetupAnswers>({});
  const [step, setStep] = useState<VisibleStep>("store");
  const [direction, setDirection] = useState(1);
  const [policies, setPolicies] = useState<MerchantPolicies | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [address, setAddress] = useState<AddressCheck | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [created, setCreated] = useState<MerchantStore | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [hasLogo, setHasLogo] = useState(false);
  const latestUser = useRef(user);
  const heading = useRef<HTMLHeadingElement>(null);
  const slugEdited = useRef(false);
  const revision = useRef(0);
  const saved = useRef("");
  const write = useRef<Promise<void> | null>(null);
  const logo = useSetupImage("logo", hasLogo);
  const request = useCallback(async <T,>(path = "", options: Parameters<typeof setupRequest>[3] = {}) => {
    return setupRequest<T>(authApiOrigin(), path, await getAccessToken(), options);
  }, [getAccessToken]);

  useEffect(() => { latestUser.current = user; }, [user]);
  useEffect(() => {
    if (configured && !loading && !userId) router.replace("/login?next=%2Fonboarding");
    if (stores.length && !creating) router.replace("/admin");
  }, [configured, creating, loading, router, stores.length, userId]);

  const hasStore = stores.length > 0;
  useEffect(() => {
    if (!userId || hasStore) return;
    const controller = new AbortController();
    void request<SetupDraft>("", { signal: controller.signal }).then(async (state) => {
      if (controller.signal.aborted) return;
      if (state.store) {
        setActiveStoreId(state.store.id);
        router.replace("/admin");
        return;
      }
      const nextAnswers = prefill(state.answers, latestUser.current?.user_metadata ?? {});
      revision.current = state.revision;
      saved.current = JSON.stringify({ step: state.step, answers: state.answers });
      slugEdited.current = Boolean(nextAnswers.slug && nextAnswers.slug !== slugFromName(nextAnswers.name ?? ""));
      setDraft(state);
      setAnswers(nextAnswers);
      setStep(visibleStep(state.step));
      setHasLogo(state.images.logo);
      if (state.consentRequired) {
        const policy = await setupRequest<MerchantPolicies>(authApiOrigin(), "/policies", undefined, { signal: controller.signal });
        if (!controller.signal.aborted) setPolicies(policy);
      }
    }).catch((failure: unknown) => {
      if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "Could not load your setup.");
    });
    return () => controller.abort();
    // setActiveStoreId may change identity when merchant context refreshes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt, hasStore, request, router, userId]);

  useEffect(() => {
    // A new step starts at the top: on phones Continue sits low on the page, and the next step would otherwise open part-way down.
    if (heading.current && heading.current.getBoundingClientRect().top < 0) window.scrollTo({ top: 0, behavior: "instant" });
    heading.current?.focus({ preventScroll: true });
  }, [draft?.consentRequired, step]);

  const save = useCallback(async (nextStep: SetupStep, nextAnswers: SetupAnswers) => {
    while (write.current) await write.current;
    const key = JSON.stringify({ step: nextStep, answers: nextAnswers });
    if (saved.current === key) return;
    setSaveStatus("saving");
    const operation = request<SetupDraft>("", {
      method: "PATCH",
      body: { revision: revision.current, step: nextStep, answers: nextAnswers },
    }).then((result) => {
      revision.current = result.revision;
      saved.current = key;
      setSaveStatus("saved");
    }).catch((failure: unknown) => {
      setSaveStatus("error");
      if (failure instanceof SetupRequestError && failure.status === 409) setConflict(true);
      throw failure;
    });
    write.current = operation;
    try {
      await operation;
    } finally {
      if (write.current === operation) write.current = null;
    }
  }, [request]);

  const consentRequired = draft?.consentRequired;
  useEffect(() => {
    if (consentRequired !== false || busy || conflict || created) return;
    const timer = window.setTimeout(() => { void save(step, answers).catch(() => undefined); }, 600);
    return () => window.clearTimeout(timer);
  }, [answers, busy, conflict, consentRequired, created, save, step]);

  const currentSlug = answers.slug ?? "";
  const validAddress = /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(currentSlug) && currentSlug.length >= 3 && currentSlug.length <= 63;
  useEffect(() => {
    if (step !== "store" || !validAddress) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setAddress({ slug: currentSlug, state: "checking" });
      void request<{ available: boolean }>(`/availability?slug=${encodeURIComponent(currentSlug)}`, { signal: controller.signal })
        .then(({ available }) => {
          if (!controller.signal.aborted) setAddress({ slug: currentSlug, state: available ? "available" : "taken" });
        }).catch(() => {
          if (!controller.signal.aborted) setAddress({ slug: currentSlug, state: "error" });
        });
    }, 300);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [currentSlug, request, step, validAddress]);

  function change(patch: Partial<SetupAnswers>) {
    if (patch.name !== undefined && !slugEdited.current) patch = { ...patch, slug: slugFromName(patch.name) };
    if (patch.product && Object.values(patch.product).every(value => value === undefined || value === "")) patch = { ...patch, product: null };
    if (patch.slug !== undefined) setAddress(null);
    setAnswers((previous) => ({ ...previous, ...patch }));
    setFieldErrors((previous) => Object.fromEntries(Object.entries(previous).filter(([field]) => !(field in patch))));
  }

  function report(failure: unknown, fallback: string) {
    setError(failure instanceof Error ? failure.message : fallback);
  }

  async function navigate(nextStep: VisibleStep, nextAnswers = answers) {
    if (busy || conflict) return;
    setBusy(true);
    setError("");
    try {
      await save(nextStep, nextAnswers);
      setFieldErrors({});
      setDirection(visibleSteps.indexOf(nextStep) < visibleSteps.indexOf(step) ? -1 : 1);
      setAnswers(nextAnswers);
      setStep(nextStep);
    } catch (failure) {
      report(failure, "Could not save your progress. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function accept(event: FormEvent) {
    event.preventDefault();
    if (!policies || !agreed || busy) return;
    setBusy(true);
    setError("");
    try {
      await request("/consent", { method: "POST", body: { version: policies.version } });
      setDraft((state) => state && { ...state, consentRequired: false });
    } catch (failure) {
      if (failure instanceof SetupRequestError && failure.code === "ONBOARDING_POLICY_UPDATED") {
        setAgreed(false);
        reloadSavedVersion();
      } else report(failure, "Could not save your acceptance.");
    } finally {
      setBusy(false);
    }
  }

  async function openDashboard(store: MerchantStore) {
    try {
      await refreshMerchant();
      setActiveStoreId(store.id);
      router.replace("/admin?welcome=1");
    } catch {
      setError("Your store was created, but the dashboard could not load. Try loading it again.");
      setBusy(false);
    }
  }

  async function complete(finalAnswers: SetupAnswers) {
    setBusy(true);
    setError("");
    setCreating(true);
    try {
      await save("review", finalAnswers);
      const { store } = await request<{ store: MerchantStore }>("/complete", { method: "POST", body: { revision: revision.current } });
      setCreated(store);
      await openDashboard(store);
    } catch (failure) {
      setCreating(false);
      if (failure instanceof SetupRequestError && failure.code === "STORE_SLUG_TAKEN") {
        setDirection(-1);
        setStep("store");
        setFieldErrors({ slug: "That store address was just taken. Choose another." });
        setAddress({ slug: currentSlug, state: "taken" });
      } else report(failure, "Could not create your store. Try again.");
      setBusy(false);
    }
  }

  /** The suggested design counts as chosen unless the merchant picked another. */
  const withTheme = (value: SetupAnswers): SetupAnswers => ({ ...value, theme: value.theme ?? suggestedTheme(value.category) });

  async function continueSetup(event: FormEvent) {
    event.preventDefault();
    if (busy || conflict) return;
    const issues = validateStep(step, answers);
    if (step === "store" && address?.slug === currentSlug && address.state === "taken") issues.slug = "That store address is taken. Choose another.";
    setFieldErrors(issues);
    if (Object.keys(issues).length) {
      document.getElementById(`onboard-${Object.keys(issues)[0]}`)?.focus();
      return;
    }
    const final = withTheme(answers);
    const missing = validateStep("review", final);
    if (step === "products") {
      if (Object.keys(missing).length) { setDirection(-1); setStep("store"); setFieldErrors(missing); return; }
      await complete(final);
    } else await navigate(visibleSteps[visibleSteps.indexOf(step) + 1], step === "branding" ? final : answers);
  }

  async function skip() {
    if (step === "products") {
      const final = withTheme({ ...answers, product: null });
      setAnswers(final);
      if (Object.keys(validateStep("review", final)).length) { setDirection(-1); setStep("store"); return; }
      await complete(final);
    } else await navigate(visibleSteps[visibleSteps.indexOf(step) + 1], step === "branding" ? withTheme(answers) : answers);
  }

  async function finishLater() {
    setBusy(true);
    setError("");
    try {
      await save(step, answers);
      router.replace("/");
    } catch (failure) {
      report(failure, "Could not save your progress yet.");
      setBusy(false);
    }
  }

  function reloadSavedVersion() {
    setError("");
    setDraft(null);
    setConflict(false);
    setSaveStatus("idle");
    setAttempt((value) => value + 1);
  }

  let contents: ReactNode;
  const index = visibleSteps.indexOf(step);
  const waiting = loading || !userId || !draft || (hasStore && !creating);
  const blocked = busy || logo.pending || conflict;
  const activeAddress = address?.slug === currentSlug ? address.state : null;
  const slide = {
    initial: (dir: number) => (reduced ? { opacity: 0 } : { opacity: 0, x: dir * 32 }),
    animate: { opacity: 1, x: 0 },
    exit: (dir: number) => (reduced ? { opacity: 0 } : { opacity: 0, x: dir * -32 }),
  };

  if (!configured) {
    contents = <div className={styles.state}><h1>Store setup is unavailable</h1><p>Sign-in is temporarily unavailable. Try again later.</p><Link className={styles.secondary} href="/">Back to home</Link></div>;
  } else if (waiting) {
    contents = error
      ? <div className={styles.state}><h1>We couldn’t open store setup</h1><p role="alert" className={styles.alert}>{error}</p><button type="button" className={styles.primary} onClick={reloadSavedVersion}>Try again</button></div>
      : <div className={styles.state} role="status" aria-live="polite">
          <span className={styles.spinner} aria-hidden="true"><LoaderCircle size={22} strokeWidth={1.5} /></span>
          <h1>Getting your setup ready</h1>
          <p>Loading your progress…</p>
          <div className={styles.skeleton} aria-hidden="true"><span /><span /><span /></div>
        </div>;
  } else if (consentRequired) {
    contents = <form className={styles.form} onSubmit={accept}>
      <div className={styles.intro}>
        <p className={styles.eyebrow}>Before you start</p>
        <h1 ref={heading} tabIndex={-1}>Our terms, in brief</h1>
        <p>Please read and accept Jellyshop’s terms before you set up your store.</p>
      </div>
      {policies ? <>
        <ul className={styles.policyLinks} role="list">
          <li><a href={policies.termsUrl} target="_blank" rel="noreferrer">Terms of Service</a></li>
          <li><a href={policies.privacyUrl} target="_blank" rel="noreferrer">Privacy Policy</a></li>
        </ul>
        <label className={styles.consent}><input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} /> I agree to the Jellyshop Terms of Service.</label>
        <button type="submit" className={styles.primary} disabled={!agreed || busy}>{busy ? "Saving…" : "Accept and continue"} <ArrowRight size={16} aria-hidden="true" /></button>
      </> : <><p className={styles.alert}>The policy links couldn’t load. You need them before you can continue.</p><button type="button" className={styles.primary} onClick={reloadSavedVersion}>Try again</button></>}
      {error && <p className={styles.alert} role="alert">{error}</p>}
      <button type="button" className={styles.ghost} onClick={() => void signOut()}>Sign out</button>
    </form>;
  } else if (created) {
    contents = <div className={styles.state}>
      <motion.span className={styles.success} initial={reduced ? false : { scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 260, damping: 18 }} aria-hidden="true">
        <Check size={28} strokeWidth={2} />
      </motion.span>
      <h1>Your store is ready</h1>
      <p>{created.name} is set up as a draft. Nobody can see it until you publish.</p>
      {error ? <><p role="alert" className={styles.alert}>{error}</p><button type="button" className={styles.primary} disabled={busy} onClick={() => { setError(""); setBusy(true); void openDashboard(created); }}>Open your dashboard</button></>
        : <p role="status" className={styles.hint}>Opening your dashboard…</p>}
    </div>;
  } else {
    const { title, description } = stepContent[step];
    const last = step === "products";
    contents = (
      <AnimatePresence mode="wait" custom={direction} initial={false}>
        <motion.form key={step} custom={direction} variants={slide} initial="initial" animate="animate" exit="exit"
          transition={{ duration: 0.35, ease: EASE }} className={styles.form} onSubmit={continueSetup} noValidate>
          <div className={styles.intro}>
            <p className={styles.eyebrow}>Step {index + 1} of {visibleSteps.length}</p>
            <h1 ref={heading} tabIndex={-1}>{title}</h1>
            <p>{description}</p>
          </div>
          <fieldset className={styles.fields} disabled={busy || conflict}>
            <SetupFields step={step} answers={answers} fieldErrors={fieldErrors} change={change}
              changeSlug={(slug) => { slugEdited.current = true; change({ slug }); }}
              addressState={activeAddress}
              logo={<SetupImageControl kind="logo" title="Store logo" picture={logo} present={hasLogo} onUpdate={setHasLogo} />}
            />
          </fieldset>
          {error && <p className={styles.alert} role="alert">{error}</p>}
          {conflict && <p className={styles.alert} role="alert">Setup changed in another tab. Load the saved version to carry on there. Changes on this screen that haven’t saved will be lost.</p>}
          <div className={styles.actions}>
            {conflict ? <button type="button" className={styles.primary} onClick={reloadSavedVersion}>Load saved version</button>
              : <motion.button type="submit" className={styles.primary} disabled={blocked} whileTap={reduced ? undefined : { scale: 0.98 }}>
                  {busy ? <><LoaderCircle className={styles.spin} size={16} aria-hidden="true" /> {last ? "Creating your store…" : "Saving…"}</>
                    : <>{last ? "Create my store" : "Continue"} <ArrowRight size={16} aria-hidden="true" /></>}
                </motion.button>}
            {step !== "store" && !conflict && <button type="button" className={styles.ghost} disabled={blocked} onClick={() => void skip()}>
              {last ? "Skip and create store" : "Skip for now"}
            </button>}
          </div>
          <p className={styles.saveStatus} role="status">
            {saveStatus === "saving" ? "Saving…" : saveStatus === "saved" ? <><Check size={13} aria-hidden="true" /> Progress saved</>
              : saveStatus === "error" ? "Couldn’t save your progress." : "Your progress saves as you go."}
            {saveStatus === "error" && !conflict && <button type="button" className={styles.inlineButton} disabled={busy}
              onClick={() => { setError(""); void save(step, answers).catch((failure) => report(failure, "Could not save your progress.")); }}>Try again</button>}
          </p>
        </motion.form>
      </AnimatePresence>
    );
  }

  const showProgress = Boolean(configured && !waiting && !consentRequired && !created);
  return (
    <div data-brand className={`${styles.shell} ${geist.variable} ${geistMono.variable}`}>
      <div className={styles.column}>
        <header className={styles.header}>
          {showProgress && index > 0
            ? <button type="button" className={styles.ghost} disabled={blocked} onClick={() => void navigate(visibleSteps[index - 1])}><ArrowLeft size={16} aria-hidden="true" /> Back</button>
            : <Link href="/" className={styles.logo}><JellyShopLogo height={22} /></Link>}
          {showProgress && <button type="button" className={styles.ghost} disabled={blocked} onClick={() => void finishLater()}>Finish later</button>}
        </header>
        {showProgress && (
          <div className={styles.progress}>
            <div role="progressbar" className={styles.track} aria-label="Store setup progress" aria-valuemin={1} aria-valuemax={visibleSteps.length}
              aria-valuenow={index + 1} aria-valuetext={`Step ${index + 1} of ${visibleSteps.length}: ${stepContent[step].label}`}>
              <motion.span initial={false} animate={{ scaleX: (index + 1) / visibleSteps.length }} transition={{ duration: reduced ? 0 : 0.6, ease: EASE }} />
            </div>
            <ol className={styles.stepList} aria-hidden="true">
              {visibleSteps.map((item, i) => <li key={item} data-state={i < index ? "done" : i === index ? "current" : undefined}>{stepContent[item].label}</li>)}
            </ol>
          </div>
        )}
        <main className={styles.content}>{contents}</main>
      </div>
      <Stage step={step} answers={answers} logo={logo.url} active={showProgress} reduced={reduced} />
    </div>
  );
}

/** Right-hand panel: a picture for the step plus a live preview of the store as it's filled in. */
function Stage({ step, answers, logo, active, reduced }: { step: VisibleStep; answers: SetupAnswers; logo: string | null; active: boolean; reduced: boolean }) {
  const themeId = answers.theme ?? suggestedTheme(answers.category);
  const theme = themes.find((item) => item.id === themeId) ?? themes[0];
  const picture = step === "branding" ? themeCover(theme.id) : stepVisual[step];
  const market = answers.country ? markets[answers.country] : null;
  const price = answers.product?.priceMinor;
  return (
    <aside className={styles.stage} aria-label="Store preview">
      <Image className={styles.stageGrid} src="/assets/bg-hero-grid.webp" alt="" fill sizes="50vw" />
      <div className={styles.stageGlow} aria-hidden="true" />
      <div className={styles.stageVisual} aria-hidden="true">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={active ? picture : "idle"} className={styles.stageImage}
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: -16, scale: 0.98 }} transition={{ duration: 0.5, ease: EASE }}>
            {step === "branding" && active
              ? <Image src={picture} alt="" width={1200} height={800} sizes="(max-width: 1023px) 0px, 44vw" data-colour />
              : <Image src={active ? picture : stepVisual.store} alt="" width={1024} height={1024} sizes="(max-width: 1023px) 0px, 36vw" />}
          </motion.div>
        </AnimatePresence>
      </div>
      <figure className={styles.preview}>
        <div className={styles.previewBar}><span aria-hidden="true" />jelly.shop/{answers.slug || "your-store"}</div>
        <div className={styles.previewBody}>
          <div className={styles.previewName}>
            {logo ? <Image src={logo} width={28} height={28} alt="" unoptimized /> : <span aria-hidden="true">{(answers.name?.trim() || "Y").slice(0, 1).toUpperCase()}</span>}
            <strong>{answers.name?.trim() || "Your store"}</strong>
          </div>
          <dl>
            <div><dt>Design</dt><dd>{theme.name}</dd></div>
            <div><dt>Selling</dt><dd>{answers.category ?? "Not chosen yet"}</dd></div>
            <div><dt>First product</dt><dd>{answers.product?.title?.trim() ? `${answers.product.title}${market && price !== undefined ? ` · ${new Intl.NumberFormat("en", { style: "currency", currency: market.currency }).format(price / 100)}` : ""}` : "Not added yet"}</dd></div>
          </dl>
        </div>
        <figcaption><LockKeyhole size={13} aria-hidden="true" /> Your store stays private until you publish.</figcaption>
      </figure>
    </aside>
  );
}
